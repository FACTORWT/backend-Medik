let mongoose = require("mongoose");
let router = require("express").Router();
let Review = mongoose.model("Review");
let Appointment = mongoose.model("Appointment");
let User = mongoose.model("User");

let auth = require("../auth");
let { OkResponse, BadRequestResponse } = require("express-http-response");

//find review by appointment id
// router.param("appointmentId", (req, res, next, _id) => {
//   Appointment.find({ _id }, (err, appointment) => {
//     if (err) return next(new BadRequestResponse(err));
//     if (!appointment)
//       return next(new BadRequestResponse("appointments not found!", 423));
//     req.appointment = appointment;
//     next();
//   });
// });

router.post("/create", auth.required, auth.patient, async (req, res, next) => {
	if (!!!req.body) return next(new BadRequestResponse(req.t("review.errors.missingRequiredParameter"), 422.0));

	let review = new Review();
	review.rating = req.body.rating;
	review.comment = req.body.comment;
	review.patient = req.body.patient;
	review.doctor = req.body.doctor;
	review.appointment = req.body.appointment;
	review.doctor = req.body.doctor;
	review.isReviewed = true;

	const savedReview = await review.save();

	const updatedUser = await User.findOne({ _id: req.body.doctor });
	updatedUser.review = [...updatedUser.review, savedReview._id];
	await updatedUser.save();

	const reviewedAppointment = await Appointment.findOne({
		_id: req.body.appointment,
	});
	reviewedAppointment.review = savedReview._id;
	await reviewedAppointment.save();

	return next(new OkResponse(req.t("review.messages.reviewCreatedSuccessfully")));
});

//get reviews by doctor id
router.get("/:doctorId", auth.required, async (req, res, next) => {
	try {
		const options = {
			sort: { createdAt: -1 },
		};

		const reviews = await Review.find({ isReviewed: true, doctor: req.params.doctorId }, null, options)
			.populate("patient", "profileImage fullName -review -hospitals -wallet")
			.populate("doctor", "profileImage fullName -review -hospitals -wallet");
		if (!reviews) return next(new BadRequestResponse(req.t("review.errors.reviewsNotFound"), 423));

		return next(new OkResponse(reviews));
	} catch (err) {
		return next(new BadRequestResponse(err.message));
	}
});

router.get("/appointment/:appointmentId", auth.required, async (req, res, next) => {
	try {
		const review = await Review.findOne({ isReviewed: true, appointment: req.params.appointmentId }).populate(
			"patient",
			"profileImage fullName -review -hospitals -wallet"
		);

		return next(new OkResponse(review));
	} catch (err) {
		return next(new BadRequestResponse(err.message));
	}
});

module.exports = router;
