let mongoose = require("mongoose");
let router = require("express").Router();
const axios = require("axios");
let Meeting = mongoose.model("Meeting");
let Appointment = mongoose.model("Appointment");

const crypto = require("crypto");
let auth = require("../auth");
const fs = require("fs");

let { OkResponse, BadRequestResponse } = require("express-http-response");
const { ZegoAppId, ZegoServerSecret } = require("../../config/common");

router.get("/check-roomId/:id", auth.required, async (req, res, next) => {
	try {
		const id = req.params.id;

		const findRoom = await Meeting.findOne({ roomId: id });

		if (!findRoom) {
			return next(new BadRequestResponse(req.t("meeting.errors.roomIdNotFound")));
		}

		return next(new OkResponse({ findRoom }));
	} catch (error) {
		return next(new BadRequestResponse(req.t("meeting.generic.error")));
	}
});

router.get("/roomId/:id", async (req, res, next) => {
	try {
		const id = req.params.id;

		const findMeeting = await Meeting.findOne({ appointment: id });

		if (!findMeeting) {
			return next(new BadRequestResponse(req.t("meeting.errors.meetingNotFound")));
		}

		return next(new OkResponse({ findMeeting }));
	} catch (error) {
		return next(new BadRequestResponse(req.t("meeting.generic.error")));
	}
});

const GenerateUASignature = (appId, signatureNonce, serverSecret, timeStamp) => {
	const hash = crypto.createHash("md5");
	var str = appId + signatureNonce + serverSecret + timeStamp;
	hash.update(str);
	return hash.digest("hex");
};

router.post("/start-record", async (req, res, next) => {
	try {
		const data = req.body;

		let generatedSignatureNonce = crypto.randomBytes(8).toString("hex");

		let generateTimeStamp = Math.round(Date.now() / 1000);

		let generatedSignature = GenerateUASignature(
			ZegoAppId,
			generatedSignatureNonce,
			ZegoServerSecret,
			generateTimeStamp
		);

		const signatureNonce = generatedSignatureNonce;
		const timestamp = generateTimeStamp;
		const signature = generatedSignature;
		const signatureVersion = "2.0";
		const isTest = "false";

		const baseUrl = "https://cloudrecord-api.zego.im/";

		const params = new URLSearchParams({
			Action: "StartRecord",
			AppId: ZegoAppId,
			SignatureNonce: signatureNonce,
			Timestamp: timestamp,
			Signature: signature,
			SignatureVersion: signatureVersion,
			IsTest: isTest,
		});

		const url = `${baseUrl}?${params.toString()}`;

		const uploadResponse = await axios.post(`${url}`, data);

		return next(new OkResponse(uploadResponse.data));
	} catch (error) {
		console.log("error: ", error);
		return next(new BadRequestResponse(error.message));
	}
});

router.post("/stop-record", auth.required, auth.user, async (req, res, next) => {
	try {
		const { TaskId, roomId } = req.body;

		let data = {
			TaskId: TaskId,
		};

		// Generate signature parameters
		const generatedSignatureNonce = crypto.randomBytes(8).toString("hex");
		const generateTimeStamp = Math.round(Date.now() / 1000);
		const generatedSignature = GenerateUASignature(
			ZegoAppId,
			generatedSignatureNonce,
			ZegoServerSecret,
			generateTimeStamp
		);

		const signatureNonce = generatedSignatureNonce;
		const timestamp = generateTimeStamp;
		const signature = generatedSignature;
		const signatureVersion = "2.0";
		const isTest = "false";

		const baseUrl = "https://cloudrecord-api.zego.im/";

		const params = new URLSearchParams({
			Action: "StopRecord",
			AppId: ZegoAppId,
			SignatureNonce: signatureNonce,
			Timestamp: timestamp,
			Signature: signature,
			SignatureVersion: signatureVersion,
			IsTest: isTest,
		});

		const url = `${baseUrl}?${params.toString()}`;

		// Perform the stop recording request
		const uploadResponse = await axios.post(`${url}`, data);

		// Update meeting status and timeout details
		const foundMeeting = await Meeting.findOne({ roomId: roomId });

		// Update the specific user’s timeout status and timeOut
		if (foundMeeting) {
			let userField =
				foundMeeting.doctor._id.toString() === req.user._id.toString() ||
				foundMeeting.patient._id.toString() === req.user._id.toString();

			if (userField) {
				userField.timeOut = new Date();
			}

			foundMeeting.status = "expire";
			await foundMeeting.save();
		}

		return next(new OkResponse(uploadResponse.data));
	} catch (error) {
		console.log("error: ", error);
		return next(new BadRequestResponse(error.message));
	}
});

router.post("/logs/time-in", auth.required, auth.user, async (req, res, next) => {
	try {
		const { roomId, timeIn } = req.body;
		const userId = req.user._id;
		const role = req.user.role;

		if (!roomId || !timeIn || !userId || !role) {
			return next(new BadRequestResponse(req.t("meeting.errors.missingRequiredFields")));
		}

		const meeting = await Meeting.findOne({ roomId });
		if (!meeting) {
			return next(new BadRequestResponse(req.t("meeting.errors.meetingNotFound")));
		}

		let timeLogsArray = role === "doctor" ? meeting.timeLogs.doctor : meeting.timeLogs.patient;

		const userLog = timeLogsArray.find((log) => log._id.toString() === userId.toString());

		if (userLog && !userLog.timeOut) {
			userLog.timeOut = new Date();
		}

		await meeting.save();
		return next(new OkResponse(req.t("meeting.messages.timeInLogRecorded")));
	} catch (error) {
		console.log("Error:", error);
		return next(new BadRequestResponse(req.t("meeting.generic.error")));
	}
});

router.post("/logs/time-out", auth.required, auth.user, async (req, res, next) => {
	try {
		const { roomId } = req.body;
		const userId = req.user._id;
		const role = req.user.role;

		// Find the meeting by roomId
		const meeting = await Meeting.findOne({ roomId });

		if (!meeting) {
			return res.status(404).json({ message: req.t("meeting.errors.meetingNotFound") });
		}

		let userLogs;
		if (role === "doctor") {
			userLogs = meeting.meetingDuration.doctor.find((u) => u._id.toString() === userId.toString());
		} else if (role === "patient") {
			userLogs = meeting.meetingDuration.patient.find((u) => u._id.toString() === userId.toString());
		}

		if (userLogs && !userLogs.timeOut) {
			userLogs.timeOut = new Date();
			await meeting.save();
			return next(new OkResponse(req.t("meeting.messages.timeOutLogRecorded")));
		} else {
			return next(new BadRequestResponse(req.t("meeting.errors.userLogNotFoundOrTimedOut")));
		}
	} catch (error) {
		console.log("error: ", error);
		return res.status(500).json({ message: req.t("meeting.generic.internalServerError") });
	}
});

router.post("/check-status", async (req, res, next) => {
	// this hits by the zeegocloud successfully and we also get the request body containing the event type room_id , task_id and other things as well

	try {
		const roomId = req.body.room_id;

		const eventType = req.body.event_type;

		if (eventType == 1) {
			const allDetails = req.body.detail;

			const upload_status = allDetails.upload_status;

			const allFiles = allDetails.file_info;

			const foundMeeting = await Meeting.findOne({ roomId: roomId });
			const appointmentId = foundMeeting.appointment;

			foundMeeting.status = "expire";
			await foundMeeting.save();

			const appointment = await Appointment.findOne({ _id: appointmentId });

			if (appointment.transcriptionType !== "video") {
				const response = await GenerateTranscription(allFiles, appointmentId);
				console.log("response coming from my own function ***********************************", response);
				if (response.transcription.length > 0) {
					return next(new OkResponse(req.t("meeting.messages.transcriptionGenerated")));
				}
			}
		}
	} catch (error) {
		console.log("error: ", error);
		return next(new BadRequestResponse(req.t("meeting.generic.error")));
	}
});

const GenerateTranscription = async (files, id) => {
	try {
		const baseUrl = "https://api.assemblyai.com/v2";
		const headers = {
			authorization: "7c118231fc0940d4becf08ef7938aa9c",
			"Content-Type": "application/json",
		};

		let fileUrl = files[0].file_url;

		const data = {
			audio_url: fileUrl,
			speaker_labels: true,
			summarization: true,
			language_detection: true,
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
				if (!!!utterances) throw new Error("We are unable to determine your audio. Please try again.");
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
				};
				const appointment = await Appointment.findOne({ _id: id });

				appointment.transcription = transcriptionArray;
				appointment.transcriptionSummary = summary;
				appointment.transcriptionType = "video";

				await appointment.save();

				return responseObj;

				break;
			} else if (transcriptionResult.status === "error") {
				throw new Error(`Transcription failed: ${transcriptionResult.error}`);
			} else {
				await new Promise((resolve) => setTimeout(resolve, 3000));
			}
		}
	} catch (error) {
		console.log("error coming", error);
		throw error;
	}
};

router.post("/create-stream", async (req, res, next) => {
	try {
	} catch (error) {
		console.log("error: ", error);
	}
});

module.exports = router;
