let mongoose = require("mongoose");

let HistorySchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    sleepPattern: {
      duration: { type: Number },
      quality: { type: String },
    },

    diet: {
      restrictions: [String],
      habits: { type: String, trim: true },
    },

    exerciseRoutine: {
      activity: { type: String },

      stressLevel: {
        type: Number,
      },

      otherDetails: { type: String, trim: true },
    },

    diagnoses: [
      {
        name: { type: String, trim: true },
        year: { type: String, trim: true },
        details: { type: String, trim: true },
      },
    ],

    prescriptions: [
      {
        tablet: { type: String, trim: true },
        howLong: Number,
        strength: { type: String, trim: true },
        howMany: {
          morning: { type: Number, default: 0 },
          afternoon: { type: Number, default: 0 },
          evening: { type: Number, default: 0 },
        },
      },
    ],

    vaccinations: [
      {
        name: { type: String, required: true, trim: true },
        year: { type: String, required: true, trim: true },
      },
    ],

    allergies: [{ name: { type: String, trim: true } }],
    radiology: [
      {
        name: { type: String, required: true, trim: true },
        images: [{ type: String, required: true }],
        createdAt: { type: Date, default: Date.now },
      },
    ],

    laboratory: [
      {
        name: { type: String, required: true, trim: true },
        attachment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

HistorySchema.methods.toJSON = function () {
  return {
    _id: this._id,
    sleepPattern: this.sleepPattern,
    diet: this.diet,
    exerciseRoutine: this.exerciseRoutine,
    diagnoses: this.diagnoses,
    prescriptions: this.prescriptions,
    vaccinations: this.vaccinations,
    allergies: this.allergies,
    radiology: this.radiology,
    laboratory: this.laboratory,
    patient: this.patient,
  };
};

module.exports = mongoose.model("History", HistorySchema);
