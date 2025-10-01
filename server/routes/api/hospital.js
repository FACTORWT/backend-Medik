let mongoose = require("mongoose");
let router = require("express").Router();
const User = require("../../models/User");
const Hospital = require("../../models/Hospital");
let auth = require("../auth");
const { emitEvent } = require("../../utilities/realTime");
let { OkResponse, BadRequestResponse } = require("express-http-response");
const { sendNotification, sendPushNotification } = require("../../utilities/notification");

router.get("/one/:_id", auth.required, async (req, res, next) => {
	try {
		const findHospital = await Hospital.findOne({ _id: req.params._id });
		if (!findHospital) {
			return next(new BadRequestResponse(req.t("hospital.errors.hospitalNotFound")));
		}

		return next(new OkResponse(findHospital));
	} catch (error) {
		return next(new BadRequestResponse(req.t("hospital.generic.error")));
	}
});

router.post("/equipment", auth.required, auth.hospital, (req, res, next) => {
	if (!!!req.body) return next(new BadRequestResponse(req.t("hospital.errors.missingRequiredParameters"), 422.0));

	req.hospital.equipments = [...req.hospital.equipments, req.body];

	req.hospital.save((err, data) => {
		if (err) return next(new BadRequestResponse(req.t("hospital.generic.error")));
		return next(new OkResponse(data.toAuthJSON()));
	});
});

router.put("/equipment/:equipmentId", auth.required, auth.hospital, (req, res, next) => {
	if (!!!req.body) return next(new BadRequestResponse(req.t("hospital.errors.missingRequiredParameters"), 422.0));

	const index = req.hospital.equipments.findIndex((item) => item._id.toString() === req.params.equipmentId.toString());
	req.hospital.equipments[index] = req.body;

	req.hospital.save((err, data) => {
		if (err) return next(new BadRequestResponse(req.t("hospital.generic.error")));
		return next(new OkResponse(data.toAuthJSON()));
	});
});

router.delete("/equipment/:equipmentId", auth.required, auth.hospital, (req, res, next) => {
	const index = req.hospital.equipments.findIndex(
		(equip) => equip._id.toString() === req.params.equipmentId.toString()
	);
	if (index === -1) return next(new BadRequestResponse(req.t("hospital.errors.equipmentNotFound"), 422.0));
	req.hospital.equipments.splice(index, 1);

	req.hospital.save((err, data) => {
		if (err) return next(new BadRequestResponse(req.t("hospital.generic.error")));
		return next(new OkResponse(data.toAuthJSON()));
	});
});

router.post("/recognition", auth.required, auth.hospital, (req, res, next) => {
	if (!!!req.body) return next(new BadRequestResponse(req.t("hospital.errors.missingRequiredParameters"), 422.0));

	req.hospital.recognition = [...req.hospital.recognition, req.body];

	req.hospital.save((err, data) => {
		if (err) return next(new BadRequestResponse(req.t("hospital.generic.error")));
		return next(new OkResponse(data.toAuthJSON()));
	});
});

router.put("/recognition/:recognitionId", auth.required, auth.hospital, (req, res, next) => {
	if (!!!req.body) return next(new BadRequestResponse(req.t("hospital.errors.missingRequiredParameters"), 422.0));

	const index = req.hospital.recognition.findIndex(
		(item) => item._id.toString() === req.params.recognitionId.toString()
	);
	req.hospital.recognition[index] = req.body;

	req.hospital.save((err, data) => {
		if (err) return next(new BadRequestResponse(req.t("hospital.generic.error")));
		return next(new OkResponse(data.toAuthJSON()));
	});
});

router.delete("/recognition/:recognitionId", auth.required, auth.hospital, (req, res, next) => {
	const index = req.hospital.recognition.findIndex(
		(equip) => equip._id.toString() === req.params.recognitionId.toString()
	);
	if (index === -1) return next(new BadRequestResponse(req.t("hospital.errors.equipmentNotFound"), 422.0));
	req.hospital.recognition.splice(index, 1);

	req.hospital.save((err, data) => {
		if (err) return next(new BadRequestResponse(req.t("hospital.generic.error")));
		return next(new OkResponse(data.toAuthJSON()));
	});
});

router.put("/update-hospital", auth.required, auth.hospital, async (req, res, next) => {
	try {
		if (!!req.body.profileImage) {
			const user = await User.findById(req.hospital.userId);
			user.profileImage = req.body.profileImage;
			await user.save();
		}

		if (Array.isArray(req.body.specialties)) {
			req.body.specialties = req.body.specialties.map((specialty) => specialty._id || specialty);
		}
		req.hospital.profileImage = req.body.profileImage || req.hospital.profileImage;
		req.hospital.specialties = req.body.specialties || req.hospital.specialties;
		req.hospital.license = req.body.license || req.hospital.license;
		req.hospital.certificate = req.body.certificate || req.hospital.certificate;
		req.hospital.images = req.body.images || req.hospital.images;
		req.hospital.name = req.body.name || req.hospital.name;
		req.hospital.description = req.body.description || req.hospital.description;
		req.hospital.website = req.body.website || req.hospital.website;
		req.hospital.representative = req.body.representative || req.hospital.representative;
		req.hospital.phone = req.body.phone || req.hospital.phone;
		req.hospital.address = req.body.address || req.hospital.address;
		req.hospital.equipments = req.body.equipments || req.hospital.equipments;
		req.hospital.recognition = req.body.recognition || req.hospital.recognition;

		req.hospital.save((err, hospital) => {
			if (err) {
				return next(new BadRequestResponse(req.t("hospital.generic.error")));
			}
			return next(new OkResponse(hospital.toJSON()));
		});
	} catch (error) {
		console.log(error);
		return next(error);
	}
});

router.get("/doctors-search", auth.required, auth.hospital, async (req, res, next) => {
	try {
		const { searchDoctor, searchEmail, page = 1, limit = 10 } = req.query;
		const filter = { role: "doctor", profileCompletionStatus: 4 };

		if (searchDoctor) {
			filter.fullName = { $regex: new RegExp(searchDoctor, "i") };
		}
		if (searchEmail) {
			filter.email = { $regex: new RegExp(searchEmail, "i") };
		}

		const options = {
			sort: { createdAt: -1 },
			skip: (page - 1) * limit,
			limit: parseInt(limit),
		};

		const [doctors, total] = await Promise.all([User.find(filter, null, options), User.countDocuments(filter)]);

		// Get the IDs of doctors associated with the hospital
		const hospitalDoctorIds = req.hospital.doctors.map((doctor) => doctor.doctor._id);

		// Add a flag indicating whether each doctor is associated with the hospital
		const doctorsWithAddedFlag = doctors.map((doctor) => ({
			...doctor.toObject(),
			added: hospitalDoctorIds.includes(doctor._id.toString()),
		}));

		return next(new OkResponse({ doctors: doctorsWithAddedFlag, total }));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(req.t("hospital.generic.error")));
	}
});

router.put("/association/:doctorId", auth.required, auth.hospital, async (req, res, next) => {
	try {
		const doctorId = req.params.doctorId;

		const isDoctorAssociated = req.hospital.doctors.some((item) => item.doctor === doctorId.toString());

		if (isDoctorAssociated) {
			return next(new BadRequestResponse(req.t("hospital.errors.doctorAlreadyAssociated")));
		}
		req.hospital.doctors.push({ doctor: doctorId, status: "pending" });

		const savedHospital = await req.hospital.save();

		await sendNotification(
			"Hospital request",
			`${req.hospital.name} has requested to add you in their hospital`,
			`${req.hospital.name} ha solicitado añadirte a su hospital.`,
			doctorId,
			savedHospital._id,
			savedHospital._id,
			savedHospital._id,
			savedHospital._id
		);

		await sendPushNotification(
			"Hospital request",
			`${req.hospital.name} has requested to add you in their hospital`,
			doctorId
		);

		return next(new OkResponse(savedHospital.toAuthJSON()));
	} catch (err) {
		return next(new BadRequestResponse(req.t("hospital.generic.error")));
	}
});

router.put("/status-association/:hospitalId", auth.required, async (req, res, next) => {
	try {
		const hospitalId = req.params.hospitalId;
		const doctorId = req.payload.id;

		const hospital = await Hospital.findById(hospitalId);
		if (!hospital) {
			return next(new BadRequestResponse(req.t("hospital.errors.hospitalNotFound")));
		}

		const association = hospital.doctors.find((item) => item.doctor._id.toString() === doctorId);
		if (!association) {
			return next(new BadRequestResponse(req.t("hospital.errors.associationNotFound")));
		}

		const action = req.body.action;
		if (action === "approve") {
			association.status = "approved";

			// Save the hospital document
			const newHospital = await hospital.save();

			// Add the hospital to the doctor's list of associated hospitals
			const doctor = await User.findById(doctorId);
			if (doctor) {
				doctor.hospitals.push(hospitalId);
				await doctor.save();
			} else {
				return next(new BadRequestResponse(req.t("hospital.errors.doctorNotFound")));
			}

			emitEvent(`request-status-for-${newHospital.userId}`);

			return next(new OkResponse(newHospital));
		} else if (action === "reject") {
			association.status = "rejected";

			// Save the hospital document
			const newHospital = await hospital.save();

			// Emit event for rejected association
			emitEvent(`request-status-for-${newHospital.userId}`);

			return next(new OkResponse(newHospital));
		} else {
			return next(new BadRequestResponse(req.t("hospital.errors.invalidAction")));
		}
	} catch (err) {
		return next(new BadRequestResponse(req.t("hospital.generic.error")));
	}
});

router.delete("/remove-association/:doctorId", auth.required, auth.hospital, async (req, res, next) => {
	try {
		const doctorId = req.params.doctorId;

		// Find the index of the association in the hospital's doctors array
		const index = req.hospital.doctors.findIndex((association) => association.doctor.equals(doctorId));
		if (index === -1) {
			return next(new BadRequestResponse(req.t("hospital.errors.associationNotFound"), 422));
		}

		// Remove the association from the hospital's doctors array
		req.hospital.doctors.splice(index, 1);

		// Save changes to the hospital
		const savedHospital = await req.hospital.save();

		// Find the associated user (doctor)
		const user = await User.findById(doctorId);
		if (!user) {
			return next(new BadRequestResponse(req.t("hospital.errors.doctorNotFound"), 422));
		}

		// Find the index of the hospital in the user's hospitals array
		const hospitalIndex = user.hospitals.findIndex((hospital) => hospital.equals(req.hospital._id));
		if (hospitalIndex !== -1) {
			user.hospitals.splice(hospitalIndex, 1);

			await user.save();
		}

		// Remove the hospital from the user's hospitals array

		return next(new OkResponse(savedHospital.toAuthJSON()));
	} catch (err) {
		console.error("Error removing association:", err);
		return next(new BadRequestResponse(req.t("hospital.generic.error"), 500));
	}
});

router.get("/associated-doctors", auth.required, auth.hospital, async (req, res, next) => {
	try {
		const hospital = req.hospital;

		const doctorIds = hospital.doctors?.map((item) => item?.doctor?._id);

		const doctors = await User.find({ _id: { $in: doctorIds } });

		const doctorsWithStatus = doctors.map((doctor) => {
			const hospitalDoctor = hospital?.doctors?.find((item) => item?.doctor?.equals(doctor._id));

			if (hospitalDoctor) {
				return {
					...doctor.toObject(),
					associationStatus: hospitalDoctor.status,
				};
			} else {
				return {
					...doctor.toObject(),
					associationStatus: "pending",
				};
			}
		});

		return next(new OkResponse(doctorsWithStatus));
	} catch (err) {
		console.log("error", err);
		return next(new BadRequestResponse(req.t("hospital.generic.error")));
	}
});

module.exports = router;
