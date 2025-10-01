let Notification = require("../models/Notification");
let User = require("../models/User");
let firebase = require("firebase-admin");
let serviceAccount = require("../config/firebase-config");
firebase.initializeApp({
	credential: firebase.credential.cert(serviceAccount),
});

exports.sendNotification = async (title, description, spanish, sentTo, sentBy, appointment, data, hospital) => {
	factorMedicSocket.emit("notify-" + sentTo);
	try {
		await new Notification({
			title: title,
			description: description,
			spanish: spanish,
			sentTo: sentTo,
			sentBy: sentBy,
			appointment: appointment,
			hospital: hospital,
			data: data,
		}).save();
	} catch (error) {
		console.log("Error in sendNotification", error);
	}
};

exports.sendPushNotification = async (title, body, userId) => {
	try {
		const user = await User.findById(userId);
		if (!user) {
			console.error(`User not found: ${userId}`);
			return;
		}

		const deviceToken = user.notificationToken;

		if (!deviceToken) {
			console.error(`Device token not available for user: ${userId}`);
			return;
		}

		const message = {
			token: deviceToken,
			notification: {
				title: title,
				body: body,
			},
			android: {
				priority: "high",
			},
			apns: {
				payload: {
					aps: {
						alert: {
							title: title,
							body: body,
						},
						sound: "default",
					},
				},
			},
		};

		const response = await firebase.messaging().send(message);
		console.log("Successfully sent message to user:", userId, response);
	} catch (error) {
		console.error("Error sending message to user:", userId, error.message);
	}
};
