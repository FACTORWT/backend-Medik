let mongoose = require("mongoose");

let BlogSchema = new mongoose.Schema(
	{
		title: { type: String, default: "" },
		description: { type: String, default: "" },
		image: { type: String },
		doctor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{ timestamps: true }
);

BlogSchema.methods.toAuthJSON = function () {
	return {
		_id: this._id,
		title: this.title,
		image: this.image,
		doctor: this.doctor,
	};
};

module.exports = mongoose.model("Blog", BlogSchema);
