const mongoose = require("mongoose");

const UserSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true }, // plan is ref can populate 
    stripeSubscriptionId: { type: String,  default:null },
    stripeCustomerId: { type: String, default:null },  // Add this field for Stripe Customer ID
    status: { type: String, enum: ["active", "inactive", "pending", "cancelled"], required: true },
    renewalDate: { type: Date},
    lastPaymentDate: { type: Date },
    aiConsultationsLeft: { type: Number, default: 0 },  // Track remaining AI consultations
    medicalReportsLeft: { type: Number, default: 0 },  // Track remaining medical reports
    discount: { type: Number, default: 0 }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSubscription", UserSubscriptionSchema);
