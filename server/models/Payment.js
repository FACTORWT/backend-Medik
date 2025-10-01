let mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, default: null }, // Allow paymentId to be null

    type: {
      type: String,
      enum: ["new", "reschedule", "refund", "subscription"],
      default: "new",
    },

    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    payee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },

    status: {
      type: String,
      enum: ["Initiated", "Failed", "Completed"],
      default: "Initiated",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "card"],
      default: "card",
    },

    currency: { type: String, enum: ["CAD", "USD", "MXN"], default: "USD" },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  
    discount: {
      type: Number,

      min: 0,
    },

    consultationFee: { type: Number, default: 0 },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    withDraw: {
      type: Boolean,
      default: false,
    },

    chargeId: { type: String, default: "" },

    initiatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const autoPopulate = function (next) {
  this.populate("appointment");

  next();
};

PaymentSchema.pre("findOne", autoPopulate);
PaymentSchema.pre("find", autoPopulate);

PaymentSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    paymentId: this.paymentId,
    payer: this.payer,
    amount: this.amount,
    currency: this.currency,
    appointment: this.appointment,
    payee: this.payee,
    paymentMethod: this.paymentMethod,
    chargeId: this.chargeId,
    status: this.status,
    initiatedAt: this.initiatedAt,
    consultationFee: this.consultationFee,
    discount: this.discount,
    withDraw: this.withDraw,
    type: this.type,

  };
};

module.exports = mongoose.model("Payment", PaymentSchema);
