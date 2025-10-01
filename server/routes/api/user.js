let mongoose = require("mongoose");
let router = require("express").Router();
let passport = require("passport");
let User = mongoose.model("User");
let Appointment = mongoose.model("Appointment");
let Meeting = mongoose.model("Meeting");
let Categories = mongoose.model("categories");
let Wallet = mongoose.model("Wallet");
let Hospital = mongoose.model("Hospital");
let moment = require("moment-timezone");

let auth = require("../auth");
let {
  OkResponse,
  BadRequestResponse,
  UnauthorizedResponse,
  NotFoundResponse,
} = require("express-http-response");
let { sendEmail } = require("../../utilities/nodemailer");
const { backend } = require("../../config");
const { sendNotification } = require("../../utilities/notification");
const i18next = require("../../utilities/i18next");
const i18nextMiddleware = require("i18next-http-middleware");
const UserSubscription = require("../../models/UserSubscription");
const Plan = require("../../models/Plan");
const { OTPMessage } = require("../../constants/CustomMessages");
const TwilioService = require("../../utilities/twilioService");

router.use(i18nextMiddleware.handle(i18next));

router.param("email", (req, res, next, email) => {
  User.findOne({ email }, (err, user) => {
    if (err) return next(new BadRequestResponse(err.message));
    if (!user)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"), 423)
      );
    req.userToUpdate = user;
    return next();
  });
});

router.get("/context", auth.required, auth.user, (req, res, next) => {
  return next(new OkResponse(req.user.toAuthJSON()));
});

router.post("/login", (req, res, next) => {
  passport.authenticate(
    "local",
    { session: false, passReqToCallback: true },
    function (err, user, info) {
      if (err) return next(new BadRequestResponse(req.t("user.errors.error")));
      if (!user && !!info) return next(new BadRequestResponse(info.error, 423));
      if (!user && !!!info)
        return next(
          new NotFoundResponse(req.t("user.errors.userNotFound"), 404)
        );
      if (!user.isEmailVerified)
        return next(
          new BadRequestResponse(
            req.t("user.errors.emailNotVerified"),
            403,
            (moreInfo = { isEmailVerified: false })
          )
        );

      if (user && user.role === "doctor" && user.status == "pending")
        return next(
          new UnauthorizedResponse(req.t("user.errors.inactiveAccount"), 403)
        );
      if (user && user.role === "doctor" && user.profileCompletionStatus < 4)
        return next(
          new UnauthorizedResponse(
            req.t("user.notifications.profileCompletion"),
            403,
            (moreInfo = { isProfileCompleted: false })
          )
        );
      if (user && user.role === "hospital" && user.profileCompletionStatus < 5)
        return next(
          new UnauthorizedResponse(
            req.t("user.notifications.profileCompletion"),
            403,
            (moreInfo = { isProfileCompleted: false })
          )
        );
      if (user.status === "inactive")
        return next(
          new UnauthorizedResponse(req.t("user.errors.inactiveAccount"), 402)
        );
      if (user.role !== req.body.user.role)
        // Use the role from the request
        return next(
          new UnauthorizedResponse(req.t("user.errors.roleNotAuthorized"), 402)
        );

      return next(new OkResponse({ user: user.toAuthJSON() }));
    }
  )(req, res, next);
});

router.post("/signup", async (req, res, next) => {
  try {
    const { professionalLicenseNumber, ...rest } = req.body;
    const foundUser = await User.findOne({
      email: req.body.email.toLowerCase(),
    }).exec();

    if (foundUser && foundUser.role === "patient") {
      return next(
        new BadRequestResponse(req.t("user.errors.userAlreadyExists"), 423)
      );
    }
    if (
      foundUser &&
      foundUser.role === "doctor" &&
      foundUser.profileCompletionStatus >= 4
    ) {
      return next(
        new BadRequestResponse(req.t("user.errors.userAlreadyExists"), 423)
      );
    }

    if (
      foundUser &&
      foundUser.role === "hospital" &&
      foundUser.profileCompletionStatus >= 5
    ) {
      return next(
        new BadRequestResponse(req.t("user.errors.userAlreadyExists"), 423)
      );
    }
    if (
      foundUser &&
      foundUser.role === "doctor" &&
      foundUser.profileCompletionStatus < 4 &&
      foundUser.validPassword(req.body.password)
    ) {
      return next(new OkResponse({ user: foundUser.toAuthJSON() }));
    }

    if (
      foundUser &&
      foundUser.role === "hospital" &&
      foundUser.profileCompletionStatus < 5 &&
      foundUser.validPassword(req.body.password)
    ) {
      return next(new OkResponse({ user: foundUser.toAuthJSON() }));
    }

    let user = new User({
      ...rest,
      professionalLicenseNumber: professionalLicenseNumber || "",
    });
    user.setPassword(req.body.password);
    user.fullName = req.body.fullName;
    user.role = req.body.role;
    user.generateWebToken();

    if (req.body.role === "doctor" || req.body.role === "hospital") {
      user.profileCompletionStatus = 1;
    } else {
      user.profileCompletionStatus = 1;
      user.status = "active";
    }

    user.setOTP();

    let wallet = new Wallet();
    await wallet.save();
    user.wallet = wallet._id;

    const result = await user.save();

    if (req.body.role == "patient") {
      const freePlan = await Plan.findOne({ type: "free" });
      if (!freePlan) {
        return;
      }
      console.log("Free plan ", freePlan);
      const newUserSubscription = new UserSubscription({
        userId: result._id,
        plan: freePlan._id,
        status: "active",
        aiConsultationsLeft: freePlan.limits.aiConsultations,
        medicalReportsLeft: freePlan.limits.medicalReports,
      });
      await newUserSubscription.save();
    }

    if (user.profileCompletionStatus === 1)
      sendEmail(user, req.t("user.messages.emailVerificationSent"), {
        verifyEmail: true,
      });
    return next(new OkResponse({ user: user.toAuthJSON() }));
  } catch (err) {
    return next(new BadRequestResponse(req.t("user.errors.error")));
  }
});

router.post("/signup/social", async (req, res, next) => {
  let {
    firstName,
    lastName,
    email,
    accountType,
    profileImage,
    googleId,
    role,
  } = req.body;
  if (!firstName || !lastName || !email || !accountType || !role) {
    return next(
      new BadRequestResponse(req.t("user.errors.missingRequiredFields"))
    );
  }

  let exitingUser = await User.findOne({ googleId });

  if (exitingUser?.status === "inactive")
    return next(
      new UnauthorizedResponse(req.t("user.errors.inactiveAccount"), 402)
    );
  if (exitingUser) {
    if (exitingUser.role != role) {
      return next(
        new UnauthorizedResponse(req.t("user.errors.roleNotAuthorized"), 402)
      );
    }
    return next(new OkResponse({ user: exitingUser.toAuthJSON() }));
  }

  let user = new User({
    fullName: firstName + " " + lastName,
    email,
    accountType,
    status: role === "patient" ? "active" : "pending",
    profileImage,
    googleId: googleId,
    role: role,
    isEmailVerified: true,
    profileCompletionStatus: role === "patient" ? 1 : 2,
  });

  const result = user.save();

  if (result.role == "patient") {
    const freePlan = await Plan.findOne({ type: "free" });
    if (!freePlan) {
      return;
    }
    console.log("Free plan ", freePlan);
    const newUserSubscription = new UserSubscription({
      userId: result._id,
      plan: freePlan._id,
      status: "active",
      aiConsultationsLeft: freePlan.limits.aiConsultations,
      medicalReportsLeft: freePlan.limits.medicalReports,
    });
    await newUserSubscription.save();
  }
  return next(new OkResponse({ user: user.toAuthJSON() }));

  user
    .save()
    .then(async () => {
      return next(new OkResponse({ user: user.toAuthJSON() }));
    })
    .catch((e) => {
      return next(new BadRequestResponse(e));
    });
});

router.post("/forgot/email", function (req, res, next) {
  if (!req.body.email)
    return next(
      new BadRequestResponse(req.t("user.errors.missingRequiredFields"), 422.0)
    );

  User.findOne({ email: req.body.email }, (err, user) => {
    if (err) return next(new BadRequestResponse(err));
    if (user?.googleId)
      return next(
        new BadRequestResponse(
          req.t("user.auth.errors.userAlreadyRegisteredWithGoogle"),
          422.0
        )
      );
    if (!user)
      return next(
        new BadRequestResponse(req.t("user.errors.userNotFound"), 422.0)
      );
    user.generatePasswordRestToken();
    user.setOTP();
    user.otpExpires = Date.now() + 1800000; // 30 mins
    user.save((err, user) => {
      if (err) return next(new BadRequestResponse(err));
      sendEmail(user, "Forgot Email", { forgetEmail: true });
      return next(
        new OkResponse({ message: req.t("user.messages.forgotEmailSent") })
      );
    });
  });
});

router.post("/otp/verify/:email/:verificationType", (req, res, next) => {
  if (!req.body.otp) {
    return next(
      new BadRequestResponse(req.t("user.errors.missingRequiredFields"), 422)
    );
  }

  let query = {
    email: req.userToUpdate.email,
    otp: req.body.otp,
    otpExpires: { $gt: Date.now() },
  };

  User.findOne(query, function (err, user) {
    if (err) return next(new UnauthorizedResponse(err));
    if (!user)
      return next(
        new UnauthorizedResponse(req.t("user.errors.invalidOtp"), 422)
      );
    user.otp = null;
    user.otpExpires = null;
    if (req.params.verificationType === "registration") {
      user.isEmailVerified = true;
    } else if (req.params.verificationType === "phone") {
      user.isOtpVerified = true;
    } else {
      user.generatePasswordRestToken();
    }

    if (
      user.role === "doctor" ||
      (user.role === "hospital" &&
        req.params.verificationType == "registration")
    )
      if (req.params.verificationType !== "phone") {
        user.profileCompletionStatus = 2;
      }

    user.save().then(function () {
      if (req.params.verificationType === "registration") {
        return next(new OkResponse(user.toAuthJSON()));
      } else if (req.params.verificationType === "phone") {
        return next(new OkResponse(user.toAuthJSON()));
      } else if (req.params.verificationType === "resetPassword") {
        return next(
          new OkResponse({ resetPasswordToken: user.resetPasswordToken })
        );
      }
    });
  });
});

router.post("/otp/resend/:email", async (req, res, next) => {
  req.userToUpdate.otp = null;
  req.userToUpdate.isOtpVerified = false;

  req.userToUpdate.setOTP();

  req.userToUpdate.save(async (err, result) => {
    if (!!err) return next(new BadRequestResponse(err));
    sendEmail(req.userToUpdate, "Email Verification", { verifyEmail: true });
    if (req.userToUpdate.phone) {
      const twilioResponse = await TwilioService.sendOTP(
        req.userToUpdate.phone,
        req.userToUpdate.otp
      );
      console.log("twilioResponse", twilioResponse);
    }
    return next(new OkResponse(result));
  });
});

router.post("/otp/send", async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return next(
        new BadRequestResponse(req.t("user.errors.missingRequiredFields"), 422)
      );
    }

    console.log("api coming here", email, phone);
    console.log("api coming here", email, phone);

    const findUser = await User.findOne({ email });

    if (!findUser) {
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"), 423)
      );
    }
    let oldPhone = findUser.phone;
    findUser.setOTP();
    findUser.phone = phone.startsWith("+") ? phone : `+${phone}`;

    const result = await findUser.save();

    try {
      const twilioResponse = await TwilioService.sendOTP(
        findUser.phone,
        findUser.otp
      );
      console.log("twilioResponse", twilioResponse);
    } catch (error) {
      findUser.phone = oldPhone;
      findUser.otp = null;
      findUser.otpExpires = null;
      findUser.save();
      return next(new BadRequestResponse(error.message));
    }

    // sendSMS({ to: phone, message: OTPMessage(findUser.otp) });
    return next(new OkResponse(result));
  } catch (error) {
    return next(
      new BadRequestResponse(req.t("user.auth.errors.invalidCredentials"))
    );
  }
});

router.post(
  "/set-new-password/:email/:resetPasswordToken",
  (req, res, next) => {
    if (req.userToUpdate.resetPasswordToken === req.params.resetPasswordToken) {
      if (!req.body.password || req.body.password == "")
        return next(
          new BadRequestResponse(
            req.t("user.errors.missingRequiredFields"),
            422
          )
        );
      req.userToUpdate.setPassword(req.body.password);
      req.userToUpdate.resetPasswordToken = null;
      req.userToUpdate.isEmailVerified = true;

      req.userToUpdate.save(function (err) {
        if (err) return next(new BadRequestResponse(err));
        return next(new OkResponse(req.t("user.messages.passwordChanged")));
      });
    } else
      return next(
        new BadRequestResponse(req.t("user.auth.errors.invalidCredentials"))
      );
  }
);

router.put("/update-password", auth.required, auth.user, (req, res, next) => {
  if (!!!req.body.currentPassword || !!!req.body.password)
    return next(
      new BadRequestResponse(req.t("user.errors.missingRequiredFields"), 422)
    );

  if (req.body.currentPassword === req.body.password)
    return next(
      new BadRequestResponse(req.t("user.errors.oldAndNewPasswordSame"), 422)
    );

  if (!req.user.validPassword(req.body.currentPassword))
    return next(
      new BadRequestResponse(req.t("user.errors.invalidOldPassword"), 422)
    );

  req.user.setPassword(req.body.password);
  req.user.save(function (err) {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(req.t("user.messages.passwordChanged")));
  });
});

router.post("/hospital", auth.required, auth.user, async (req, res, next) => {
  try {
    // Check if the user role is "hospital" and profileCompletionStatus is not completed
    if (req.user.role === "hospital" && !req.user.profileCompletionStatus) {
      throw new BadRequestResponse(
        req.t("user.errors.missingRequiredFields"),
        422
      );
    }

    let hospital;
    if (req.user.profileCompletionStatus === 2) {
      hospital = new Hospital({
        userId: req.user._id,
        name: req.user.fullName,
        profileImage: req.user.profileImage,
        website: req.body.website,
        address: req.body.address,
        representative: req.body.representative,
        phone: req.body.phone,
      });
      await hospital.save();

      req.user.hospitals = hospital._id || req.user.hospitals;
    }

    if (req.user.role === "hospital") {
      req.user.profileCompletionStatus =
        req.body.profileCompletionStatus > req.user.profileCompletionStatus
          ? req.body.profileCompletionStatus
          : req.user.profileCompletionStatus;
    }
    req.user.save((err, user) => {
      if (err) {
        throw new BadRequestResponse(err.message);
      }
      return next(new OkResponse(user.toAuthJSON()));
    });
  } catch (error) {
    return next(error);
  }
});

router.put(
  "/update-hospital",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      if (req.user.role === "hospital" && !!!req.user.profileCompletionStatus) {
        throw new BadRequestResponse(
          req.t("user.errors.missingRequiredFields"),
          422
        );
      }

      const findHospital = await Hospital.findById(req.user.hospitals[0]);

      if (!findHospital) {
        throw new NotFoundResponse(req.t("user.errors.hospitalNotFound"));
      }

      findHospital.specialties =
        req.body.specialties || findHospital.specialties;
      findHospital.images = req.body.images || findHospital.images;
      findHospital.license = req.body.license || findHospital.license;
      findHospital.certificate =
        req.body.certificate || findHospital.certificate;
      await findHospital.save();

      if (req.user.role === "hospital") {
        req.user.profileCompletionStatus =
          req.body.profileCompletionStatus > req.user.profileCompletionStatus
            ? req.body.profileCompletionStatus
            : req.user.profileCompletionStatus;
      }
      if (
        req.user.role === "hospital" &&
        req.body.profileCompletionStatus >= 4
      ) {
        const hosp = await Hospital.findById(req.user.hospitals[0]);

        console.log("findHospital", findHospital);
        console.log("hosp", hosp);

        const admin = await User.findOne({ role: "admin" });
        if (!admin) {
          return next(new BadRequestResponse("Admin user not found"));
        }
        await sendNotification(
          "New Hospital Profile Pending Approval",
          "A new Hospital profile has been created and requires your review and approval",
          "Se ha creado un nuevo perfil de hospital y requiere tu revisión y aprobación.",
          admin._id,
          null,
          null,
          (data = {}),
          findHospital._id
        );
      }

      req.user.save((err, user) => {
        if (err) {
          throw new BadRequestResponse(err);
        }
        return next(new OkResponse(user.toAuthJSON()));
      });
    } catch (error) {
      console.log(error);
      return next(error);
    }
  }
);

router.put(
  "/update-profile",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      if (req.user.role === "doctor" && !!!req.user.profileCompletionStatus) {
        throw new BadRequestResponse(
          req.t("user.errors.missingRequiredFields"),
          422
        );
      }

      console.log("req.body in update profile", req.body);

      console.log("req.user in update profile", req.user);

   
      req.user.fullName = req.body.fullName || req.user.fullName;
      req.user.age = req.body.age || req.user.age;
      req.user.height = req.body.height || req.user.height;
      req.user.weight = req.body.weight || req.user.weight;

      req.user.sex = req.body.sex || req.user.sex;
      req.user.language = req.body.language || req.user.language;
      req.user.birthDate = req.body.birthDate || req.user.birthdate;
      req.user.otherContact = req.body.otherContact || req.user.otherContact;
      req.user.profileImage = req.body.profileImage || req.user.profileImage;
      req.user.phone = req.body.phone || req.user.phone;
      req.user.address = req.body.address || req.user.address;
      req.user.specialty = req.body.specialty || req.user.specialty;
      req.user.license = req.body.license || req.user.license;
      req.user.proofOfStudy = req.body.proofOfStudy || req.user.proofOfStudy;
      req.user.certificate = req.body.certificate || req.user.certificate;
      req.user.profileImage = req.body.profileImage || req.user.profileImage;
      req.user.about = req.body.about || req.user.about;
      req.user.timeZone = req.body.timeZone || req.user.timeZone;
      req.user.fee = req.body.fee || req.user.fee;
      req.user.experience = req.body.experience || req.user.experience;
      req.user.signature = req.body.signature || req.user.signature;
      req.user.curp = req.body.curp || req.user.curp;
      req.user.state = req.body.state || req.user.state;
      req.user.professionalLicenseNumber =
        req.body.professionalLicenseNumber ||
        req.user.professionalLicenseNumber;

      if (req.user.role === "doctor") {
        req.user.profileCompletionStatus =
          req.body.profileCompletionStatus > req.user.profileCompletionStatus
            ? req.body.profileCompletionStatus
            : req.user.profileCompletionStatus;
      }

      if (
        req.user.role === "doctor" &&
        req.user.profileCompletionStatus >= 4 &&
        req.user.status === "pending" &&
        !req.user.isNotified
      ) {
        const admin = await User.findOne({ role: "admin" });
        await sendNotification(
          "New Doctor Profile Pending Approval",
          "A new Doctor profile has been created and requires your review and approval",
          "Se ha creado un nuevo perfil de médico y requiere tu revisión y aprobación.",
          admin?._id,
          req?.user?._id
        );

        await sendNotification(
          "Signing Up",
          "Thank you for signing up with Ai-Medik. Your account is under review. Please complete your profile, and we'll notify you upon approval.",
          "Gracias por registrarte en Ai-Medik. Tu cuenta está en revisión. Por favor, completa tu perfil y te notificaremos una vez aprobado.",
          req?.user?._id
        );
        req.user.isNotified = true;
      }

      req.user.save((err, user) => {
        if (err) {
          console.log(
            "error in update profile*******************",
            err.message
          );
          return next(new BadRequestResponse(err.message));
        }


       

        return next(new OkResponse(user.toAuthJSON()));
      });
    } catch (error) {
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.put("/profile", auth.required, auth.user, (req, res, next) => {
  if (!req.body)
    return next(
      new BadRequestResponse(
        req.t("user.errors.missingRequiredParameter"),
        422.0
      )
    );

    console.log("req.body in profile ************** ", req.body);
  


  req.user.email = req.body.email || req.user.email;
  req.user.profileImage = req.body.profileImage || req.user.profileImage;

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));

    return next(new OkResponse(data));
  });
});

router.post("/education", auth.required, auth.doctor, (req, res, next) => {
  if (!!!req.body)
    return next(
      new BadRequestResponse(
        req.t("user.errors.missingRequiredParameter"),
        422.0
      )
    );

  req.user.education = [...req.user.education, req.body];

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(data.toAuthJSON()));
  });
});

router.post("/timings", auth.required, auth.doctor, async (req, res, next) => {
  try {
    const { availability } = req.body;
    const doctorTimeZone = req.user.timeZone;

    console.log("availability in timings **************", availability);

    if (!doctorTimeZone) {
      return next(new BadRequestResponse(req.t("errors.timeZoneRequired")));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new NotFoundResponse(req.t("user.errors.userNotFound")));
    }

    const updatedAvailability = availability.map((session) => {
      const dateTimeString = `${moment()
        .isoWeekday(session.day)
        .format("YYYY-MM-DD")}T${session.startTime}:00`;
      const utcDateTime = moment.tz(dateTimeString, doctorTimeZone).utc();

      const utcDayOfWeek = utcDateTime.day();
      const utcStartTime = utcDateTime.format("HH:mm");

      return {
        date: utcDateTime.toDate(),
        dayOfWeek: utcDayOfWeek,
        startTime: utcStartTime,
        type: session.type,
        duration: session.duration,
      };
    });

    console.log(
      "updatedAvailability in timings **************",
      updatedAvailability
    );

    // Checking for overlapping slots (not just exact duplicates)
    const overlappingSlots = [];

    for (const newSlot of updatedAvailability) {
      const newLocalDateTime = moment.tz(newSlot.date, doctorTimeZone);
      const newLocalDayOfWeek = newLocalDateTime.day();
      const newLocalStartTime = newLocalDateTime.format("HH:mm");

      // Calculating new slot end time
      const newSlotDuration = newSlot.duration === "1 hour" ? 1 : 0.5;
      const newSlotEndTime = moment
        .tz(newSlot.date, doctorTimeZone)
        .add(newSlotDuration, "hours")
        .format("HH:mm");

      // Checking against existing slots for overlap
      const hasOverlap = user.availability.some((existingSlot) => {
        const existingLocalDateTime = moment.tz(
          existingSlot.date,
          doctorTimeZone
        );
        const existingLocalDayOfWeek = existingLocalDateTime.day();
        const existingLocalStartTime = existingLocalDateTime.format("HH:mm");

        // Checking slots on the same day and same time period (morning/afternoon/evening)
        if (
          existingLocalDayOfWeek !== newLocalDayOfWeek ||
          existingSlot.type !== newSlot.type
        ) {
          return false;
        }

        // Calculating existing slot end time
        const existingSlotDuration =
          existingSlot.duration === "1 hour" ? 1 : 0.5;
        const existingSlotEndTime = moment
          .tz(existingSlot.date, doctorTimeZone)
          .add(existingSlotDuration, "hours")
          .format("HH:mm");

        // Checking for overlap
        const newStart = moment(newLocalStartTime, "HH:mm");
        const newEnd = moment(newSlotEndTime, "HH:mm");
        const existingStart = moment(existingLocalStartTime, "HH:mm");
        const existingEnd = moment(existingSlotEndTime, "HH:mm");

        // Overlap occurs when:
        // 1. New slot starts before existing slot ends AND new slot ends after existing slot starts
        // 2. New slot starts at the same time as existing slot
        // 3. New slot ends at the same time as existing slot
        return (
          (newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart)) ||
          newStart.isSame(existingStart) ||
          newEnd.isSame(existingEnd)
        );
      });

      if (hasOverlap) {
        overlappingSlots.push(newSlot);
      }
    }

    if (overlappingSlots.length > 0) {
      const overlapDetails = overlappingSlots
        .map((slot) => {
          const slotLocalDateTime = moment.tz(slot.date, doctorTimeZone);
          const slotLocalDay = slotLocalDateTime.format("dddd");
          const slotLocalTime = slotLocalDateTime.format("HH:mm");
          const slotEndTime = moment
            .tz(slot.date, doctorTimeZone)
            .add(slot.duration === "1 hour" ? 1 : 0.5, "hours")
            .format("HH:mm");

          return `${slotLocalDay} at ${slotLocalTime}-${slotEndTime} (${slot.duration})`;
        })
        .join(", ");

      return next(
        new OkResponse({
          message: req.t("Common.errorMessage.overlappingSlot"),
          details: `Overlapping slots detected: ${overlapDetails}`,
          error: 409,
        })
      );
    }

    const duplicates = updatedAvailability.filter((newSlot) => {
      const newLocalDateTime = moment.tz(newSlot.date, doctorTimeZone);
      const newLocalDayOfWeek = newLocalDateTime.day();
      const newLocalStartTime = newLocalDateTime.format("HH:mm");

      const hasDuplicate = user.availability.some((existingSlot) => {
        const existingLocalDateTime = moment.tz(
          existingSlot.date,
          doctorTimeZone
        );
        const existingLocalDayOfWeek = existingLocalDateTime.day();
        const existingLocalStartTime = existingLocalDateTime.format("HH:mm");

        return (
          existingLocalDayOfWeek === newLocalDayOfWeek &&
          existingLocalStartTime === newLocalStartTime
        );
      });

      return hasDuplicate;
    });

    if (duplicates.length > 0) {
      const duplicateDetails = duplicates
        .map((duplicate) => {
          const duplicateLocalDateTime = moment.tz(
            duplicate.date,
            doctorTimeZone
          );
          const duplicateLocalDay = duplicateLocalDateTime.format("dddd");
          const duplicateLocalTime = duplicateLocalDateTime.format("HH:mm");

          return `${duplicateLocalDay} at ${duplicateLocalTime}\n`;
        })
        .join(", ");

      return next(
        new OkResponse({
          message: req.t("Common.errorMessage.duplicateSlot"),
          details: `${duplicateDetails}`,
          error: 409,
        })
      );
    }

    user.availability = [...user.availability, ...updatedAvailability];
    await user.save();

    return next(new OkResponse(req.t("messages.slotUpdatedSuccessfully")));
  } catch (error) {
    return next(new BadRequestResponse(error.message));
  }
});

router.get(
  "/availability/:id",
  auth.required,
  auth.user,
  async (req, res, next) => {
    const doctorId = req.params.id;
    const doctorTimeZone = req.user.timeZone;

    if (!doctorTimeZone || !doctorTimeZone) {
      return res
        .status(400)
        .json({ message: req.t("errors.timeZoneRequired") });
    }
    try {
      const doctor = await User.findById(doctorId);

      if (!doctor || !doctor.availability) {
        return res
          .status(404)
          .json({ message: req.t("errors.doctorNotFound") });
      }

      const localAvailability = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((day) => ({
        day: day,
        dayOfWeek: moment().day(day).day(),
        slots: [],
      }));

      doctor.availability.forEach((slot) => {
        const utcDate = moment(slot.date).utc();
        const localDate = utcDate.clone().tz(doctorTimeZone);
        const dayOfWeek = localDate.day();
        const dayName = localDate.format("dddd");
        const startTime = localDate.format("HH:mm");

        const dayIndex = localAvailability.findIndex(
          (d) => d.dayOfWeek === dayOfWeek
        );
        if (dayIndex !== -1) {
          localAvailability[dayIndex].slots.push({
            duration: slot.duration,
            startTime: startTime,
            type: slot.type,
            _id: slot._id,
          });
        }
      });

      const populatedDays = localAvailability.filter(
        (day) => day.slots.length > 0
      );

      return next(new OkResponse(populatedDays));
    } catch (error) {
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.delete(
  "/delete-slot/:slotId",
  auth.required,
  auth.doctor,
  async (req, res, next) => {
    try {
      const { slotId } = req.params;

      const index = req.user.availability.findIndex(
        (slot) => slot._id.toString() === slotId.toString()
      );
      if (index === -1)
        return next(
          new BadRequestResponse(req.t("errors.slotNotFound"), 422.0)
        );
      req.user.availability.splice(index, 1);

      await req.user.save();

      return next(new OkResponse(req.t("messages.slotDeletedSuccessfully")));
    } catch (error) {
      return next(new BadRequestResponse(error.message));
    }
  }
);

// 	const patientTimeZone = "Asia/Karachi";

// 	if (!patientTimeZone || !moment.tz.zone(patientTimeZone)) {
// 			return res.status(400).json({ message: "Valid patient's time zone is required." });
// 	}

// 	try {
// 			const doctor = await User.findById(doctorId);
// 			if (!doctor || !doctor.availability) {
// 					return res.status(404).json({ message: "Doctor not found or availability is missing." });
// 			}

// 			// Fetch bookings for the doctor within the relevant date range
// 			const twoWeeksAhead = 2;
// 			// const startDate = moment.utc().startOf('isoWeek');
// 			// const endDate = moment.utc().startOf('isoWeek').add(twoWeeksAhead, 'weeks');
// 			// const bookings = await Booking.find({
// 			// 		doctor: doctorId,
// 			// 		date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
// 			// 		bookingStatus: { $ne: "cancelled" } // assuming cancelled bookings should not block slots
// 			// });

// 			let availabilityMap = {};

// 			for (let week = 0; week < twoWeeksAhead; week++) {
// 					doctor.availability.forEach(({ dayOfWeek, slots }) => {
// 							slots.forEach(({ type, startTime, duration }) => {

// 								const weekStart = moment.tz(patientTimeZone).startOf('isoWeek').add(week, 'weeks');
// 								const day = moment.utc().add(week, 'weeks').day(dayOfWeek);
// 								const localDayDate = weekStart.clone().add(dayOfWeek, 'days');

// 									const start = moment.tz(`${localDayDate.format('YYYY-MM-DD')}T${startTime}`, patientTimeZone);

// 									const dateKey = start.format('YYYY-MM-DD');
// 									if (!availabilityMap[dateKey]) {
// 											availabilityMap[dateKey] = {
// 													date: dateKey,
// 													date: day.format('YYYY-MM-DD'),
// 													dayOfWeek: start.isoWeekday(),
// 													slots: []
// 											};
// 									}

// 									// Check if the slot is booked
// 									// const isBooked = bookings.some(booking =>
// 									// 		moment.utc(booking.startTime).isSame(start) &&
// 									// 		moment.utc(booking.endTime).isSame(end)
// 									// );

// 									availabilityMap[dateKey].slots.push({
// 											type,
// 											startTime: start.format("HH:mm"), // Local time
// 											// isBooked
// 									});
// 							});
// 					});
// 			}

// 			let availabilityResults = Object.values(availabilityMap);

// 			return next(new OkResponse(availabilityResults));
// 	} catch (error) {
// 			console.error("Error retrieving doctor availability:", error);
// 			res.status(500).json({ message: "Failed to retrieve availability." });
// 	}
// });

//testing api ava
// router.get("/availabilities/:id", async (req, res, next) => {
//   const doctorId = req.params.id;
//   const patientTimeZone = req.query.timeZone;

//   if (!patientTimeZone || !moment.tz.zone(patientTimeZone)) {
//     return res
//       .status(400)
//       .json({ message: "Valid patient's time zone is required." });
//   }

//   try {
//     const doctor = await User.findById(doctorId);

//     if (!doctor || !doctor.availability) {
//       return res
//         .status(404)
//         .json({ message: "Doctor not found or availability is missing." });
//     }

//     const weeksAhead = 3;
//     const bookings = await Appointment.find({
//       doctor: doctorId,
//       isPaid: true,
//     });

//     let availabilityMap = {};
//     for (let week = 0; week < weeksAhead; week++) {
//       doctor.availability.forEach(({ slots, date, dayOfWeek }) => {
//         // console.log("Processing date:", date, "Day of Week:", dayOfWeek);
//         const momentDate = moment(date.$date || date); // Ensure date is parsed correctly

//         // if (dayOfWeek === 3) {
//         //   console.log("Found Wednesday:", momentDate.format());
//         // }

//         slots.forEach(({ type, startTime, duration }) => {
//           console.log(
//             `Processing slot: type=${type}, startTime=${startTime}, duration=${duration}`
//           );
//           const [startHour, startMinute] = startTime.split(":").map(Number);

//           const newDate = momentDate.clone().set({
//             hour: startHour,
//             minute: startMinute,
//             second: 0,
//             millisecond: 0,
//           });

//           console.log("New date created UTC:", newDate.format());

//           // Convert to the local time zone
//           const localDate = moment
//             .utc(newDate)
//             .tz(patientTimeZone)
//             .format("YYYY-MM-DD");
//           console.log("Local date:", localDate);

//           const currentDayOfWeek = moment(localDate).day();
//           console.log("Current day of week:", currentDayOfWeek);

//           // Use the original dayOfWeek value to calculate the correct future date
//           const futureDate = moment(localDate)
//             .startOf("week")
//             .add(currentDayOfWeek, "days")
//             .add(week, "weeks")
//             .tz(patientTimeZone);
//           console.log("Future date:", futureDate.format());

//           let start = moment
//             .utc(`${futureDate.format("YYYY-MM-DD")}T${startTime}`)
//             .tz(patientTimeZone);

//           console.log("New start time:", start.format());

//           const dateKey = futureDate.format("YYYY-MM-DD");
//           if (!availabilityMap[dateKey]) {
//             availabilityMap[dateKey] = {
//               date: futureDate.format("YYYY-MM-DD"),
//               dayOfWeek: currentDayOfWeek,
//               slots: [],
//             };
//           }

//           // Check if the slot is booked
//           const isBooked = bookings.some((booking) =>
//             moment(booking.slotTime).isSame(start)
//           );
//           console.log("Is booked:", isBooked);

//           // Avoid adding duplicate slots
//           const slotExists = availabilityMap[dateKey].slots.some(
//             (slot) => slot.startTime === start.format("HH:mm")
//           );
//           if (!slotExists) {
//             availabilityMap[dateKey].slots.push({
//               type,
//               startTime: start.format("HH:mm"), // Local time
//               isBooked,
//               duration,
//             });
//           }
//         });
//       });
//     }

//     console.log("Availability Map:", JSON.stringify(availabilityMap, null, 2));
//     let availabilityResults = Object.values(availabilityMap);
//     return next(new OkResponse(availabilityResults));
//   } catch (error) {
//     console.error("Error retrieving doctor availability:", error.message);
//     return next(new BadRequestResponse(error));
//   }
// });

//old api
// router.get("/availabilities/:id", async (req, res, next) => {
//   const doctorId = req.params.id;
//   const patientTimeZone = req.query.timeZone;

//   if (!patientTimeZone || !moment.tz.zone(patientTimeZone)) {
//     return res
//       .status(400)
//       .json({ message: "Valid patient's time zone is required." });
//   }

//   try {
//     const doctor = await User.findById(doctorId);

//     if (!doctor || !doctor.availability) {
//       return res
//         .status(404)
//         .json({ message: "Doctor not found or availability is missing." });
//     }

//     const weeksAhead = 3;
//     const bookings = await Appointment.find({
//       doctor: doctorId,
//       isPaid: true,
//     });

//     let availabilityMap = {};
//     for (let week = 0; week < weeksAhead; week++) {
//       doctor.availability.forEach(({ slots, date, dayOfWeek }) => {
//         console.log("Processing date:", date, "Day of Week:", dayOfWeek);
//         const momentDate = moment(date.$date || date); // Ensure date is parsed correctly

//         slots.forEach(({ type, startTime, duration }) => {
//           console.log(
//             `Processing slot: type=${type}, startTime=${startTime}, duration=${duration}`
//           );
//           const [startHour, startMinute] = startTime.split(":").map(Number);

//           const newDate = momentDate.clone().set({
//             hour: startHour,
//             minute: startMinute,
//             second: 0,
//             millisecond: 0,
//           });

//           console.log("New date created UTC:", newDate.format());

//           // Convert to the local time zone
//           const localDate = newDate.tz(patientTimeZone).format("YYYY-MM-DD");
//           console.log("Local date:", localDate);
//           const currentDayOfWeek = newDate.tz(patientTimeZone).day();
//           console.log("Current day of week:", currentDayOfWeek);

//           // Use the original dayOfWeek value to calculate the correct future date
//           const futureDate = moment(localDate)
//             .startOf("week")
//             .add(dayOfWeek, "days")
//             .add(week, "weeks")
//             .tz(patientTimeZone);
//           console.log("Future date:", futureDate.format());

//           const dateKey = futureDate.format("YYYY-MM-DD");
//           if (!availabilityMap[dateKey]) {
//             availabilityMap[dateKey] = {
//               date: dateKey,
//               dayOfWeek: futureDate.day(), // 0-6
//               slots: [],
//             };
//           }

//           let start = moment
//             .utc(`${futureDate.format("YYYY-MM-DD")}T${startTime}`)
//             .tz(patientTimeZone);

//           // Check if the slot is booked
//           const isBooked = bookings.some((booking) =>
//             moment(booking.slotTime).isSame(start)
//           );
//           console.log("Is booked:", isBooked);

//           // Avoid adding duplicate slots
//           const slotExists = availabilityMap[dateKey].slots.some(
//             (slot) => slot.startTime === start.format("HH:mm")
//           );
//           if (!slotExists) {
//             availabilityMap[dateKey].slots.push({
//               type,
//               startTime: start.format("HH:mm"), // Local time
//               isBooked,
//               duration,
//             });
//           }
//         });
//       });
//     }

//     console.log("Availability Map:", JSON.stringify(availabilityMap, null, 2));
//     let availabilityResults = Object.values(availabilityMap);
//     return next(new OkResponse(availabilityResults));
//   } catch (error) {
//     console.error("Error retrieving doctor availability:", error.message);
//     return next(new BadRequestResponse(error));
//   }
// });

//testinng api

router.get("/availabilities/:id", async (req, res, next) => {
  const doctorId = req.params.id;
  const patientTimeZone = req.query.timeZone;

  if (!patientTimeZone || !moment.tz.zone(patientTimeZone)) {
    return res.status(400).json({ message: req.t("auth.errors.unauthorized") });
  }

  try {
    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.availability) {
      return res
        .status(404)
        .json({ message: req.t("auth.errors.userNotFound") });
    }

    const bookings = await Appointment.find({ doctor: doctorId, isPaid: true });

    const weeksAhead = 15;
    let slotsByDate = {};

    doctor.availability.forEach((slot) => {
      const utcDate = moment(slot.date).utc(); // Ensure the date is treated as UTC

      for (let i = 0; i <= weeksAhead; i++) {
        const newDate = utcDate.clone().add(i, "weeks");
        const localDate = newDate.clone().tz(patientTimeZone);
        const utcDateTime = newDate.format("YYYY-MM-DDTHH:mm:ss.SSS+00:00"); // Keep time in UTC for comparison

        const dateKey = localDate.format("YYYY-MM-DD"); // Display key by local date
        const startTime = localDate.format("HH:mm"); // Display local start time

        if (!slotsByDate[dateKey]) {
          slotsByDate[dateKey] = { date: dateKey, slots: [] };
        }

        const isBooked = bookings.some(
          (appointment) =>
            appointment.status !== "cancelled" &&
            moment(appointment.slotTime)
              .utc()
              .format("YYYY-MM-DDTHH:mm:ss.SSS+00:00") === utcDateTime
        );

        slotsByDate[dateKey].slots.push({
          startTime: startTime,
          type: slot.type,
          isBooked: isBooked,
          duration: slot.duration,
        });
      }
    });

    // Convert the slotsByDate object into an array for the response
    const recurringSlots = Object.values(slotsByDate);
    return next(new OkResponse(recurringSlots));
  } catch (error) {
    console.error("Error retrieving doctor availability:", error.message);
    return res.status(500).json({ message: req.t("user.errors.error") });
  }
});

router.put("/education/:_id", auth.required, auth.doctor, (req, res, next) => {
  if (!!!req.body)
    return next(
      new BadRequestResponse(req.t("user.errors.missingRequiredFields"), 422.0)
    );

  const index = req.user.education.findIndex(
    (edu) => edu._id.toString() === req.params._id.toString()
  );
  req.user.education[index] = req.body;

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(data.toAuthJSON()));
  });
});

router.delete(
  "/education/:_id",
  auth.required,
  auth.doctor,
  (req, res, next) => {
    const index = req.user.education.findIndex(
      (edu) => edu._id.toString() === req.params._id.toString()
    );
    if (index === -1)
      return next(
        new BadRequestResponse(req.t("user.errors.itemNotFound"), 422.0)
      );
    req.user.education.splice(index, 1);

    req.user.save((err, data) => {
      if (err) return next(new BadRequestResponse(err));
      return next(new OkResponse(data.toAuthJSON()));
    });
  }
);

router.post("/speciality", auth.required, auth.doctor, (req, res, next) => {
  if (!!!req.body)
    return next(
      new BadRequestResponse(req.t("user.errors.missingRequiredFields"), 422.0)
    );

  req.user.specialities = [...req.user.specialities, req.body];

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(data.toAuthJSON()));
  });
});

router.get("/categories", (req, res, next) => {
  Categories.find((err, categories) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(categories));
  });
});

router.delete(
  "/speciality/:_id",
  auth.required,
  auth.doctor,
  (req, res, next) => {
    const index = req.user.specialities.findIndex(
      (item) => item._id.toString() === req.params._id.toString()
    );
    if (index === -1)
      return next(
        new BadRequestResponse(req.t("user.errors.itemNotFound"), 422.0)
      );
    req.user.specialities.splice(index, 1);

    req.user.save((err, data) => {
      if (err) return next(new BadRequestResponse(err));
      return next(new OkResponse(data.toAuthJSON()));
    });
  }
);

router.post("/awards", auth.required, auth.doctor, (req, res, next) => {
  if (!!!req.body)
    return next(
      new BadRequestResponse(
        req.t("user.auth.errors.missingRequiredFields"),
        422.0
      )
    );

  req.user.awards = [...req.user.awards, req.body];

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(data.toAuthJSON()));
  });
});

router.put("/awards/:_id", auth.required, auth.doctor, (req, res, next) => {
  if (!!!req.body)
    return next(
      new BadRequestResponse(
        req.t("user.auth.errors.missingRequiredFields"),
        422.0
      )
    );

  const index = req.user.awards.findIndex(
    (item) => item._id.toString() === req.params._id.toString()
  );
  req.user.awards[index] = req.body;

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(data.toAuthJSON()));
  });
});

router.delete("/awards/:_id", auth.required, auth.doctor, (req, res, next) => {
  const index = req.user.awards.findIndex(
    (item) => item._id.toString() === req.params._id.toString()
  );
  if (index === -1)
    return next(
      new BadRequestResponse(req.t("user.auth.errors.itemNotFound"), 422.0)
    );
  req.user.awards.splice(index, 1);

  req.user.save((err, data) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(data.toAuthJSON()));
  });
});

//get doctors
router.get("/doctors", (req, res, next) => {
  const { searchDoctor, specialty } = req.query;
  const query = {
    role: "doctor",
    profileCompletionStatus: 4,
    status: "active",
  };

  if (specialty) {
    query.specialty = specialty;
  }

  if (searchDoctor) {
    query.fullName = { $regex: new RegExp(searchDoctor, "i") };
  }

  const options = {
    sort: { createdAt: -1 },
  };

  User.find(query, null, options, (err, doctors) => {
    if (!doctors)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"), 423)
      );
    if (err) return next(new BadRequestResponse(err));

    return next(new OkResponse(doctors));
  });
});

//get doctor by id
router.get("/doctor/:id", (req, res, next) => {
  const id = req.params.id;
  User.findOne({ _id: id }, (err, doctor) => {
    if (!doctor)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"), 423)
      );
    if (err) return next(new BadRequestResponse(err));

    return next(new OkResponse(doctor));
  });
});

router.get("/hospitals", auth.required, auth.user, (req, res, next) => {
  const query = {};

  const options = {
    sort: { createdAt: -1 },
  };

  Hospital.find(query, null, options, (err, hospitals) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(hospitals));
  });
});

router.get("/patients", auth.required, auth.user, async (req, res, next) => {
  try {
    let query = { isPaid: true };
    if (req.user.role === "doctor") query.doctor = req.user._id;
    else if (req.user.role === "patient") query.patient = req.user._id;

    const pipeline = [
      {
        $match: query,
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $group: {
          _id: "$patient",
          appointment: { $first: "$$ROOT" },
        },
      },
    ];

    const uniqueAppointments = await Appointment.aggregate(pipeline);

    // Populate patient details for each unique appointment
    const patients = await User.populate(uniqueAppointments, {
      path: "appointment.patient",
    });

    return next(new OkResponse(patients));
  } catch (err) {
    return next(new BadRequestResponse(err));
  }
});

router.get("/patient/:id", auth.required, auth.doctor, (req, res, next) => {
  const id = req.params.id;
  User.findOne({ _id: id }, (err, doctors) => {
    if (err) return next(new BadRequestResponse(err));
    return next(new OkResponse(doctors));
  });
});

router.get("/app-data", async (req, res, next) => {
  try {
    let webToken = req.query.webToken;
    let appointmentId = req.query.appointmentId;

    const findUser = await User.findOne({ webToken });

    if (!findUser)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"))
      );

    const findAppointment = await Appointment.findOne({ _id: appointmentId });

    if (!findAppointment)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"))
      );

    return next(
      new OkResponse({
        user: findUser.toAuthJSON(),
        appointment: findAppointment,
      })
    );
  } catch (err) {
    console.log("**********************************************", err.message);
    return next(new BadRequestResponse(err.message));
  }
});

router.get("/session-data", async (req, res, next) => {
  try {
    let webToken = req.query.webToken;
    let roomId = req.query.roomId;
    const findUser = await User.findOne({ webToken });
    if (!findUser)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"))
      );

    const findMeeting = await Meeting.findOne({ roomId: roomId });

    if (!findMeeting)
      return next(
        new BadRequestResponse(req.t("user.auth.errors.userNotFound"))
      );

    return next(
      new OkResponse({ user: findUser.toAuthJSON(), meeting: findMeeting })
    );
  } catch (err) {
    console.log("**********************************************", err.message);
    return next(new BadRequestResponse(err.message));
  }
});

router.get("/search", auth.required, auth.user, async (req, res, next) => {
  const searchQuery = req.query.q;

  if (!searchQuery) {
    return next(
      new BadRequestResponse(req.t("user.auth.errors.missingRequiredFields"))
    );
  }

  try {
    let query = { isPaid: true };
    if (req.user.role === "doctor") query.doctor = req.user._id;
    else if (req.user.role === "patient") query.patient = req.user._id;

    const pipeline = [
      {
        $match: query,
      },
      {
        $group: {
          _id: "$patient",
          appointment: { $first: "$$ROOT" },
        },
      },
    ];

    const uniqueAppointments = await Appointment.aggregate(pipeline);

    const patients = await User.populate(uniqueAppointments, {
      path: "appointment.patient",
    });

    const filteredPatients = patients.filter((patient) => {
      const patientName = patient.appointment.patient.fullName;
      const regex = new RegExp(searchQuery, "i");
      return regex.test(patientName);
    });

    return next(new OkResponse(filteredPatients));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

router.get(
  "/search-doctors",
  auth.required,
  auth.user,
  async (req, res, next) => {
    const searchQuery = req.query.q;
    if (!searchQuery) {
      return next(
        new BadRequestResponse(req.t("user.auth.errors.missingRequiredFields"))
      );
    }
    try {
      let query = { isPaid: true };
      if (req.user.role === "doctor") query.doctor = req.user._id;
      else if (req.user.role === "patient") query.patient = req.user._id;

      const pipeline = [
        {
          $match: query,
        },
        {
          $group: {
            _id: "$doctor",
            appointment: { $first: "$$ROOT" },
          },
        },
      ];

      const uniqueAppointments = await Appointment.aggregate(pipeline);

      const doctors = await User.populate(uniqueAppointments, {
        path: "appointment.doctor",
      });

      const filteredDoctors = doctors.filter((doctor) => {
        const doctorName = doctor.appointment.doctor.fullName;
        const regex = new RegExp(searchQuery, "i");
        return regex.test(doctorName);
      });

      return next(new OkResponse(filteredDoctors));
    } catch (error) {
      return next(new BadRequestResponse(error));
    }
  }
);

router.get("/doctor", auth.required, auth.user, async (req, res, next) => {
  try {
    let query = { isPaid: true };
    if (req.user.role === "doctor") query.doctor = req.user._id;
    else if (req.user.role === "patient") query.patient = req.user._id;

    const pipeline = [
      {
        $match: query,
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $group: {
          _id: "$doctor",
          appointment: { $first: "$$ROOT" },
        },
      },
    ];

    const uniqueAppointments = await Appointment.aggregate(pipeline);

    // Populate Doctor details for each unique appointment
    const doctors = await User.populate(uniqueAppointments, {
      path: "appointment.doctor",
    });

    return next(new OkResponse(doctors));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

//for app developer
router.get(
  "/appointments/:id",
  auth.required,
  auth.patient,
  (req, res, next) => {
    let query = { isPaid: true, doctor: req.params.id, patient: req.user._id };

    Appointment.find(query, (err, appointments) => {
      if (err) return next(new BadRequestResponse(err));
      return next(new OkResponse(appointments));
    });
  }
);

router.get("/hospitals", auth.required, auth.user, (req, res, next) => {
  const query = {};
  const options = {};

  Hospital.find(query, null, options, (err, docs) => {
    if (err) return next(new BadRequestResponse(err));

    return next(new OkResponse(docs));
  });
});

router.put(
  "/notification/token",
  auth.required,
  auth.user,
  (req, res, next) => {
    let notificationToken = req.body.notificationToken;
    if (!notificationToken) {
      return next(
        new BadRequestResponse(req.t("user.auth.errors.missingRequiredFields"))
      );
    }

    req.user.notificationToken = notificationToken;
    req.user
      .save()
      .then(() => {
        return next(new OkResponse(req.t("user.auth.messages.success")));
      })
      .catch((e) => {
        return next(new BadRequestResponse(e));
      });
  }
);

// router.post("/awards", auth.required, auth.doctor, (req, res, next) => {
// 	if (!!!req.body) return next(new BadRequestResponse("Missing required parameter.", 422.0));

// 	req.user.awards = [...req.user.awards, req.body];

// 	req.user.save((err, data) => {
// 		if (err) return next(new BadRequestResponse(err));
// 		return next(new OkResponse(data.toAuthJSON()));
// 	});
// });

// router.put("/awards/:_id", auth.required, auth.doctor, (req, res, next) => {
// 	if (!!!req.body) return next(new BadRequestResponse("Missing required parameter.", 422.0));

// 	const index = req.user.awards.findIndex((item) => item._id.toString() === req.params._id.toString());
// 	req.user.awards[index] = req.body;

// 	req.user.save((err, data) => {
// 		if (err) return next(new BadRequestResponse(err));
// 		return next(new OkResponse(data.toAuthJSON()));
// 	});
// });

// router.delete("/awards/:_id", auth.required, auth.doctor, (req, res, next) => {
// 	const index = req.user.awards.findIndex((item) => item._id.toString() === req.params._id.toString());
// 	if (index === -1) return next(new BadRequestResponse("Item not found", 422.0));
// 	req.user.awards.splice(index, 1);

// 	req.user.save((err, data) => {
// 		if (err) return next(new BadRequestResponse(err));
// 		return next(new OkResponse(data.toAuthJSON()));
// 	});
// });

// //get doctors
// router.get("/doctors", (req, res, next) => {
// 	const { searchDoctor, specialty } = req.query;
// 	const query = {
// 		role: "doctor",
// 		profileCompletionStatus: 4,
// 		status: "active",
// 	};

// 	if (specialty) {
// 		query.specialty = specialty;
// 	}

// 	if (searchDoctor) {
// 		query.fullName = { $regex: new RegExp(searchDoctor, "i") };
// 	}

// 	const options = {
// 		sort: { createdAt: -1 },
// 	};

// 	User.find(query, null, options, (err, doctors) => {
// 		if (!doctors) return next(new BadRequestResponse("Doctor not found!", 423));
// 		if (err) return next(new BadRequestResponse(err));

// 		return next(new OkResponse(doctors));
// 	});
// });

// //get doctor by id
// router.get("/doctor/:id", auth.required, (req, res, next) => {
// 	const id = req.params.id;
// 	User.findOne({ _id: id }, (err, doctor) => {
// 		if (!doctor) return next(new BadRequestResponse("Doctor not found!", 423));
// 		if (err) return next(new BadRequestResponse(err));

// 		return next(new OkResponse(doctor));
// 	});
// });

// router.get("/hospitals", auth.required, auth.user, (req, res, next) => {
// 	const query = {};

// 	const options = {
// 		sort: { createdAt: -1 },
// 	};

// 	Hospital.find(query, null, options, (err, hospitals) => {
// 		if (err) return next(new BadRequestResponse(err));
// 		return next(new OkResponse(hospitals));
// 	});
// });

// router.get("/patients", auth.required, auth.user, async (req, res, next) => {
// 	try {
// 		let query = { isPaid: true };
// 		if (req.user.role === "doctor") query.doctor = req.user._id;
// 		else if (req.user.role === "patient") query.patient = req.user._id;

// 		const pipeline = [
// 			{
// 				$match: query,
// 			},
// 			{
// 				$sort: { created_at: -1 },
// 			},
// 			{
// 				$group: {
// 					_id: "$patient",
// 					appointment: { $first: "$$ROOT" },
// 				},
// 			},
// 		];

// 		const uniqueAppointments = await Appointment.aggregate(pipeline);

// 		// Populate patient details for each unique appointment
// 		const patients = await User.populate(uniqueAppointments, {
// 			path: "appointment.patient",
// 		});

// 		return next(new OkResponse(patients));
// 	} catch (err) {
// 		return next(new BadRequestResponse(err));
// 	}
// });

// router.get("/patient/:id", auth.required, auth.doctor, (req, res, next) => {
// 	const id = req.params.id;
// 	User.findOne({ _id: id }, (err, doctors) => {
// 		if (err) return next(new BadRequestResponse(err));
// 		return next(new OkResponse(doctors));
// 	});
// });

// router.get("/app-data", async (req, res, next) => {
// 	try {
// 		let webToken = req.query.webToken;
// 		let appointmentId = req.query.appointmentId;

// 		const findUser = await User.findOne({ webToken });

// 		if (!findUser) return next(new BadRequestResponse("User not found"));

// 		const findAppointment = await Appointment.findOne({ _id: appointmentId });

// 		if (!findAppointment) return next(new BadRequestResponse("Appointment not found"));

// 		return next(
// 			new OkResponse({
// 				user: findUser.toAuthJSON(),
// 				appointment: findAppointment,
// 			})
// 		);
// 	} catch (err) {
// 		console.log("**********************************************", err.message);
// 		return next(new BadRequestResponse(err.message));
// 	}
// });

// router.get("/session-data", async (req, res, next) => {
// 	try {
// 		let webToken = req.query.webToken;
// 		let roomId = req.query.roomId;
// 		const findUser = await User.findOne({ webToken });
// 		if (!findUser) return next(new BadRequestResponse("User not found"));

// 		const findMeeting = await Meeting.findOne({ roomId: roomId });

// 		if (!findMeeting) return next(new BadRequestResponse("Appointment not found"));

// 		return next(new OkResponse({ user: findUser.toAuthJSON(), meeting: findMeeting }));
// 	} catch (err) {
// 		console.log("**********************************************", err.message);
// 		return next(new BadRequestResponse(err.message));
// 	}
// });

// router.get("/search", auth.required, auth.user, async (req, res, next) => {
// 	const searchQuery = req.query.q;

// 	if (!searchQuery) {
// 		return next(new BadRequestResponse("Missing search query"));
// 	}

// 	try {
// 		let query = { isPaid: true };
// 		if (req.user.role === "doctor") query.doctor = req.user._id;
// 		else if (req.user.role === "patient") query.patient = req.user._id;

// 		const pipeline = [
// 			{
// 				$match: query,
// 			},
// 			{
// 				$group: {
// 					_id: "$patient",
// 					appointment: { $first: "$$ROOT" },
// 				},
// 			},
// 		];

// 		const uniqueAppointments = await Appointment.aggregate(pipeline);

// 		const patients = await User.populate(uniqueAppointments, {
// 			path: "appointment.patient",
// 		});

// 		const filteredPatients = patients.filter((patient) => {
// 			const patientName = patient.appointment.patient.fullName;
// 			const regex = new RegExp(searchQuery, "i");
// 			return regex.test(patientName);
// 		});

// 		return next(new OkResponse(filteredPatients));
// 	} catch (error) {
// 		return next(new BadRequestResponse(error));
// 	}
// });

// router.get("/search-doctors", auth.required, auth.user, async (req, res, next) => {
// 	const searchQuery = req.query.q;
// 	if (!searchQuery) {
// 		return next(new BadRequestResponse("Missing search query"));
// 	}
// 	try {
// 		let query = { isPaid: true };
// 		if (req.user.role === "doctor") query.doctor = req.user._id;
// 		else if (req.user.role === "patient") query.patient = req.user._id;

// 		const pipeline = [
// 			{
// 				$match: query,
// 			},
// 			{
// 				$group: {
// 					_id: "$doctor",
// 					appointment: { $first: "$$ROOT" },
// 				},
// 			},
// 		];

// 		const uniqueAppointments = await Appointment.aggregate(pipeline);

// 		const doctors = await User.populate(uniqueAppointments, {
// 			path: "appointment.doctor",
// 		});

// 		const filteredDoctors = doctors.filter((doctor) => {
// 			const doctorName = doctor.appointment.doctor.fullName;
// 			const regex = new RegExp(searchQuery, "i");
// 			return regex.test(doctorName);
// 		});

// 		return next(new OkResponse(filteredDoctors));
// 	} catch (error) {
// 		return next(new BadRequestResponse(error));
// 	}
// });

// router.get("/doctor", auth.required, auth.user, async (req, res, next) => {
// 	try {
// 		let query = { isPaid: true };
// 		if (req.user.role === "doctor") query.doctor = req.user._id;
// 		else if (req.user.role === "patient") query.patient = req.user._id;

// 		const pipeline = [
// 			{
// 				$match: query,
// 			},
// 			{
// 				$sort: { created_at: -1 },
// 			},
// 			{
// 				$group: {
// 					_id: "$doctor",
// 					appointment: { $first: "$$ROOT" },
// 				},
// 			},
// 		];

// 		const uniqueAppointments = await Appointment.aggregate(pipeline);

// 		// Populate Doctor details for each unique appointment
// 		const doctors = await User.populate(uniqueAppointments, {
// 			path: "appointment.doctor",
// 		});

// 		return next(new OkResponse(doctors));
// 	} catch (error) {
// 		return next(new BadRequestResponse(error));
// 	}
// });

// //for app developer
// router.get("/appointments/:id", auth.required, auth.patient, (req, res, next) => {
// 	let query = { isPaid: true, doctor: req.params.id, patient: req.user._id };

// 	Appointment.find(query, (err, appointments) => {
// 		if (err) return next(new BadRequestResponse(err));
// 		return next(new OkResponse(appointments));
// 	});
// });

// router.get("/hospitals", auth.required, auth.user, (req, res, next) => {
// 	const query = {};
// 	const options = {};

// 	Hospital.find(query, null, options, (err, docs) => {
// 		if (err) return next(new BadRequestResponse(err));

// 		return next(new OkResponse(docs));
// 	});
// });

// router.put("/notification/token", auth.required, auth.user, (req, res, next) => {
// 	let notificationToken = req.body.notificationToken;
// 	if (!notificationToken) {
// 		return next(new BadRequestResponse("Notification token is required"));
// 	}

// 	req.user.notificationToken = notificationToken;
// 	req.user
// 		.save()
// 		.then(() => {
// 			return next(new OkResponse("Notification token updated successfully"));
// 		})
// 		.catch((e) => {
// 			return next(new BadRequestResponse(e));
// 		});
// });

module.exports = router;
