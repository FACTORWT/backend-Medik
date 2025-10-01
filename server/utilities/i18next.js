const i18next = require("i18next");
const path = require("path");
const Backend = require("i18next-fs-backend");
const LanguageDetector = require("i18next-http-middleware").LanguageDetector;

i18next
	.use(Backend)
	.use(LanguageDetector) // Enable language detection
	.init({
		debug: true,
		fallbackLng: "en",
		preload: ["en", "es"], // List of supported languages
		supportedLngs: ["en", "es"],

		backend: {
			loadPath: path.join(__dirname, "../translation/{{lng}}.json"), // Path to translation files
		},
	});

module.exports = i18next;
