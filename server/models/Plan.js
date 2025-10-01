const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true, trim: true },
    es: { type: String, required: true, trim: true },
  },

  stripeProductId: { type: String },
  stripePriceId: { type: String },
  stripePriceIds: { type: Object },


  type: {
    type: String,
    enum: ["basic", "premium", "free"],
    required: true,
  }, // Basic (Free) or Premium (Paid)

  benefits: {
    en: { type: [String], required: true },
    es: { type: [String], required: true },
  },

  limits: {
    aiConsultations: { type: Number, default: 0 },
    medicalReports: { type: Number, default: 0 },
    bookingDiscount: { type: Number, default: 0 },
  },

  monthly: {
    price: {
      type: Number,
      required: function () {
        return this.type === "premium";
      },
      default: 0,
    },
    priceMXN: {
      type: Number,
      required: function () {
        return this.type === "premium";
      },
      default: 0,
    },
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

PlanSchema.methods.toJSON = function () {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    benefits: this.benefits,
    monthly: this.monthly,
    limits: this.limits,
    isActive: this.isActive,
  };
};

module.exports = mongoose.model("Plan", PlanSchema);
