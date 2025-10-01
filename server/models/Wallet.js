let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const mongoosePaginate = require("mongoose-paginate-v2");
const slug = require("slug");

let WalletSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      required: true,
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    currentBalance: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },

    payableAmount: {
      type: Number,
      default: 0,
    },


    status: {
      type: String,
    },

    stripeAccountId: {
      type: String,
      default: "",
    },



    pendingBalance: {
      type: Number,
      default: 0,
    },


    chargeId: { type: String, default: "" },
  },
  { timestamps: true }
);

WalletSchema.plugin(uniqueValidator, { message: "is already taken." });
WalletSchema.plugin(mongoosePaginate);

var autoPopulate = function (next) {
  next();
};

WalletSchema.pre("findOne", autoPopulate);
WalletSchema.pre("find", autoPopulate);

WalletSchema.pre("validate", function (next) {
  if (!this.slug) {
    this.slugify();
  }
  next();
});

WalletSchema.methods.slugify = function () {
  this.slug = slug(((Math.random() * Math.pow(36, 6)) | 0).toString(36));
};

WalletSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    slug: this.slug,
    totalEarnings: this.totalEarnings,
    currentBalance: this.currentBalance,
    pendingBalance: this.pendingBalance,
    stripeAccountId: this.stripeAccountId,
    chargeId: this.chargeId,

    payableAmount: this.payableAmount,
  };
};

module.exports = mongoose.model("Wallet", WalletSchema);
