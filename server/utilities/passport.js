let passport = require("passport");
let LocalStrategy = require("passport-local").Strategy;
let mongoose = require("mongoose");
let User = mongoose.model("User");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { backend, GoogleClientSecret, GoogleClientID } = require("../config");
const GOOGLE_CALLBACK_URL = `${backend}/api/externalAuth/google/callback`;

passport.use(
	new LocalStrategy(
		{
			passReqToCallback: true,
			usernameField: "user[email]",
			passwordField: "user[password]",
		},
		(req, email, password, done) => {
			User.findOne({
				email: { $regex: new RegExp("^" + email + "$", "i") },
			})
				.then(function (user) {
					if (!user) return done(null, false, { error: req.t("user.auth.errors.userNotFound") });
					else if (user.role !== req.body.user.role)
						return done(null, false, {
							error: req.t("user.errors.noAssociatedAccount"),
						});
					else if (user.googleId)
						return done(null, false, {
							error: req.t("user.auth.errors.userAlreadyRegisteredWithGoogle"),
						});
					else if (!user.validPassword(password))
						return done(null, false, {
							error: req.t("user.auth.errors.invalidCredentials"),
						});
					return done(null, user);
				})
				.catch(done);
		}
	)
);



passport.use(
	new GoogleStrategy(
		{
			clientID: GoogleClientID,
			clientSecret: GoogleClientSecret,
			callbackURL: GOOGLE_CALLBACK_URL,
			passReqToCallback: false,
		},
		function (accessToken, refreshToken, profile, done) {
			return done(null, profile);
		}
	)
);

