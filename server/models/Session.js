let mongoose = require("mongoose");

let SessionSchema = new mongoose.Schema(
  {
    patientProfile:{
      questions: {
        type: Map,
        of: String,
        required: true,
        default: {}

      },
      symptoms:{ type: String, required: true },
      duration:{ type: String, required: true },
      intensity:{ type: String, required: true }
    },
   
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },
    attempts: { type: Number, default: 0 },
  },

  { timestamps: true }
);


SessionSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    chat:this.chat,
    user: this.user,
    patientProfile: this.patientProfile,
    attempts: this.attempts,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Session", SessionSchema);
