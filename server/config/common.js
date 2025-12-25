const common = {
  MONGODB_URI: "mongodb://127.0.0.1/factor-medic",
  secret: "secret",
  PORT: 8000,
  host: "",

  smtpAuth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  GoogleApiKey: process.env.GOOGLE_API_KEY,
  GoogleClientID: process.env.GOOGLE_CLIENT_ID,
  GoogleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  OpenAiApiKey: process.env.OPENAI_API_KEY,

  AppleClientID: process.env.APPLE_CLIENT_ID,
  AppleTeamID: process.env.APPLE_TEAM_ID,
  AppleKeyID: process.env.APPLE_KEY_ID,

  ZegoAppId: process.env.ZEGO_APP_ID,
  ZegoServerSecret: process.env.ZEGO_SERVER_SECRET,

  StripeSecretKey: process.env.STRIPE_SECRET_KEY,
  StripeClientId: process.env.STRIPE_CLIENT_ID,
  PublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,

  TwilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
	TwilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
	TwilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
	TwilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  OPEN_AI_KEY: process.env.OPEN_AI_KEY,



  
};

module.exports = common;
