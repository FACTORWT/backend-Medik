var router = require("express").Router();
let mongoose = require("mongoose");
const path = require("path");
var fs = require("fs");
const backend = require("../../config").backend;
var multer = require("../../utilities/multer");
var cpUpload = multer.fields([{ name: "file", maxCount: 1 }]);
let Appointment = mongoose.model("Appointment");
const axios = require("axios");
const { OkResponse, BadRequestResponse } = require("express-http-response");
const { emitEvent } = require("../../utilities/realTime");
const basePath = path.join(process.cwd(), "server/public", "uploads");
const openai = require("../../utilities/openGpt");

// Improved upload route with error handling for multer
router.post("/", function (req, res, next) {
  cpUpload(req, res, function (err) {
    if (err) {
      console.error("Multer error:", err);
      return res
        .status(500)
        .json({ error: "File upload failed", details: err.message });
    }
    console.log("Uploading");
    if (!req.files || !req.files["file"] || !req.files["file"][0]) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    return res.json({
      url: `${backend}/uploads/${req.files["file"][0].filename}`,
    });
  });
});

router.post("/delete", function (req, res, next) {
  if (req.body.url) {
    fs.unlink(
      path.join(process.cwd(), "server/public", req.body.url),
      function (err) {
        if (err) {
          return res.sendStatus(204);
        }
        // if no error, file has been deleted successfully
        return res.json({
          status: 200,
          event: req.t("upload.messages.fileDeleted"),
        });
      }
    );
  } else {
    if (!event) return res.sendStatus(204);
  }
  // unlink the files
});

router.post("/assemble/:id", cpUpload, async (req, res, next) => {
  try {
    const baseUrl = "https://api.assemblyai.com/v2";

    const headers = {
      authorization: "7c118231fc0940d4becf08ef7938aa9c",
      "Content-Type": "application/json",
    };

    const audioData = fs.readFileSync(
      basePath + `/${req.files["file"][0].filename}`
    );

    console.log("audio data", audioData);

    const uploadResponse = await axios.post(`${baseUrl}/upload`, audioData, {
      headers,
    });

    // let uploadUrl =
    // 	"https://factor-medic-assets.s3.amazonaws.com/record/ZaqRsMdmzBnlCSdj_kcai6n_mix_A_20240119151354437.mp4";

    const uploadUrl = uploadResponse.data.upload_url;
    console.log("uploadUrl: ", uploadUrl);

    const data = {
      audio_url: uploadUrl,
      speaker_labels: true,
      summarization: true,
      // language_detection: true
    };

    const url = `${baseUrl}/transcript`;
    const response = await axios.post(url, data, { headers: headers });

    const transcriptId = response.data.id;
    const pollingEndpoint = `${baseUrl}/transcript/${transcriptId}`;

    while (true) {
      const pollingResponse = await axios.get(pollingEndpoint, {
        headers: headers,
      });
      const transcriptionResult = pollingResponse.data;

      if (transcriptionResult.status === "completed") {
        const utterances = transcriptionResult.utterances;
        if (!!!utterances)
          throw new Error(req.t("upload.errors.transcriptionFailed"));
        const transcriptionArray = [];

        for (const utterance of utterances) {
          const speaker = utterance.speaker;
          const text = utterance.text;
          const transcriptionObject = {
            speaker: speaker,
            text: text,
          };
          transcriptionArray.push(transcriptionObject);
        }

        const summary = transcriptionResult.summary;

        const responseObj = {
          transcription: transcriptionArray,
          summary: summary,
          audio: `${backend}/uploads/` + `${req.files["file"][0].filename}`,
        };

        const appointment = await Appointment.findOne({ _id: req.params.id });
        appointment.transcription = transcriptionArray;
        appointment.transcriptionSummary = summary;

        await appointment.save();
        emitEvent(`transcription-updated-${appointment._id}`, {
          data: transcriptionArray,
          summary: summary,
        });

        return next(
          new OkResponse(
            req.t("upload.messages.transcriptionGenerated"),
            responseObj
          )
        );

        break;
      } else if (transcriptionResult.status === "error") {
        throw new Error(`Transcription failed: ${transcriptionResult.error}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    console.log("error coming", error);
    return next(new BadRequestResponse(req.t("upload.errors.uploadError")));
  }
});

module.exports = router;
