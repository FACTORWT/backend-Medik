let mongoose = require("mongoose");
let router = require("express").Router();

let {
  OkResponse,
  BadRequestResponse,
  UnauthorizedResponse,
} = require("express-http-response");
const auth = require("../auth");
const Plan = require("../../models/Plan");

let Categories = mongoose.model("categories");
const Hospital = mongoose.model("Hospital");
const User = mongoose.model("User");
const Blog = mongoose.model("Blog");

router.get("/hospitals", (req, res, next) => {
  const { searchName, searchAddress } = req.query;
  const query = {};

  if (searchAddress) {
    query.address = { $regex: new RegExp(searchAddress, "i") };
  }

  if (searchName) {
    query.name = { $regex: new RegExp(searchName, "i") };
  }
  const options = {
    sort: { createdAt: -1 },
  };

  Hospital.find(query, null, options, (err, hosps) => {
    if (err) return next(new BadRequestResponse(err));

    return next(new OkResponse(hosps));
  });
});

router.get("/hospital/one/:_id", async (req, res, next) => {
  try {
    const findHospital = await Hospital.findOne({ _id: req.params._id });
    if (!findHospital) {
      return next(new BadRequestResponse("Hospital not found"));
    }

    return next(new OkResponse(findHospital));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

router.get("/affiliation/:id", async (req, res, next) => {
  try {
    const doctorId = req.params.id;

    const user = await User.findById(doctorId).populate("hospitals");

    const hospitals = user.hospitals;
    return next(new OkResponse(hospitals));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

router.get("/doctor-categories", (req, res, next) => {
  const query = {};
  const options = {
    sort: { createdAt: -1 },
  };

  Categories.find(query, null, options, (err, docs) => {
    if (err) return next(new BadRequestResponse(err));

    return next(new OkResponse(docs));
  });
});

router.get("/blogs", (req, res, next) => {
  const query = {};
  const options = {
    sort: { createdAt: -1 },
  };
  Blog.find(query, null, options, (err, blogs) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(blogs));
  });
});

router.get("/blog/:id", (req, res, next) => {
  Blog.findOne({ _id: req.params.id })
    .then((blog) => {
      if (!blog) {
        return next(new NotFoundResponse("Job not found"));
      }
      return next(new OkResponse(blog));
    })
    .catch((err) => {
      return next(new BadRequestResponse(err));
    });
});

router.get("/package/:id",auth.required,  async (req, res, next) => {
  try {

    const planId = req.params.id;
  

    const result = await Plan.findById(planId);
    console.log("Result", result)
    return next(new OkResponse(result));
  } catch (error) {
    console.log("🔥 ~ router.get ~ error: ", error);
    return next(new BadRequestResponse("Failed to retreive Plans"));
  }
});

// router.get("testimonials", async (req, res, next) => {
//   try {
//     const reviews = await Review.find({ rating: { $gte: 3 } }).populate(
//       "patient, fullName profileImage"
//     );
//     return next(new OkResponse(reviews));
//   } catch (error) {
//     return next(new BadRequestResponse(err));
//   }
// });

module.exports = router;
