let mongoose = require("mongoose");

let ReviewSchema = new mongoose.Schema(
  {
    comment: { type: String, default: "" },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ReviewSchema.methods.toAuthJSON = function () {
  return {
    _id: this._id,
    comment: this.comment,
    appointment: this.appointment,
    doctor: this.doctor,
    patient: this.patient,
    rating: this.rating,
    isReviewed: this.isReviewed,
  };
};

module.exports = mongoose.model("Review", ReviewSchema);
