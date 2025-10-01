let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
let crypto = require("crypto");
let jwt = require("jsonwebtoken");
const mongoosePaginate = require("mongoose-paginate-v2");
const { publicPics, secret } = require("../config");
const fs = require("fs");
const path = require("path");

const deleteOldProfileImage = (oldImageUrl) => {
  if (!oldImageUrl) return;

  try {
    console.log("oldImageUrl ************** ", oldImageUrl);
    const urlParts = oldImageUrl.split("/");
    console.log("urlParts ************** ", urlParts);
    const filename = urlParts[urlParts.length - 1];
    console.log("filename ************** ", filename);

    const filePath = path.join(
      process.cwd(),
      "server/public",
      "uploads",
      filename
    );
    console.log("filePath ************** ", filePath);

    // Check if file exists and delete it
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted old profile image: ${filename}`);
    } else {
      console.log(`⚠️ File not found: ${filename}`);
    }
  } catch (error) {
    console.error("❌ Error deleting old profile image:", error);
  }
};

let UserSchema = new mongoose.Schema(
  {
    birthDate: { type: String, default: "" },
    language: [{ type: String, default: "" }],
    otherContact: { type: String, default: "" },
    sex: {
      type: String,
      enum: ["male", "female", "other"],
    },
    socialID: { type: String },
    review: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
    email: { type: String, unique: true, required: true, lowercase: true },
    profileImage: {
      type: String,
      default: `${publicPics}/noImage.png`,
    },
    isNotified: { type: Boolean, default: false },

    fullName: { type: String, default: "" },
    googleId: String,
    appleId: String,
    phone: {
      default: null,
      type: String,
      validate: {
        validator: function (phone) {
          // Only validate uniqueness if phone has a value
          if (!phone || phone.trim() === "") {
            return true; // Skip validation for empty/null values
          }
          return true; // Will be handled by custom pre-save validation
        },
        message: "Phone number already exists. Use another number.",
      },
      // Phone uniqueness is handled conditionally in pre-save middleware
      // Only validates when phone has a value, allowing multiple users without phones
    },
    fee: { type: Number },
    age: { type: Number },

    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
    },

    experience: { type: String, default: "" },
    about: { type: String, default: "" },
    height: { type: Number, default: 0 },
    weight: { type: Number, default: 0 },

    address: { type: String, default: "" },

    timeZone: { type: String, default: "" },

    availability: [
      {
        date: { type: Date },
        day: { type: String },
        dayOfWeek: { type: Number },
        type: { type: String, enum: ["morning", "evening", "afternoon"] },
        // startTime: { type: String, required: true }
        duration: { type: String },
      },
    ],

    specialty: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    license: { type: String, default: "" },
    signature: { type: String, default: "" },
    proofOfStudy: { type: String },
    certificate: { type: String },
    professionalLicenseNumber: { type: String, default: "" },
    isProfileCompleted: { type: Boolean, default: false },
    isOtpVerified: { type: Boolean, default: false },

    profileCompletionStatus: {
      type: Number,
      enum: [0, 1, 2, 3, 4, 5],
      default: 0,
    }, //0-for basic Profile. 1-for OTP Verification 2- Personal Profile 3- Professional Profile 4-Submiited All Details 5- just for hospital

    accountType: {
      type: String,
      enum: ["google", "apple", "email"],
      default: "email",
    },
    notificationToken: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "pending",
    },
    curp: { type: String, default: "" },
    state: { type: String, default: "" },
    education: [
      { title: String, year: String, degree: String, institute: String },
    ],
    specialities: [{ title: String }],
    awards: [{ title: String, year: String }],

    hash: { type: String, default: null },
    salt: String,
    role: {
      type: String,
      enum: ["admin", "patient", "doctor", "hospital"],
      default: "patient",
    },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    webToken: { type: String, default: null },

    hospitals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hospital" }],
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {  
  try {
    if (this.isModified("profileImage")) {
     
      if (this._id) {

        const oldDoc = await this.constructor.findById(this._id);
        if (
          oldDoc &&
          oldDoc.profileImage &&
          oldDoc.profileImage !== this.profileImage
        ) {
          console.log(
            `🔄 Profile image changed from: ${oldDoc.profileImage} to: ${this.profileImage}`
          );

        
          this._oldProfileImageUrl = oldDoc.profileImage;
        }
      }
    }
    // Check if phone number has changed
    if (this.isModified("phone")) {
      // Reset OTP verification status when phone changes
      this.isOtpVerified = false;
      this.otp = null;
      this.otpExpires = null;
    }

    // Custom phone uniqueness validation - only check if phone has a value
    if (this.phone && this.phone.trim() !== "") {
      const existingUser = await this.constructor.findOne({
        phone: this.phone.trim(),
        _id: { $ne: this._id }, // Exclude current user when updating
      });

      if (existingUser) {
        const error = new Error(
          "Phone number already exists. Use another number."
        );
        error.name = "ValidationError";
        return next(error);
      }
    }

    next();
  } catch (error) {
  
  
}});

UserSchema.post("save", function (doc) {
  // Check if we have an old profile image URL to delete
  if (doc._oldProfileImageUrl) {
    console.log("🗑️ Deleting old profile image after successful save...");
    deleteOldProfileImage(doc._oldProfileImageUrl);

    // Clean up the temporary property
    doc._oldProfileImageUrl = undefined;
  }
});
UserSchema.plugin(uniqueValidator, {
  message: "Taken",
  // Exclude phone field from uniqueValidator since we handle it manually
  fields: ["email"],
});
UserSchema.plugin(mongoosePaginate);

UserSchema.methods.validPassword = function (password) {
  let hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
  return this.hash === hash;
};

UserSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
};

UserSchema.methods.generatePasswordRestToken = function () {
  this.resetPasswordToken = crypto.randomBytes(20).toString("hex");
};

UserSchema.methods.generateWebToken = function () {
  this.webToken = crypto.randomBytes(12).toString("hex");
};

UserSchema.methods.setOTP = function () {
  this.otp = Math.floor(10000 + Math.random() * 9000);
  this.otpExpires = Date.now() + 3600000; // 1 hour
};

UserSchema.methods.generateJWT = function () {
  let today = new Date();
  let exp = new Date(today);
  exp.setDate(today.getDate() + 60);

  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      exp: parseInt(exp.getTime() / 1000),
    },
    secret
  );
};

// Static method to check phone uniqueness
UserSchema.statics.isPhoneUnique = async function (
  phone,
  excludeUserId = null
) {
  if (!phone || phone.trim() === "") {
    return true; // Empty phone is always considered unique
  }

  const query = { phone: phone.trim() };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const existingUser = await this.findOne(query);
  return !existingUser;
};

const autoPopulate = function (next) {
  this.populate({
    path: "hospitals",
    select: "name profileImage address description  -doctors.doctor",
  });
  this.populate("review");
  this.populate("wallet");
  this.populate("specialty");

  next();
};

UserSchema.pre("findOne", autoPopulate);
UserSchema.pre("find", autoPopulate);

UserSchema.methods.toAuthJSON = function () {
  return {
    _id: this._id,
    birthDate: this.birthDate,
    language: this.language,
    otherContact: this.otherContact,
    sex: this.sex,
    email: this.email,
    profileImage: this.profileImage,
    role: this.role,
    status: this.status,
    // slots: this.slots,
    isEmailVerified: this.isEmailVerified,
    token: this.generateJWT(),
    height: this.height,
    weight: this.weight,
    webToken: this.webToken,
    fullName: this.fullName,
    googleId: this.googleId,
    fee: this.fee,
    experience: this.experience,
    about: this.about,
    review: this.review,
    appleId: this.appleId,
    phone: this.phone,
    address: this.address,
    specialty: this.specialty,
    license: this.license,
    proofOfStudy: this.proofOfStudy,
    certificate: this.certificate,
    professionalLicenseNumber: this.professionalLicenseNumber,
    isProfileCompleted: this.isProfileCompleted,
    isOtpVerified: this.isOtpVerified,
    profileCompletionStatus: this.profileCompletionStatus,
    education: this.education,
    specialities: this.specialities,
    awards: this.awards,
    hospitals: this.hospitals,
    age: this.age,
    notificationToken: this.notificationToken,
    wallet: this.wallet,
    availability: this.availability,
    timeZone: this.timeZone,
    signature: this.signature,
    curp: this.curp,
    state: this.state,
  };
};

UserSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    birthDate: this.birthDate,
    language: this.language,
    otherContact: this.otherContact,
    sex: this.sex,
    // slots: this.slots,
    fee: this.fee,
    experience: this.experience,
    about: this.about,
    profileImage: this.profileImage,
    role: this.role,
    webToken: this.webToken,
    notificationToken: this.notificationToken,
    status: this.status,
    isEmailVerified: this.isEmailVerified,
    fullName: this.fullName,
    googleId: this.googleId,
    appleId: this.appleId,
    phone: this.phone,
    review: this.review,
    address: this.address,
    specialty: this.specialty,
    license: this.license,
    age: this.age,
    proofOfStudy: this.proofOfStudy,
    certificate: this.certificate,
    professionalLicenseNumber: this.professionalLicenseNumber,
    isProfileCompleted: this.isProfileCompleted,
    isOtpVerified: this.isOtpVerified,

    profileCompletionStatus: this.profileCompletionStatus,
    education: this.education,
    specialities: this.specialities,
    awards: this.awards,
    email: this.email,
    hospitals: this.hospitals,
    wallet: this.wallet,
    availability: this.availability,
    timeZone: this.timeZone,
    signature: this.signature,
    curp: this.curp,
    state: this.state,
  };
};

module.exports = mongoose.model("User", UserSchema);
