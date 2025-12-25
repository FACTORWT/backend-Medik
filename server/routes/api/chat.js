let mongoose = require("mongoose");
let router = require("express").Router();
const axios = require("axios");
let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { default: fetch } = require("node-fetch");
const {OPEN_AI_KEY} = require("../../config/common");
// import fetch from "node-fetch";

const User = require("../../models/User");
const auth = require("../auth");
const { OPEN_AI_KEY } = require("../../config/common");

let Chat = mongoose.model("Chat");

router.param("slug", (req, res, next, slug) => {
	Chat.findOne({ slug }, (err, chat) => {
		if (!err && chat !== null) {
			req.chat = chat;
			return next();
		}
		return next(new BadRequestResponse(req.t("chat.errors.chatNotFound"), 423));
	});
});

router.param("email", (req, res, next, email) => {
	User.findOne({ email }, (err, user) => {
		if (err) return next(new BadRequestResponse(err));
		if (!user) return next(new BadRequestResponse(req.t("chat.errors.userNotFound"), 423));
		req.foundUser = user;
		return next();
	});
});

router.get("/:slug", (req, res, next) => {
	let chat = req.chat;
	return next(new OkResponse(chat));
});

router.get("/chat-history/:id", (req, res, next) => {
	const userId = req.params.id;
	Chat.find({ sender: userId })
		.then((chats) => {
			if (chats.length == 0) return next(new OkResponse([]));
			return next(new OkResponse(chats));
		})
		.catch((error) => {
			return next(new BadRequestResponse(error.message));
		});
});

router.get("/history/ai-sessions/:id", auth.required, auth.patient, async (req, res, next) => {
	try {
		const userId = req.params.id;
		const sessions = await Chat.find({ sender: userId });
		return next(new OkResponse(sessions));
	} catch (error) {
		return next(new BadRequestResponse(error.message));
	}
});

// router.post("/save-session", auth.required, auth.patient, async (req, res, next) => {
// 	try {
// 		if (!req.body || req.body.length === 0) {
// 			return next(new BadRequestResponse(req.t("chat.errors.missingRequiredParameters"))); // Use req.t()
// 		}

// 		const chatGroupid = mongoose.Types.ObjectId();

// 		const chatPromises = req.body.map(async (qa) => {
// 			const chat = new Chat({
// 				sender: req.user._id,
// 				question: qa.question,
// 				Status: "active",
// 				answer: qa.answer,
// 				chatGroupid: chatGroupid,
// 			});

// 			await chat.save();
// 			return chat;
// 		});

// 		const savedChats = await Promise.all(chatPromises);

// 		return next(new OkResponse(savedChats));
// 	} catch (err) {
// 		return next(new BadRequestResponse(err.message));
// 	}
// });

router.post("/create", async (req, res, next) => {
	try {
		// Check for missing email parameter
		if (!req.body.email) return next(new BadRequestResponse(req.t("chat.errors.missingRequiredParameters"))); // Use req.t()

		// Define request body for OpenAI API
		const requestBody = {
			prompt: "",
			model: "text-davinci-003",
			temperature: 0.7,
			max_tokens: 1000,
			top_p: 1,
			frequency_penalty: 0.0,
			presence_penalty: 0.0,
		};

		// Handle prompt based on previous chat history
		if (req.body.previous == null) {
			requestBody.prompt = `If there is any spanish word in prompt then your language will be spanish other english and You are playing a role of doctor for patients to whom you are answering and have knowledge of everthing included in your domain. You are able to answer in context of some medical disease or any medical disease symptoms  but for out of context or domain questions you've to answer \n 'Sorry! I am trained to be your doctor and can't assist you with that! \n Question: ${req.body.message}' `;
		} else {
			requestBody.prompt = `Here is the previous chat history ${req.body.previous} \n based on previous chat context, If there is any spanish word in prompt then your language will be spanish other english and You are playing a role of doctor for users to whom you are answering and have knowledge of everthing included in your domain. You are able to answer in context of human disease or any human suffering from some medical disease and provided best treatment to cure patient  but for out of context or domain questions you've to answe \n 'Sorry! I am trained to be your doctor and can't assist you with that! \n Question: ${req.body.message}' `;
		}

		// Define fetch options for OpenAI API
		const fetchOptions = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${OPEN_AI_KEY}`,
			},
			body: JSON.stringify(requestBody),
			timeout: 30000,
		};

		// Make the request to OpenAI API
		const response = await fetch("https://api.openai.com/v1/completions", fetchOptions);
		if (!response.ok) {
			throw new Error(req.t("chat.errors.unexpectedError")); // Use req.t()
		}

		const data = await response.json();

		// Find user by email
		const email = req.body.email;
		User.findOne({ email }, async (err, user) => {
			if (err) return next(new BadRequestResponse(err));
			if (!user) return next(new BadRequestResponse(req.t("chat.errors.userNotFound"), 423)); // Use req.t()

			req.foundUser = user;

			// Create new chat session
			const chat = new Chat({
				sender: req.foundUser._id,
				question: req.body.message,
				Status: "active",
				answer: data?.choices[0].text.trim(),
			});

			// If group ID is provided, associate it with the chat
			if (req.body.groupid) {
				chat.chatGroupid = req.body.groupid;
			}

			// Save the chat session
			await chat.save();

			// Respond with the saved chat
			return next(new OkResponse(chat));
		});
	} catch (err) {
		return next(new BadRequestResponse(err.message));
	}
});

router.get("/history/:id", (req, res, next) => {
	const userId = req.params.id;
	const chatGroupIdToExclude = req.query.chatGroupId;

	const query = { sender: userId, chatGroupId: { $ne: chatGroupIdToExclude } };

	Chat.find(query)
		.then((chats) => {
			return next(new OkResponse(chats));
		})
		.catch((error) => {
			return next(new BadRequestResponse(error.message));
		});
});

router.get("/get/group/:groupId", (req, res, next) => {
	const groupId = req.params.groupId;
	Chat.find({ chatGroupid: groupId })
		.then((chats) => {
			return next(new OkResponse(chats));
		})
		.catch((error) => {
			return next(new BadRequestResponse(error.message));
		});
});

router.delete("/del/all/:id", (req, res, next) => {
	let id = mongoose.Types.ObjectId(req.params.id);

	Chat.exists({ sender: id })
		.then((userExists) => {
			if (!userExists) {
				return next(new BadRequestResponse(req.t("chat.errors.userNotFound"))); // Use req.t()
			}

			Chat.deleteMany({ sender: id })
				.then((result) => {
					return next(new OkResponse({ result, message: req.t("chat.messages.chatDeleted") })); // Use req.t()
				})
				.catch((err) => {
					return next(new BadRequestResponse(err.message));
				});
		})
		.catch((err) => {
			return next(new BadRequestResponse(err.message));
		});
});

router.delete("/del/:groupid", (req, res, next) => {
	const groupId = req.params.groupid;

	Chat.deleteMany({ chatGroupid: groupId })
		.then((result) => {
			return next(new OkResponse(result));
		})
		.catch((err) => {
			return next(new BadRequestResponse(err));
		});
});

module.exports = router;
