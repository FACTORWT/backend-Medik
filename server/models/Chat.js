let mongoose = require("mongoose");
const slug = require("slug");

let ChatSchema = new mongoose.Schema(
  {
    messages: [
      {
        question: { type: String, required: true },
        answer: { type: String },
        recommendations: [
          { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        ],
      },
    ],

  },

  { timestamps: true }
);





ChatSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    messages: this.messages,
  };
};



module.exports = mongoose.model("Chat", ChatSchema);
