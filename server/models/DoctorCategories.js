let mongoose = require('mongoose');

let CategoriesSchema = new mongoose.Schema(
  {
    nameEnglish: { type: String, default: '' },
    nameSpanish: { type: String, default: '' },
  },
  { timestamps: true }
);


module.exports = mongoose.model('categories', CategoriesSchema);
