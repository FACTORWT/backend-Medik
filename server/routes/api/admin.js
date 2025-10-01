let mongoose = require("mongoose");
let router = require("express").Router();
let { OkResponse, BadRequestResponse } = require("express-http-response");
let User = mongoose.model("User");
let Categories = mongoose.model("categories");
const Hospital = require("../../models/Hospital");
const Payment = require("../../models/Payment");

const Blog = require("../../models/Blogs");
const Appointment = require("../../models/Appointment");

let auth = require("../auth");
const { emitEvent } = require("../../utilities/realTime");
const {
  sendNotification,
  sendPushNotification,
} = require("../../utilities/notification");
const NotFoundResponse = require("express-http-response/lib/http/NotFoundResponse");
const Plan = require("../../models/Plan");

const { StripeSecretKey, PublishableKey } = require("../../config");
const stripe = require("stripe")(StripeSecretKey);

router.param("email", (req, res, next, email) => {
  User.findOne({ email }, (err, user) => {
    if (err) return next(new BadRequestResponse(err));
    if (!user) return next(new BadRequestResponse("User not found!", 423));
    req.userToUpdate = user;
    next();
  });
});

router.param("slug", (req, res, next, slug) => {
  Hospital.findOne({ slug }, (err, hospital) => {
    if (err) return next(new BadRequestResponse(err));
    if (!hospital)
      return next(new BadRequestResponse("Hospital not found!", 423));
    req.hospitalToUpdate = hospital;
    next();
  });
});

router.param("hosID", (req, res, next, _id) => {
  Hospital.findOne({ _id }, (err, hospital) => {
    if (err) return next(new BadRequestResponse(err));
    if (!hospital)
      return next(new BadRequestResponse("Hospital not found!", 423));
    req.hospitalToUpdate = hospital;
    next();
  });
});

router.param("blogId", (req, res, next, _id) => {
  Blog.findOne({ _id }, (err, blog) => {
    if (err) return next(new BadRequestResponse(err));
    if (!blog) return next(new BadRequestResponse("Blog not found!", 423));
    req.blogToUpdate = blog;
    next();
  });
});

router.param("_id", (req, res, next, _id) => {
  User.findOne({ _id }, (err, user) => {
    if (err) return next(new BadRequestResponse(err));
    if (!user) return next(new BadRequestResponse("User not found!", 423));
    req.userToUpdate = user;
    next();
  });
});

router.get("/stats", auth.required, auth.admin, async (req, res, next) => {
  try {
    const totalBookings = await Appointment.countDocuments({});
    const completedBookings = await Appointment.countDocuments({
      status: "completed",
    });
    const cancelledBookings = await Appointment.countDocuments({
      status: "cancelled",
    });
    const activeBookings = await Appointment.countDocuments({
      status: "active",
    });
    const bookingsList = await Appointment.find({}).select("createdAt");

    const totalUsers = await User.countDocuments({});
    const completedPayments = await Payment.find({
      status: "Completed",
    }).select("initiatedAt amount status usdAmount");

    const stats = {
      totalBookings,
      completedBookings,
      cancelledBookings,
      activeBookings,
      bookingsList,
      totalUsers,
      completedPayments,
    };

    return next(new OkResponse(stats));
  } catch (error) {
    return next(new BadRequestResponse(error.message));
  }
});

router.get(
  "/admin-payments",
  auth.required,
  auth.admin,
  async (req, res, next) => {
    try {
      const {
        searchPatient,
        searchDoctor,
        status,
        startDate,
        endDate,
        paymentMethod,
        type,
        page = 1,
        limit = 10,
      } = req.query;

      // Build the query
      let query = {};

      // Status filter
      if (status) {
        query.status = status;
      }

      // Date range filter
      if (startDate && endDate) {
        query.initiatedAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + "T23:59:59.999Z"),
        };
      } else if (startDate) {
        query.initiatedAt = { $gte: new Date(startDate) };
      } else if (endDate) {
        query.initiatedAt = { $lte: new Date(endDate + "T23:59:59.999Z") };
      }

      // Payment method filter
      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      // Transaction type filter
      if (type) {
        query.type = type;
      }

      // Pre-fetch patient and doctor IDs based on search
      let patientIds = [];
      let doctorIds = [];

      if (searchPatient) {
        const patients = await User.find({
          fullName: { $regex: searchPatient, $options: "i" },
          role: "patient",
        }).select("_id");
        patientIds = patients.map((p) => p._id);
        if (patientIds.length > 0) {
          query.payer = { $in: patientIds };
        } else {
          return next(
            new OkResponse({
              payments: [],
              totalRevenue: 0,
              totalCount: 0,
            })
          );
        }
      }

      if (searchDoctor) {
        const doctors = await User.find({
          fullName: { $regex: searchDoctor, $options: "i" },
          role: "doctor",
        }).select("_id");
        doctorIds = doctors.map((d) => d._id);
        if (doctorIds.length > 0) {
          query.payee = { $in: doctorIds };
        } else {
          return next(
            new OkResponse({
              payments: [],
              totalRevenue: 0,
              totalCount: 0,
            })
          );
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute main query with pagination
      const payments = await Payment.find(query)
        .populate({
          path: "payer",
          select: "fullName email profilePicture",
          model: "User",
        })
        .populate({
          path: "payee",
          select: "fullName email profilePicture specialization",
          model: "User",
        })
        .populate({
          path: "appointment",
          select: "appointmentDate startTime status",
        })
        .sort({ initiatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Calculate total revenue for the filtered payments using usdAmount when available
      const revenueData = await Payment.aggregate([
        { $match: query },
        { $match: { status: "Completed" } },
        {
          $addFields: {
            revenueAmount: "$amount",
          },
        },
        { $group: { _id: null, total: { $sum: "$revenueAmount" } } },
      ]);

     
      const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

      // Get total count for pagination
      const totalCount = await Payment.countDocuments(query);

      return next(
        new OkResponse({
          payments,
          totalRevenue,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        })
      );
    } catch (error) {
      console.error("Error fetching admin payments:", error);
      return next(new BadRequestResponse(err.message));
    }
  }
);

router.get("/appointments", auth.required, auth.admin, (req, res, next) => {
  const filter = { isPaid: true };
  Appointment.find(filter, (err, appointments) => {
    if (err) return next(new BadRequestResponse(err.message));
    return next(new OkResponse(appointments));
  });
});

router.get("/patients", auth.required, auth.admin, (req, res, next) => {
  const { search, status, sort, startDate, endDate } = req.query;
  const filter = { role: "patient" };

  if (search) {
    filter.fullName = { $regex: new RegExp(search, "i") };
  }

  if (status && status !== "") {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  let options = {
    sort: { createdAt: -1 },
  };

  options.sort = { fullName: 1 };

  User.find(filter, null, options, (err, patients) => {
    if (err) return next(new BadRequestResponse(err.message));
    return next(new OkResponse(patients));
  });
});

router.get("/doctors", auth.required, (req, res, next) => {
  const { search, status, sort, startDate, endDate } = req.query;

  const filter = { role: "doctor", profileCompletionStatus: 4 };

  if (search) {
    filter.fullName = { $regex: new RegExp(search, "i") };
  }

  if (status && status !== "") {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  const options = {
    sort: { createdAt: -1 },
  };

  options.sort = { fullName: 1 };

  User.find(filter, null, options, (err, doctors) => {
    if (err) return next(new BadRequestResponse(err.message));
    return next(new OkResponse(doctors));
  });
});

router.get("/hospitals", auth.required, auth.admin, (req, res, next) => {
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
    if (err) return next(new BadRequestResponse(err.message));
    return next(new OkResponse(hosps));
  });
});

router.get("/hospital/:hosID", auth.required, auth.admin, (req, res, next) => {
  return next(new OkResponse(req.hospitalToUpdate));
});

router.get("/patients", auth.required, auth.admin, (req, res, next) => {
  const options = {
    sort: { createdAt: -1 },
  };

  User.find({ role: "patient" }, null, options, (err, doctors) => {
    if (err) return next(new BadRequestResponse(err.message));
    return next(new OkResponse(doctors));
  });
});

router.get("/user/:_id", auth.required, auth.admin, (req, res, next) => {
  return next(new OkResponse(req.userToUpdate));
});

router.put(
  "/user/status/:email",
  auth.required,
  auth.admin, // Only admins can update statuses
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const email = req.params.email;

      if (!status) {
        return next(new BadRequestResponse("Missing required parameters", 422));
      }

      const userToUpdate = await User.findOne({ email });
      if (!userToUpdate) {
        return next(new NotFoundResponse("User not found"));
      }

      userToUpdate.status = status;

      const user = await userToUpdate.save();

      // Emit logout event if user is being deactivated
      if (status === "inactive") {
        emitEvent(`logout-${user._id}`);
      }

      // Compose notification messages (English and Spanish)
      const notificationMessage = req.t(
        `admin.messages.${user.role}Account.${user.status}`,
        { lng: "en" }
      );
      const notificationMessageSpanish = req.t(
        `admin.messages.${user.role}Account.${user.status}`,
        { lng: "es" }
      );

      console.log("Notification message", notificationMessage);
      console.log(
        "Notification message in spanish",
        notificationMessageSpanish
      );

      const notificationTitle = req.t(
        "appointment.notifications.userStatusTitle",
        { lng: "en" }
      );

      await sendNotification(
        notificationTitle, // English title
        notificationMessage, // English message
        notificationMessageSpanish, // Spanish message
        user._id
      );

      await sendPushNotification(
        notificationTitle,
        notificationMessage,
        user._id
      );

      return next(new OkResponse(user));
    } catch (error) {
      console.error("Status update error:", error);
      return next(
        new BadRequestResponse(
          req.t("errors.serverError", { message: error.message })
        )
      );
    }
  }
);

router.put(
  "/hospital/status/:slug",
  auth.required,
  auth.admin,
  async (req, res, next) => {
    try {
      const { status, userId } = req.body;

      if (!status || !userId) {
        throw new BadRequestResponse("Missing required parameters", 422);
      }

      const userOfHospital = await User.findByIdAndUpdate(
        userId,
        { status },
        { new: true }
      );

      if (!userOfHospital) {
        return next(new NotFoundResponse("User not found"));
      }

      req.hospitalToUpdate.status = status;
      const updatedHospital = await req.hospitalToUpdate.save();

      return next(new OkResponse(updatedHospital));
    } catch (error) {
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.post("/category", auth.required, auth.admin, (req, res, next) => {
  if (!!!req.body)
    return next(new BadRequestResponse("Missing required parameters", 422.0));
  const newCategory = new Categories({
    nameEnglish: req.body.nameEnglish,
    nameSpanish: req.body.nameSpanish,
  });

  newCategory.save((err, savedCategory) => {
    if (err) {
      return next(new BadRequestResponse(err.message));
    }
    return next(new OkResponse(savedCategory)); // Return the saved category
  });
});

router.get("/categories", (req, res, next) => {
  const query = {};

  const options = {
    sort: { createdAt: -1 },
  };
  Categories.find(query, null, options, (err, categories) => {
    if (err) {
      return next(new BadRequestResponse(err.message));
    }
    return next(new OkResponse(categories));
  });
});

router.delete(
  "/category/:id",
  auth.required,
  auth.admin,
  async (req, res, next) => {
    try {
      const category = await Categories.findById(req.params.id);

      if (!category) {
        return next(new NotFoundResponse("Category not found"));
      }

      await category.remove();

      return next(new OkResponse("Category deleted successfully"));
    } catch (err) {
      return next(new BadRequestResponse(err.message));
    }
  }
);

router.post("/blog", auth.required, auth.admin, async (req, res, next) => {
  try {
    if (!!!req.body)
      return next(new BadRequestResponse("Missing required parameters", 422.0));

    const newBlog = new Blog({
      title: req.body.title,
      description: req.body.description,
      image: req.body.image,
    });

    const result = await newBlog.save();

    return next(new OkResponse(result));
  } catch (error) {
    return next(new BadRequestResponse(error.message));
  }
});

router.put(
  "/update-blog/:blogId",
  auth.required,
  auth.admin,
  async (req, res, next) => {
    try {
      if (!!!req.body)
        return next(
          new BadRequestResponse("Missing required parameters", 422.0)
        );

      req.blogToUpdate.title = req.body.title || req.blogToUpdate.title;
      req.blogToUpdate.description =
        req.body.description || req.blogToUpdate.description;
      req.blogToUpdate.image = req.body.image || req.blogToUpdate.image;

      await req.blogToUpdate.save();

      return next(new OkResponse(req.blogToUpdate));
    } catch (error) {
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.delete(
  "/blog/:blogId",
  auth.required,
  auth.admin,
  async (req, res, next) => {
    try {
      const blogToRemove = req.blogToUpdate;

      if (!blogToRemove) {
        return next(
          new BadRequestResponse("Missing required parameters", 422.0)
        );
      }

      const response = await req.blogToUpdate.remove();

      return next(new OkResponse(response));
    } catch (err) {
      return next(new BadRequestResponse(err.message));
    }
  }
);

router.get(
  "/packages/all",

  async (req, res, next) => {
    try {
      let query = req?.user?.role === "admin" ? {} : { isActive: true };
      const pipeline = [
        { $match: query },
        {
          $sort: {
            name: 1,
          },
        },
      ];

      const result = await Plan.aggregate(pipeline);
      return next(new OkResponse(result));
    } catch (error) {
      console.log("🔥 ~ router.get ~ error: ", error);
      return next(new BadRequestResponse("Failed to retreive Plans"));
    }
  }
);

router.put(
  "/packages/update/:id",
  auth.required,
  auth.admin,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, type, benefits, monthly, isActive, limits } = req.body;
      console.log("🔥 ~ router.put ~ req.body: ", req.body);

      const existingPackage = await Plan.findById(id);
      if (!existingPackage) {
        return next(new BadRequestResponse("Plan not found"));
      }

      // Validate benefits in both languages
      if (!benefits || !benefits.en || !benefits.es) {
        return next(
          new BadRequestResponse(
            "Benefits are required in both English and Spanish"
          )
        );
      }

      const validBenefitsEn = benefits.en.filter(
        (benefit) => benefit.trim() !== ""
      );
      const validBenefitsEs = benefits.es.filter(
        (benefit) => benefit.trim() !== ""
      );
      if (validBenefitsEn.length === 0 || validBenefitsEs.length === 0) {
        return next(
          new BadRequestResponse(
            "At least one benefit is required in each language"
          )
        );
      }

      // Validate name in both languages
      if (!name || !name.en || !name.es) {
        return next(
          new BadRequestResponse(
            "Package name is required in both English and Spanish"
          )
        );
      }

      // Validate pricing for premium plans
      if (
        type === "premium" &&
        (!monthly ||
          monthly.price === undefined ||
          monthly.priceMXN === undefined)
      ) {
        return next(
          new BadRequestResponse("Price is required for the monthly plan")
        );
      }

      // Update package fields
      if (name) existingPackage.name = name;
      if (type && ["basic", "premium", "free"].includes(type))
        existingPackage.type = type;
      if (benefits)
        existingPackage.benefits = { en: validBenefitsEn, es: validBenefitsEs };
      if (isActive !== undefined) existingPackage.isActive = isActive;

      if (limits) {
        existingPackage.limits = {
          aiConsultations:
            limits.aiConsultations === -1
              ? -1
              : parseInt(limits.aiConsultations),
          medicalReports:
            limits.medicalReports === -1 ? -1 : parseInt(limits.medicalReports),
          bookingDiscount: parseInt(limits.bookingDiscount) || 0,
        };
      }

      if (type !== "free") {
        let stripeProduct, stripePrice;

        // If product exists, update it
        if (existingPackage.stripeProductId) {
          stripeProduct = await stripe.products.update(
            existingPackage.stripeProductId,
            {
              name: existingPackage.name.en,
              description: `Subscription for ${existingPackage.name.en} plan`,
              active: existingPackage.isActive,
              metadata: {
                plan_type: existingPackage.type,
                ai_consultations:
                  existingPackage.limits.aiConsultations === -1
                    ? "unlimited"
                    : existingPackage.limits.aiConsultations,
                medical_reports:
                  existingPackage.limits.medicalReports === -1
                    ? "unlimited"
                    : existingPackage.limits.medicalReports,
                booking_discount: existingPackage.limits.bookingDiscount,
              },
            }
          );

          // If price is updated, create a new price entry
          if (
            monthly &&
            (monthly.price !== existingPackage.monthly.price ||
              monthly.priceMXN !== existingPackage.monthly.priceMXN)
          ) {
            if (monthly.price !== existingPackage.monthly.price) {
              stripePrice = await stripe.prices.create({
                currency: "usd",
                unit_amount: Math.round(monthly.price * 100), // Convert to cents
                recurring: { interval: "month" },
                product: existingPackage.stripeProductId,
              });
              existingPackage.stripePriceIds = {
                ...existingPackage.stripePriceIds,
                usd: stripePrice.id,
              };
            }
            if (monthly.priceMXN !== existingPackage.monthly.priceMXN) {
              const stripePriceMXN = await stripe.prices.create({
                currency: "mxn",
                unit_amount: Math.round(monthly.priceMXN * 100), // Convert to cents
                recurring: { interval: "month" },
                product: existingPackage.stripeProductId,
              });
              existingPackage.stripePriceIds = {
                ...existingPackage.stripePriceIds,
                mxn: stripePriceMXN.id,
              };
            }
            existingPackage.monthly = {
              price: monthly.price,
              priceMXN: monthly.priceMXN,
            };
          }
        } else {
          // Create a new product if not present
          stripeProduct = await stripe.products.create({
            name: existingPackage.name.en,
            description: `Subscription for ${existingPackage.name.en} plan`,
            active: existingPackage.isActive,
            metadata: {
              plan_type: existingPackage.type,
              ai_consultations:
                existingPackage.limits.aiConsultations === -1
                  ? "unlimited"
                  : existingPackage.limits.aiConsultations,
              medical_reports:
                existingPackage.limits.medicalReports === -1
                  ? "unlimited"
                  : existingPackage.limits.medicalReports,
              booking_discount: existingPackage.limits.bookingDiscount,
            },
          });

          // Create a price for the newly created product
          stripePrice = await stripe.prices.create({
            currency: "usd",
            unit_amount: Math.round(monthly.price * 100), // Convert to cents
            recurring: { interval: "month" },
            product: stripeProduct.id,
          });

          const stripePriceMXN = await stripe.prices.create({
            currency: "mxn",
            unit_amount: Math.round(monthly.priceMXN * 100), // Convert to cents
            recurring: { interval: "month" },
            product: stripeProduct.id,
          });

          existingPackage.stripeProductId = stripeProduct.id;
          existingPackage.stripePriceIds = {
            usd: stripePrice.id,
            mxn: stripePriceMXN.id,
          };
          existingPackage.monthly = {
            price: monthly.price,
            priceMXN: monthly.priceMXN,
          };
        }
      }

      // Update monthly price if provided
      if (monthly) existingPackage.monthly = monthly;

      // Save the updated plan
      await existingPackage.save();

      // Return the updated plan
      return next(new OkResponse(existingPackage));
    } catch (error) {
      console.error("🔥 Error updating package:", error);
      return next(
        new BadRequestResponse("Failed to update subscription package")
      );
    }
  }
);

module.exports = router;
