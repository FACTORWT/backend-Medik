let mongoose = require("mongoose");
let router = require("express").Router();
let { OkResponse, BadRequestResponse } = require("express-http-response");

const auth = require("../auth");
const Chat = require("../../models/Chat");
const UserSubscription = require("../../models/UserSubscription");
let Session = mongoose.model("Session");

router.get("/:id", auth.required, auth.patient, async (req, res, next) => {
	try {
		const sessionId = req.params.id;
		const session = await Session.findById(sessionId);
		return next(new OkResponse(session));
	} catch (error) {
		return next(new BadRequestResponse(req.t("session.errors.internalServerError")));
	}
});

router.get("/history/ai-sessions/:id", auth.required, auth.patient, async (req, res, next) => {
	try {
		const userId = req.params.id;
		const sessions = await Session.find({ user: userId }).populate("chat");
		const updatedSessions = sessions.map((session) => {
			console.log("Session chats ", session);
			const answerCount = session.chat
				? session.chat.messages.filter((message) => message.answer && message.answer.trim() !== "").length
				: 0;

			return {
				...session.toObject(),
				answerCount,
			};
		});

		return next(new OkResponse(updatedSessions));
	} catch (error) {
		return next(new BadRequestResponse(req.t("session.errors.internalServerError")));
	}
});

router.get("/history/:sessionId", auth.required, auth.patient, async (req, res, next) => {
	try {
		const { sessionId } = req.params;

		let foundSession = await Session.findOne({ _id: sessionId }).populate("chat");
		if (!foundSession) return next(new BadRequestResponse(req.t("session.errors.sessionNotFound"), 423));
		let findChat = await Chat.findOne({ _id: foundSession.chat }).populate({
			path: "messages.recommendations",
			select: "fullName profileImage specialty -review -wallet -hospitals ", // Only return specific fields
		});
		return next(new OkResponse({ chat: findChat ? findChat.messages : [] }));
	} catch (error) {
		console.error("Error fetching chat history:", error);
		return next(new BadRequestResponse(req.t("session.errors.internalServerError")));
	}
});

router.post("/create", auth.required, auth.patient, async (req, res, next) => {
	
	try {
			if (!req.body || !req.body.question || req.body.question.length === 0) {
					return next(new BadRequestResponse(req.t("session.errors.missingRequiredParameters")));
			}

			// Convert question array into an object format
		   // Convert question array into a plain JavaScript object
			 const questionsMap = {};
			 req.body.question.forEach((qa) => {
				 questionsMap[qa.question.replace(/[.$]/g, "_")] = qa.answer;
			 });
	 


			// Create a new chat document
			const newChat = await Chat.create({
					user: req.user._id,
					messages: [],
			});

			// Create a new session document
			const newSession = await Session.create({
					user: req.user._id,
					patientProfile: {
						questions: questionsMap, // ✅ Now correctly formatted as an object
						symptoms: req.body.problemStatement.symptoms,
							duration: req.body.problemStatement.duration,
							intensity: req.body.problemStatement.intensity,
					},
					chat: newChat._id,
			});

			const subscription = await UserSubscription.findOne({userId: req.user._id});
      if (subscription.aiConsultationsLeft > 0) {
        subscription.aiConsultationsLeft--;
        await subscription.save()
      }

			return next(new OkResponse(newSession));
	} catch (err) {
			console.log("❌ Error:", err.message);
			return next(new BadRequestResponse(req.t("session.errors.internalServerError")));
	}
});

router.delete("/delete/:id", async (req, res, next) => {
	try {
		const sessionId = req.params.id;
		const session = await Session.findById({ _id: sessionId });

		if (!session) {
			return next(new BadRequestResponse(req.t("session.errors.sessionNotFound"), 422.0));
		}

		const chat = await Chat.findById({ _id: session.chat });
		await chat.remove();
		await session.remove();

		return next(new OkResponse(req.t("session.messages.sessionDeleted")));
	} catch (err) {
		return next(new BadRequestResponse(req.t("session.errors.internalServerError")));
	}
});

module.exports = router;
