let mongoose = require("mongoose");
let router = require("express").Router();
let Prescription = mongoose.model("Prescription");
let Appointment = mongoose.model("Appointment");
let User = mongoose.model("User");
let auth = require("../auth");
let { OkResponse, BadRequestResponse } = require("express-http-response");
const { emitEvent } = require("../../utilities/realTime");
const { sendNotification, sendPushNotification } = require("../../utilities/notification");
const path = require("path");

const PdfPrinter = require("pdfmake");
const fs = require("fs");
var fonts = {
	Roboto: {
		normal: process.cwd() + "/server/fonts/Roobert-Regular.otf",
		bold: process.cwd() + "/server/fonts/Roobert-Bold.otf",
		italics: process.cwd() + "/server/fonts/Roobert-Regular.otf",
		bolditalics: process.cwd() + "/server/fonts/Roobert-Regular.otf",
	},
};
let printer = new PdfPrinter(fonts);
router.param("id", (req, res, next, _id) => {
	Prescription.findOne({ _id }, (err, prescription) => {
		if (err) return next(new BadRequestResponse(req.t("prescription.errors.internalServerError")));
		if (!prescription) return next(new BadRequestResponse(req.t("prescription.errors.prescriptionNotFound"), 423));
		req.prescription = prescription;
		next();
	});
});

router.get("/", auth.required, auth.user, (req, res, next) => {
	const options = {
		sort: { createdAt: -1 },
	};
	Prescription.find({ appointment: req.query.appointment }, null, options, (err, prescription) => {
		if (!prescription) return next(new BadRequestResponse(req.t("prescription.errors.prescriptionNotFound"), 423));
		if (err) return next(new BadRequestResponse(req.t("prescription.errors.internalServerError")));
		return next(new OkResponse(prescription));
	});
});

router.get("/public", async (req, res, next) => {
	try {
		const options = { sort: { createdAt: -1 } };
		const prescriptions = await Prescription.find({ appointment: req.query.appointment }, null, options)
			.populate({
				path: "appointment",
				populate: {
					path: "doctor",
					populate: {
						path: "hospitals",
						select: "name profileImage address description"
					}
				}
			});
		if (!prescriptions) return next(new BadRequestResponse(req.t("prescription.errors.prescriptionNotFound"), 423));
		return next(new OkResponse(prescriptions));
	} catch (err) {
		return next(new BadRequestResponse(req.t("prescription.errors.internalServerError")));
	}
});
router.get("/patient", auth.required, auth.user, async (req, res, next) => {
	const options = {
		sort: { createdAt: -1 },
	};

	const allPrescriptions = await Prescription.find({ patient: req.user._id });
	if (!allPrescriptions) return next(new BadRequestResponse(req.t("prescription.errors.prescriptionNotFound"), 423));

	return next(new OkResponse(allPrescriptions));
});

router.get("/prescriptions", auth.required, auth.doctor, (req, res, next) => {
	const query = {};
	const options = {
		sort: { createdAt: -1 },
	};
	Prescription.find(query, null, options, (err, prescription) => {
		if (err) return next(new BadRequestResponse(req.t("prescription.errors.internalServerError")));
		return next(new OkResponse(prescription));
	});
});

router.delete("/prescription/:id", auth.required, auth.doctor, async (req, res, next) => {
	try {
		const prescription = await Prescription.findById(req.params.id);

		if (!prescription) {
			return next(new BadRequestResponse(req.t("prescription.errors.prescriptionNotFound"), 422.0));
		}

		const appointmentId = prescription.appointment;
		let appointment = await Appointment.findOne({ _id: appointmentId });

		if (!appointment) return next(new BadRequestResponse(req.t("prescription.errors.appointmentNotFound"), 404.0));

		await prescription.remove();

		return next(new OkResponse(req.t("prescription.messages.prescriptionDeleted")));
	} catch (err) {
		return next(new BadRequestResponse(req.t("prescription.errors.internalServerError")));
	}
});

router.put("/prescription/:id", auth.required, auth.doctor, async (req, res, next) => {
	try {
		if (!req.prescription) {
			return next(new BadRequestResponse(req.t("prescription.errors.prescriptionNotFound"), 422.0));
		}

		req.prescription.tablet = req.body.tablet;
		req.prescription.strength = req.body.strength;
		req.prescription.howLong = req.body.howLong;
		req.prescription.howMany = req.body.howMany;
		req.prescription.appointment._id = req.body.appointment;
		req.prescription.remarks = req.body.remarks;

		await req.prescription.save();
		await sendNotification(
			"Prescription has been added to the appointment",
			`Hi ${req.prescription.appointment.patientName}, your medical prescription has been set by ${req.prescription.appointment.doctorName}.`,
			`Hola ${req.prescription.appointment.patientName}, tu receta médica ha sido establecida por ${req.prescription.appointment.doctorName}.`,
			req.prescription.appointment?.patient?._id,
			req.prescription.appointment?.doctor?._id,
			req.body.appointment,
			{
				appointmentId: req.prescription.appointment._id,
				prescriptionId: req.prescription?._id,
			}
		);
		sendPushNotification(
			req.t("prescription.messages.prescriptionAdded"),
			`Hi ${req.prescription.appointment.patientName}, your medical prescription has been set by ${req.prescription.appointment.doctorName}.`,
			req.prescription.appointment?.patient?._id
		);
		return next(new OkResponse(req.prescription));
	} catch (err) {
		return next(new BadRequestResponse(req.t("prescription.errors.internalServerError")));
	}
});

router.post("/create", auth.required, auth.doctor, async (req, res, next) => {
	try {
		if (!req.body) {
			throw new BadRequestResponse(req.t("prescription.errors.missingRequiredParameters"), 422.0);
		}

		const { tablet, strength, howLong, howMany, appointment: appointmentId, remarks } = req.body;

		let appointment = await Appointment.findOne({ _id: appointmentId });

		if (!appointment) {
			throw new BadRequestResponse(req.t("prescription.errors.appointmentNotFound"), 404.0);
		}

		// if (appointment.status === "completed") {
		// 	throw new BadRequestResponse(req.t("prescription.errors.invalidAction"), 423);
		// }
		const prescription = new Prescription({
			tablet,
			strength,
			howLong,
			howMany,
			appointment: appointmentId,
			patient: appointment.patient,
			doctor: appointment.doctor,
			remarks,
		});

		const savedPrescription = await prescription.save();
		console.log("Patient if=d for prescription is", appointment.doctor);
		await sendNotification(
			"Prescription has been added to the appointment",
			`Hi ${appointment.patientName}, your medical prescription has been set by ${appointment.doctorName}.`,
			`Hola ${appointment.patientName}, tu receta médica ha sido establecida por ${appointment.doctorName}.`,
			appointment.patient._id,
			appointment.doctor._id,
			appointmentId,
			{ appointmentId: appointment._id, prescriptionId: savedPrescription?._id }
		);

		sendPushNotification(
			req.t("prescription.messages.prescriptionAdded"),

			`Hi ${appointment.patientName}, your medical prescription has been set by ${appointment.doctorName}.`,
			appointment.patient._id
		);

		if (!appointment.isPrescribed) {
			appointment.isPrescribed = true;
			await appointment.save();

			emitEvent(`appointment-prescribed-${appointment.patient._id}`, {
				appointmentId: appointment._id,
			});
		}

		return next(new OkResponse(savedPrescription));
	} catch (error) {
		return next(new BadRequestResponse(error.message));
	}
});

//old api

router.post("/generate/pdf", async (req, res, next) => {
	console.log("Generating pdf...");
	const appointmentId = req.body.appointmentID;

	// Ensure the ID is a valid MongoDB ObjectId
	if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
		return res.status(400).send(req.t("prescription.errors.invalidAction"));
	}

	try {
		const prescriptions = await Prescription.find({
			appointment: appointmentId,
		});
		if (!prescriptions.length) {
			return res.status(404).send(req.t("prescription.errors.prescriptionNotFound"));
		}

		const appointment = await Appointment.findById(appointmentId)
			.populate({
				path: "patient",
				select: "fullName sex birthDate",
			})
			.populate({
				path: "doctor",
				select: "fullName specialty education email",
			})
			.lean()
			.exec();

		const doctor = appointment.doctor;
		const patient = appointment.patient;
		const doctorName = doctor.fullName;
		const specialty = doctor?.specialty;
		const education = doctor?.education.map((edu) => edu.title).join(",");
		const doctorEmail = doctor?.email;
		const patientName = patient.fullName;
		const patientSex = patient.sex;
		const birthDate = patient.birthDate;
		console.log(doctorName, specialty, education, doctorEmail, patientName, patientSex, birthDate);

		let age;
		if (birthDate) {
			const parts = birthDate?.split("-");
			// Ensure we have 3 parts (day, month, year)
			if (parts?.length !== 3) {
				return NaN; // Invalid date format
			}

			const day = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10) - 1; // Months are zero-based
			const year = parseInt(parts[2], 10);

			const today = new Date();
			const birth = new Date(year, month, day); // Create a Date object

			age = today.getFullYear() - birth.getFullYear();
			const monthDiff = today.getMonth() - birth.getMonth();

			if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
				age--;
			}
		}

		let serialNumber = 1;
		const tableBody = prescriptions.map((presc, index) => {
			const morning = presc.howMany.morning || 0;
			const afternoon = presc.howMany.afternoon || 0;
			const evening = presc.howMany.evening || 0;
			const total = morning + afternoon + evening;

			return [
				{ text: "  ", style: "tableCell" }, // Serial number
				{ text: serialNumber++, style: "tableCell" }, // Serial number
				{ text: presc.tablet, style: "tableCell" },
				{ text: presc.strength, style: "tableCell" },
				{ text: presc.howLong, style: "tableCell" },
				{ text: total > 0 ? `${morning}` : "", style: "tableCell" },
				{ text: total > 0 ? `${afternoon}` : "", style: "tableCell" },
				{ text: total > 0 ? `${evening}` : "", style: "tableCell" },
				{ text: "  ", style: "tableCell" },
			];
		});

		const path = process.cwd() + "/server/pdf/" + appointmentId + ".pdf";
		const name = appointmentId + ".pdf";
		// process.cwd() + "/client/public/assets/logo-light.png";

		// if (fs.existsSync(path)) {
		// 	fs.unlinkSync(path);
		// }

		const docDefinition = {
			content: [
				{
					columns: [
						[
							{
								text: `Doctor ${doctorName}`,
								style: "header",
							},
							{
								text: `${education}`,
								style: "subHeader",
							},
							{
								text: `${specialty}`,
								style: "subHeader",
							},
							{
								text: `${doctorEmail}`,
								style: "email",
							},
						],
						{
							// Empty column to push the logo to the right
							width: "*",
							text: "",
						},
						// {
						//   // Logo placed on the right
						//   image:
						//     process.cwd() + "/client/public/assets/images/App-Store.png",
						//   width: 100,
						//   alignment: "right",
						// },
					],
					margin: [0, 0, 0, 20],
				},
				{
					columns: [
						{
							table: {
								body: [
									[{ text: "Name:" }, { text: patientName, alignment: "right" }],
									[{ text: "Age:" }, { text: age, alignment: "right" }],
									[{ text: "Gender:" }, { text: patientSex, alignment: "right" }],
								],
							},
							style: "patientInfo",
							layout: "noBorders",
						},
						{
							style: "tableExample",
							table: {
								headerRows: 1,
								widths: ["auto", "auto", "*", "auto", "auto", "auto", "auto", "auto", "auto"],
								body: [
									[
										{ text: "  ", style: "tableHeader" },
										{ text: "S:NO", style: "tableHeader" },
										{ text: "TABLET", style: "tableHeader" },
										{ text: "STRENGTH", style: "tableHeader" },
										{ text: "DAYS", style: "tableHeader" },
										{ text: "MORNING", style: "tableHeader" },
										{ text: "AFTERNOON", style: "tableHeader" },
										{ text: "EVENING", style: "tableHeader" },
										{ text: "  ", style: "tableHeader" },
									],
									...tableBody,
								],
							},
							layout: "noBorders",
							width: "auto",
						},
					],
					margin: [0, 0, 0, 20],
				},
			],
			styles: {
				header: {
					fontSize: 18,
					bold: true,
					alignment: "left",
					margin: [0, 0, 0, 5],
				},
				subHeader: {
					fontSize: 12,
					alignment: "left",
					margin: [0, 0, 0, 5],
				},
				email: {
					fontSize: 12,
					alignment: "left",

					margin: [0, 0, 0, 20],
				},
				patientInfo: {
					margin: [0, 0, 0, 20],
					fontSize: 8,
					maxWidth: 200,
				},
				tableExample: {
					margin: [20, 5, 0, 15],
					padding: 5,
				},
				tableHeader: {
					fillColor: "#00CCBE",
					color: "white",
					padding: [0, 5],
					margin: [0, 5],
					fontSize: 10,
				},
				tableCell: {
					margin: [0, 5],
					fontSize: 8,
				},
			},
			defaultStyle: {
				columnGap: 5,
			},
		};

		let pdfDoc = printer.createPdfKitDocument(docDefinition, {});
		pdfDoc.pipe(
			fs.createWriteStream(path).on("finish", () => {
				console.log("Finieshed");
				return res.send({ name });
			})
		);
		pdfDoc.end();
	} catch (error) {
		console.error("Error generating PDF:", error);
		res.status(500).send(req.t("prescription.errors.internalServerError"));
	}
	// return next(new OkResponse(`${appointmentId}.pdf`));
});

router.get("/get/pdf/:name", (req, res, next) => {
	let path = process.cwd() + "/server/pdf/" + req.params.name;
	console.log("Path--->", path);
	return res.sendFile(path);
});

module.exports = router;
