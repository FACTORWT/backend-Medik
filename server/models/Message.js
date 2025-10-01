let mongoose = require('mongoose');
let uniqueValidator = require('mongoose-unique-validator');
const mongoosePaginate = require('mongoose-paginate-v2');

let slug = require('slug');

let MessageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: [true, "can't be blank"], unique: true },
    text: { type: String, default: '' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    chatGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatGroup' },
		
  },
  { timestamps: true }
);

MessageSchema.plugin(uniqueValidator, { message: 'Taken' });
MessageSchema.plugin(mongoosePaginate);

MessageSchema.pre('validate', function (next) {
  if (!this.slug) {
    this.slugify();
  }
  next();
});

MessageSchema.methods.slugify = function () {
  this.slug = slug(((Math.random() * Math.pow(36, 6)) | 0).toString(36));
};

const autoPopulate = function (next) {
  this.populate('sender', "fullName profileImage dob age -hospitals -review -wallet");
  this.populate('receiver', "fullName profileImage dob age -hospitals -review -wallet");
  next();
};

MessageSchema.pre('findOne', autoPopulate);
MessageSchema.pre('find', autoPopulate);

module.exports = mongoose.model('Message', MessageSchema);
