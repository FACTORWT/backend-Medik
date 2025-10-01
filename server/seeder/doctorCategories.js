const Category = require("../models/DoctorCategories");
const { Categories } = require("../constants/Categories");

async function seedCatagories() {
  for (let i = 0; i < Categories.length; i++) {
    let newCategory = new Category();

  
    newCategory.nameEnglish = Categories[i].nameEnglish;
    newCategory.nameSpanish = Categories[i].nameSpanish;

    // Save the new category to the database
    await newCategory.save();
  }

  console.log("Categories Seeded");
}

module.exports = seedCatagories;
