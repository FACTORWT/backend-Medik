let mongoose = require("mongoose");
const slug = require("slug");

let HospitalSchema = new mongoose.Schema(
	{
		name: { type: String, default: "" },
		profileImage: { type: String, default:""},
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		address: { type: String, default: "" },
		representative: { type: String, default: "" },
		phone: { type: String, default: "" },
		website: { type: String, default: "" },
		certificate: { type: String, default: "" },
		license: { type: String, default: "" },
		specialties: [{type: mongoose.Schema.Types.ObjectId, ref: "categories" }],
		description: { type: String, default: "" },

		equipments: [{
			name: { type: String, default: '' },
			image: { type: String, default: '' }
		}],
		recognition: [{
			name: { type: String, default: '' },
			image: { type: String, default: '' }
		}],

		slug: {
			type: String,
			unique: true,
			required: true,
		},
		images: [{ type: String }],
		doctors: [{
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: {
        type: String,
        enum: ["pending", "approved","rejected"],
        default: "pending",
      }
    }],

		status: {
			type: String,
			enum: ["pending","active", "inactive"],
			default: "pending",
		},
	},
	{ timestamps: true }
);

HospitalSchema.pre("validate", function (next) {
	if (!this.slug) {
		this.slugify();
	}
	next();
});

HospitalSchema.methods.slugify = function () {
	this.slug = slug(((Math.random() * Math.pow(36, 6)) | 0).toString(36));
};

const autoPopulate = function (next) {
	// this.populate({
	// 	path: "doctors.doctorId",
	// 	select: "name -hospitals",
	// });
	this.populate(["doctors.doctor"]);
	this.populate("specialties");

	next();
};

HospitalSchema.pre("findOne", autoPopulate);
HospitalSchema.pre("find", autoPopulate);

HospitalSchema.methods.toAuthJSON = function () {
	return {
		_id: this._id,
		name: this.name,
		slug: this.slug,
		address: this.address,
		description: this.description,
		status: this.status,
		doctors: this.doctors,
		images: this.images,
		specialties:this.specialties,
		userId:this.userId,
		address: this.address,
		representative: this.representative,
		phone:this.phone,
		website: this.website,
		profileImage: this.profileImage,
		recognition: this.recognition,
		equipments: this.equipments,
		license: this.license,
		certificate: this.certificate
	};
};

HospitalSchema.methods.toJSON = function () {
	return {
		_id: this._id,
		name: this.name,
		slug: this.slug,
		address: this.address,
		description: this.description,
		status: this.status,
		doctors: this.doctors,
		images: this.images,
		userId:this.userId,
		address: this.address,
		representative: this.representative,
		phone:this.phone,
		website: this.website,
		specialties:this.specialties,
		profileImage: this.profileImage,
		recognition: this.recognition,
		equipments: this.equipments,
		license: this.license,
		certificate: this.certificate
	};
};

module.exports = mongoose.model("Hospital", HospitalSchema);
