let jwt = require("express-jwt");
let secret = require("../config").secret;
let mongoose = require("mongoose");

let User = mongoose.model("User");
let Hospital = mongoose.model("Hospital");

let UnauthorizedResponse = require("express-http-response").UnauthorizedResponse;
let NotFoundResponse = require("express-http-response").NotFoundResponse;

function getTokenFromHeader(req) {
	if (
		(req.headers.authorization && req.headers.authorization.split(" ")[0] === "Token") ||
		(req.headers.authorization && req.headers.authorization.split(" ")[0] === "Bearer")
	) {
		return req.headers.authorization.split(" ")[1];
	}

	return null;
}

function getLanguageFromHeader(req) {
	if (req.headers.authorization && req.headers["accept-language"]) {
		return req.headers["accept-language"];
	}

	return null;
}

const user = (req, res, next) => {
	User.findById(req.payload.id)
		.then(function (user) {
			if (!user) return next(new UnauthorizedResponse());
			req.user = user;
			next();
		})
		.catch(next);
};

const patient = (req, res, next) => {
	User.findById(req.payload.id)
		.then(function (user) {
			if (!user) return next(new UnauthorizedResponse());
			if (user.role !== "patient") next(new UnauthorizedResponse());
			req.user = user;
			next();
		})
		.catch(next);
};

const hospital = async (req, res, next) => {
	try {
		const user = await User.findById(req.payload.id);
		if (!user) return next(new UnauthorizedResponse("User not found"));

		if (user.role !== "hospital") return next(new UnauthorizedResponse("User is not authorized as hospital"));
		const hospital = await Hospital.findOne({ userId: user._id });
		if (!hospital) return next(new NotFoundResponse("Hospital not found"));

		req.hospital = hospital;
		next();
	} catch (error) {
		next(error);
	}
};

const doctor = (req, res, next) => {
	User.findById(req.payload.id)
		.then(function (user) {
			if (!user) return next(new UnauthorizedResponse());
			if (user.role !== "doctor") next(new UnauthorizedResponse());
			req.user = user;
			next();
		})
		.catch(next);
};

const admin = (req, res, next) => {
	User.findById(req.payload.id)
		.then(function (user) {
			if (!user) return next(new UnauthorizedResponse());
			if (user.role !== "admin") next(new UnauthorizedResponse());
			req.user = user;
			next();
		})
		.catch(next);
};

const auth = {
	required: jwt({
		secret: secret,
		userProperty: "payload",
		getToken: getTokenFromHeader,
	}),
	optional: jwt({
		secret: secret,
		userProperty: "payload",
		credentialsRequired: false,
		getToken: getTokenFromHeader,
	}),
	user,
	patient,
	doctor,
	admin,
	hospital,
};

module.exports = auth;
