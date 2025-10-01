let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const mongoosePaginate = require("mongoose-paginate-v2");
const { publicPics, secret } = require("../config");
let slug = require("slug");

let MeetingSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    day: { type: String },
    daySlot: { type: String },
    date: { type: String },
    slotTime: { type: Date },
    duration: { type: String },
    timeLogs: {
      patient: [
        {
          timeIn: { type: Date },
          _id: false,
          timeOut: { type: Date },
        },
      ],
      doctor: [
        {
          timeIn: { type: Date },
          _id: false,
          timeOut: { type: Date },
        },
      ],
    },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

MeetingSchema.plugin(uniqueValidator, { message: "Taken" });
MeetingSchema.plugin(mongoosePaginate);

MeetingSchema.pre("validate", function (next) {
  if (!this.roomId) {
    this.slugify();
  }
  next();
});

MeetingSchema.methods.slugify = function () {
  this.roomId = slug(((Math.random() * Math.pow(36, 6)) | 0).toString(36));
};

const autoPopulate = function (next) {
  this.populate("doctor");
  this.populate("patient");
  next();
};

MeetingSchema.pre("findOne", autoPopulate);
MeetingSchema.pre("find", autoPopulate);

module.exports = mongoose.model("Meeting", MeetingSchema);
