let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const mongoosePaginate = require("mongoose-paginate-v2");
const { publicPics, secret } = require("../config");
let slug = require("slug");

let ChatGroupSchema = new mongoose.Schema(
	{
		slug: { type: String, required: [true, "can't be blank"], unique: true },
		patient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
		deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false }, 
    deletedAt: { type: Date, default: null }
	},
	{ timestamps: true }
);

ChatGroupSchema.plugin(uniqueValidator, { message: "Taken" });
ChatGroupSchema.plugin(mongoosePaginate);

ChatGroupSchema.pre("validate", function (next) {
	if (!this.slug) {
		this.slugify();
	}
	next();
});

ChatGroupSchema.methods.slugify = function () {
	this.slug = slug(((Math.random() * Math.pow(36, 6)) | 0).toString(36));
};

const autoPopulate = function (next) {
	this.populate("patient");
	this.populate("doctor");
	this.populate("lastMessage");
	next();
};

ChatGroupSchema.pre("findOne", autoPopulate);
ChatGroupSchema.pre("find", autoPopulate);

module.exports = mongoose.model("ChatGroup", ChatGroupSchema);
