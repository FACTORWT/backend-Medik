let mongoose = require("mongoose");
let router = require("express").Router();
let Appointment = mongoose.model("Appointment");
let auth = require("../auth");
let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { emitEvent } = require("../../utilities/realTime");

router.param("appointmentId", (req, res, next, _id) => {
	Appointment.findOne({ _id }, (err, appointment) => {
		if (err) return next(new BadRequestResponse(req.t("transcription.errors.appointmentNotFound")));
		if (!appointment) return next(new BadRequestResponse(req.t("transcription.errors.appointmentNotFound"), 423));

		req.appointment = appointment;
		next();
	});
});

const validatePatient = (req, res, next) => {
	if (req.appointment.patient._id.toString() !== req.user._id.toString())
		return next(new UnauthorizedResponse(req.t("transcription.errors.unauthorizedAction")));

	next();
};

const validateDoctor = (req, res, next) => {
	if (req.appointment.doctor._id.toString() !== req.user._id.toString())
		return next(new UnauthorizedResponse(req.t("transcription.errors.unauthorizedAction")));

	next();
};

router.put("/update/:appointmentId", auth.required, auth.doctor, validateDoctor, async (req, res, next) => {
	if (!!!req.body) return next(new BadRequestResponse(req.t("transcription.errors.missingRequiredParameters"), 422.0));

	// if (req.appointment.isPrescribed)
	// 	return next(
	// 		new BadRequestResponse(`Appointment is already prescribed. Now you can't update your transcription`, 422.0)
	// 	);

	try {
		req.appointment.transcription = req.body;

		await req.appointment.save();
		emitEvent(`transcription-updated-${req.appointment._id}`, { data: req.appointment.transcription });

		return next(new OkResponse(req.t("transcription.messages.transcriptionUpdated")));
	} catch (error) {
		return next(new BadRequestResponse(req.t("transcription.errors.transcriptionUpdateFailed")));
	}
});

router.delete("/:appointmentId", auth.required, auth.doctor, validateDoctor, async (req, res, next) => {
	try {
		req.appointment.transcription = [];
		req.appointment.transcriptionSummary = "";

		await req.appointment.save();
		emitEvent(`transcription-deleted-${req.appointment._id}`);

		return next(new OkResponse(req.t("transcription.messages.transcriptionDeleted")));
	} catch (error) {
		return next(new BadRequestResponse(req.t("transcription.errors.transcriptionDeletionFailed")));
	}
});

module.exports = router;
