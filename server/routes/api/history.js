let { OkResponse, BadRequestResponse, NotFoundResponse } = require("express-http-response");
let mongoose = require("mongoose");
let router = require("express").Router();
let User = mongoose.model("User");

let auth = require("../auth");
const UserSubscription = require("../../models/UserSubscription");
let History = mongoose.model("History");

router.get("/:userId", auth.required, async (req, res, next) => {
	const { userId } = req.params;

	console.log("Patient Id");

	try {
		const history = await History.findOne({ patient: userId }).populate({
			path: "patient",
			select: "fullName age sex birthDate",
		});

		if (!history) return next(new NotFoundResponse(req.t("history.errors.historyNotFound")));

		return next(new OkResponse(history));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/lifeStyle", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		// Check if the user exists in the User collection
		const userExists = await User.findById(userId);
		if (!userExists) {
			return next(new NotFoundResponse(req.t("user.errors.userNotFound")));
		}

		const existingHistory = await History.findOne({ patient: userId });
		const update = {
			patient: userId,
			sleepPattern: {
				duration: parseInt(req.body.sleepDuration, 10),
				quality: req.body.sleepQuality,
			},
			diet: {
				restrictions: req.body.dietaryRestrictions,
				habits: req.body.eatingHabits,
			},
			exerciseRoutine: {
				activity: req.body.activityLevel,
				stressLevel: req.body.stressLevel,
				otherDetails: req.body.otherDetails || "",
			},
		};

		let result;
		if (existingHistory) {
			result = await History.findByIdAndUpdate(existingHistory._id, { $set: update }, { new: true });
		} else {
			// Create a new history document
			const newHistory = new History(update);
			result = await newHistory.save();
		}
		// return next(new OkResponse(result, req.t("history.messages.historyCreated", { lng: language })));

		return next(new OkResponse(result, req.t("history.messages.historyCreated")));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/diagnose", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const userExists = await User.findById(userId);
		if (!userExists) {
			return next(new NotFoundResponse(req.t("user.errors.userNotFound")));
		}

		const existingHistory = await History.findOne({ patient: userId });

		let result;
		if (existingHistory) {
			existingHistory.diagnoses.push(req.body);
			result = await existingHistory.save();
		} else {
			const newHistory = new History({
				patient: userId,
				diagnoses: [req.body],
			});
			result = await newHistory.save();
		}

		return next(new OkResponse(result.diagnoses));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/diagnose", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const diagnosisIndex = existingHistory.diagnoses.findIndex(
			(diagnosis) => diagnosis._id.toString() === req.body._id
		);

		if (diagnosisIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.diagnosisNotFound")));
		}

		existingHistory.diagnoses[diagnosisIndex].name = req.body.name || existingHistory.diagnoses[diagnosisIndex].name;
		existingHistory.diagnoses[diagnosisIndex].year = req.body.year || existingHistory.diagnoses[diagnosisIndex].year;
		existingHistory.diagnoses[diagnosisIndex].details =
			req.body.details || existingHistory.diagnoses[diagnosisIndex].details;

		const result = await existingHistory.save();

		return next(new OkResponse(result.diagnoses));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.delete("/diagnose/:id", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;
	const diagnoseId = req.params.id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const diagnosisIndex = existingHistory.diagnoses.findIndex((diagnosis) => diagnosis._id.toString() === diagnoseId);

		if (diagnosisIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.diagnosisNotFound")));
		}

		existingHistory.diagnoses.splice(diagnosisIndex, 1);
		const result = await existingHistory.save();

		return next(new OkResponse(result.diagnoses));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/prescription", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		let result;
		if (existingHistory) {
			existingHistory.prescriptions.push(req.body);
			result = await existingHistory.save();
		} else {
			const newHistory = new History({
				patient: userId,
				prescriptions: [req.body],
			});
			result = await newHistory.save();
		}

		return next(new OkResponse(result.prescriptions));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/prescription", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const prescriptionIndex = existingHistory.prescriptions.findIndex(
			(prescription) => prescription._id.toString() === req.body._id
		);

		if (prescriptionIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.prescriptionNotFound")));
		}

		existingHistory.prescriptions[prescriptionIndex].tablet =
			req.body.tablet || existingHistory.prescriptions[prescriptionIndex].name;
		existingHistory.prescriptions[prescriptionIndex].strength =
			req.body.strength || existingHistory.prescriptions[prescriptionIndex].strength;
		existingHistory.prescriptions[prescriptionIndex].howLong =
			req.body.howLong || existingHistory.prescriptions[prescriptionIndex].howLong;
		existingHistory.prescriptions[prescriptionIndex].howMany =
			req.body.howMany || existingHistory.prescriptions[prescriptionIndex].howMany;

		const result = await existingHistory.save();

		return next(new OkResponse(result.prescriptions));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.delete("/prescription/:id", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;
	const prescriptionId = req.params.id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const prescriptionIndex = existingHistory.prescriptions.findIndex(
			(prescription) => prescription._id.toString() === prescriptionId
		);

		if (prescriptionIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.prescriptionNotFound")));
		}

		existingHistory.prescriptions.splice(prescriptionIndex, 1);
		const result = await existingHistory.save();

		return next(new OkResponse(result.prescriptions));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/vaccination", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		let result;
		if (existingHistory) {
			existingHistory.vaccinations.push(req.body);
			result = await existingHistory.save();
		} else {
			const newHistory = new History({
				patient: userId,
				vaccinations: [req.body],
			});
			result = await newHistory.save();
		}

		return next(new OkResponse(result.vaccinations));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/vaccination", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const vaccinationIndex = existingHistory.vaccinations.findIndex(
			(vaccination) => vaccination._id.toString() === req.body._id
		);

		if (vaccinationIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.vaccinationNotFound")));
		}

		existingHistory.vaccinations[vaccinationIndex].name =
			req.body.name || existingHistory.vaccinations[vaccinationIndex].name;
		existingHistory.vaccinations[vaccinationIndex].year =
			req.body.year || existingHistory.vaccinations[vaccinationIndex].year;

		const result = await existingHistory.save();

		return next(new OkResponse(result.vaccinations));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.delete("/vaccination/:id", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;
	const vaccinationId = req.params.id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const vaccinationIndex = existingHistory.vaccinations.findIndex(
			(vaccination) => vaccination._id.toString() === vaccinationId
		);

		if (vaccinationIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.vaccinationNotFound")));
		}

		existingHistory.vaccinations.splice(vaccinationIndex, 1);
		const result = await existingHistory.save();

		return next(new OkResponse(result.vaccinations));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/allergy", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		let result;
		if (existingHistory) {
			existingHistory.allergies.push(req.body);
			result = await existingHistory.save();
		} else {
			const newHistory = new History({
				patient: userId,
				allergies: [req.body],
			});
			result = await newHistory.save();
		}

		return next(new OkResponse(result.allergies));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/allergy", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });
		const allergyIndex = existingHistory.allergies.findIndex(
			(allergy) => allergy._id && allergy._id.toString() === req.body._id
		);

		if (allergyIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.allergyNotFound")));
		}

		const allergyItem = existingHistory.allergies[allergyIndex];

		if (req.body.name !== undefined) {
			allergyItem.name = req.body.name;
		}

		const result = await existingHistory.save();

		return next(new OkResponse(result.allergies));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.delete("/allergy/:id", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;
	const allergyId = req.params.id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const allergyIndex = existingHistory.allergies.findIndex(
			(allergy) => allergy._id && allergy._id.toString() === allergyId
		);

		if (allergyIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.allergyNotFound")));
		}

		existingHistory.allergies.splice(allergyIndex, 1);
		const result = await existingHistory.save();

		return next(new OkResponse(result.allergies));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/radiology", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		let result;
		if (existingHistory) {
			existingHistory.radiology.push(req.body);
			result = await existingHistory.save();
		} else {
			const newHistory = new History({
				patient: userId,
				radiology: [req.body],
			});
			result = await newHistory.save();
		}

    const foundSubscription = await UserSubscription.findOne({ userId: userId }).populate("plan");
		if(foundSubscription && foundSubscription.plan &&  foundSubscription.plan.type === "free"){
			foundSubscription.medicalReportsLeft--
		}
		await foundSubscription.save()

		return next(new OkResponse(result.radiology));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/radiology/share", auth.required, auth.patient, async (req, res, next) => {
	
	try {

		// 


	

		const { image,  expirationHours } = req.body;

		const objectKey = image.split('/uploads/').pop();


		const bucketName = process.env.AWS_S3_BUCKET;
	
		const shareableUrl = await generatePresignedUrl(
		  bucketName, 
		  objectKey, 
		  expirationHours || 72
		);
		console.log("shareableUrl" , shareableUrl)

		return next(new OkResponse(result.shareableUrl));
	
	

		

		return next(new OkResponse(result.radiology));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/radiology", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const radiologyIndex = existingHistory.radiology.findIndex((rad) => rad._id && rad._id.toString() === req.body._id);

		if (radiologyIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.radiologyNotFound")));
		}

		const radiologyItem = existingHistory.radiology[radiologyIndex];

		if (req.body.name !== undefined) {
			radiologyItem.name = req.body.name;
		}
		if (req.body.images !== undefined) {
			radiologyItem.images = req.body.images;
		}

		const result = await existingHistory.save();

		return next(new OkResponse(result.radiology));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.delete("/radiology/:id", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;
	const radiologyId = req.params.id;
	try {
		const existingHistory = await History.findOne({ patient: userId });

		const radiologyIndex = existingHistory.radiology.findIndex(
			(radiologyItem) => radiologyItem._id && radiologyItem._id.toString() === radiologyId
		);

		if (radiologyIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.radiologyNotFound")));
		}

		existingHistory.radiology.splice(radiologyIndex, 1);
		const result = await existingHistory.save();

		return next(new OkResponse(result.radiology));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.post("/laboratory", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		let result;
		if (existingHistory) {
			existingHistory.laboratory.push(req.body);
			result = await existingHistory.save();
		} else {
			const newHistory = new History({
				patient: userId,
				laboratory: [req.body],
			});
			result = await newHistory.save();
		}

    const foundSubscription = await UserSubscription.findOne({ userId: userId }).populate("plan");
		if(foundSubscription && foundSubscription.plan &&  foundSubscription.plan.type === "free"){
			foundSubscription.medicalReportsLeft--
		}
		await foundSubscription.save()

		return next(new OkResponse(result.laboratory));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.put("/laboratory", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const laboratoryIndex = existingHistory.laboratory.findIndex(
			(lab) => lab._id && lab._id.toString() === req.body._id
		);

		if (laboratoryIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.labTestNotFound")));
		}

		const laboratoryItem = existingHistory.laboratory[laboratoryIndex];

		if (req.body.name !== undefined) {
			laboratoryItem.name = req.body.name;
		}
		if (req.body.attachment !== undefined) {
			laboratoryItem.attachment = req.body.attachment;
		}

		const result = await existingHistory.save();

		return next(new OkResponse(result.laboratory));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

router.delete("/laboratory/:id", auth.required, auth.patient, async (req, res, next) => {
	const userId = req.user._id;
	const laboratoryId = req.params.id;

	try {
		const existingHistory = await History.findOne({ patient: userId });

		const laboratoryIndex = existingHistory.laboratory.findIndex((lab) => lab._id.toString() === laboratoryId);

		if (laboratoryIndex === -1) {
			return next(new NotFoundResponse(req.t("history.errors.labTestNotFound")));
		}

		existingHistory.laboratory.splice(laboratoryIndex, 1);
		const result = await existingHistory.save();

		return next(new OkResponse(result.laboratory));
	} catch (error) {
		console.log("Error", error);
		return next(new BadRequestResponse(req.t("history.errors.unexpectedError")));
	}
});

module.exports = router;
