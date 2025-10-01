var mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
let slug = require("slug");
var NotificationSchema = new mongoose.Schema(
	{
		title: String,
		description: String,
		spanish: {
			type: String,

		},

		sentBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		sentTo: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		isRead: {
			type: Boolean,
			default: false,
		},
		appointment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Appointment",
		},

		hospital: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Hospital",
		},
		slug: { type: String, lowercase: true, unique: true },
		data: {},
	},
	{ timestamps: true }
);

NotificationSchema.plugin(mongoosePaginate);

var autoPopulate = function (next) {
	this.populate("sentBy");
	this.populate("sentTo");
	this.populate("appointment");
	// this.populate("hospital");

	next();
};

NotificationSchema.pre("validate", function (next) {
	if (!this.slug) {
		this.slugify();
	}
	next();
});

NotificationSchema.methods.slugify = function () {
	this.slug = slug("N-" + ((Math.random() * Math.pow(36, 6)) | 0).toString(36));
};

NotificationSchema.pre("findOne", autoPopulate);
NotificationSchema.pre("find", autoPopulate);

NotificationSchema.methods.toJSON = function () {
	return {
		_id: this._id,
		title: this.title,
		description: this.description,
		spanish: this.spanish,
		sentBy: this.sentBy,
		sentTo: this.sentTo,
		isRead: this.isRead,
		hospital: this.hospital,
		appointment: this.appointment,
		data: this.data,
		createdAt: this.createdAt,
	};
};

module.exports = mongoose.model("Notification", NotificationSchema);
