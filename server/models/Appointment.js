let mongoose = require("mongoose");

let AppointmentSchema = new mongoose.Schema(
  {
    patientName: { type: String, default: "" },
    age: { type: String, default: "" },
    relation: { type: String, default: "" },
    phone: { type: String, default: "" },
    details: { type: String, default: "" },
    doctorName: { type: String, default: "" },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    patientTimeZone: { type: String, default: "" },
    slotTime: { type: Date, required: true, index: true },
    duration: { type: String },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true, // Indexed for doctor-specific searches
    },
    transcription: [
      {
        speaker: { type: String },
        text: { type: String },
        _id: false,
      },
    ],

    fee: {
      type: Number,
      required: true,
      min: 0,
    },
    isUserAbsent: { type: Boolean, default: false },
    absentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    transcriptionSummary: {
      type: String,
    },
    isRescheduling: { type: Boolean, default: false },

    day: { type: String },
    daySlot: { type: String },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isPaid: { type: Boolean, default: false },
    isForMySelf: { type: Boolean, default: true },
    status: {
      type: String,
      default: "active",
      enum: ["active", "completed", "cancelled"],
    },

    cancelReason:{ type: String},
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentMethod: {
      type: String,
      default: "card",
      enum: ["card", "cash", ],
    },

    onsitePaid: { type: Boolean, default: false }, // True if paid onsite



    isCompletionVerified: { type: Boolean, default: false },
    isPrescribed: { type: Boolean, default: false },
    review: { type: mongoose.Schema.Types.ObjectId, ref: "Review" },
  },
  { timestamps: true }
);

const autoPopulate = function (next) {
  this.populate("patient");
  this.populate("doctor");
  this.populate("review");

  next();
};

AppointmentSchema.pre("findOne", autoPopulate);
AppointmentSchema.pre("find", autoPopulate);

AppointmentSchema.methods.toAuthJSON = function () {
  return {
    _id: this._id,
    appointmentCompletionStatus: this.appointmentCompletionStatus,
    patientName: this.patientName,
    age: this.age,
    isPrescribed: this.isPrescribed,
    transcription: this.transcription,
    doctorName: this.doctorName,
    transcriptionSummary: this.transcriptionSummary,
    relation: this.relation,
    patientTimeZone: this.patientTimeZone,
    phone: this.phone,
    status: this.status,
    gender: this.gender,
    status: this.status,
    isRescheduling: this.isRescheduling,
    isCompletionVerified: this.isCompletionVerified,
    details: this.details,
    paymentMethod:this.paymentMethod, 
    review: this.review,
    cancelReason: this.cancelReason,
    duration: this.duration,
    date: this.date,
    slotTime: this.slotTime,
    isPaid: this.isPaid,
    isUserAbsent: this.isUserAbsent,
    fee: this.fee,
  };
};

module.exports = mongoose.model("Appointment", AppointmentSchema);
