const { TwilioPhoneNumber, TwilioAuthToken, TwilioAccountSid } = require("../config");

const client = require("twilio")(TwilioAccountSid, TwilioAuthToken);

const sendSMS = (body) => {
	const smsPayload = {
		body: body.message,
		from: TwilioPhoneNumber,
		to: body.to,
	};

	client.messages
		.create(smsPayload)
		.then((message) => console.log(message.sid))
		.catch((err) => console.log(err));
};

module.exports = { sendSMS };
