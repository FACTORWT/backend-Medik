let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");

let PrescriptionSchema = new mongoose.Schema(
	{
		tablet: { type: String, default: "" },
		strength: { type: String, default: "" },
		howLong: { type: String, default: "" },
		howMany: { morning: 0, afternoon: 0, evening: 0 },
		remarks: { type: String },
		appointment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Appointment",
		},
		patient: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Patient",
		},
		doctor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Doctor",
		},
	},
	{ timestamps: true }
);

const autoPopulate = function (next) {
	this.populate("appointment");

	next();
};

PrescriptionSchema.pre("findOne", autoPopulate);
PrescriptionSchema.pre("find", autoPopulate);

PrescriptionSchema.methods.toAuthJSON = function () {
	return {
		_id: this._id,
		tablet: this.tablet,
		strength: this.strength,
		howMany: this.howMany,
		howLong: this.howLong,
		frequency: this.frequency,
		remarks: this.remarks,
		appointment: this.appointment,
	};
};

module.exports = mongoose.model("Prescription", PrescriptionSchema);
