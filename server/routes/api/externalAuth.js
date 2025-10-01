let router = require("express").Router();
let passport = require("passport");
let {  BadRequestResponse } = require("express-http-response");
let User = require("../../models/User");
let { backend } = require("../../config");
const { ErrorMessages } = require("../../constants/CustomMessages");
let Wallet = require("../../models/Wallet");

const i18next = require("../../utilities/i18next");
const i18nextMiddleware = require("i18next-http-middleware");
const Plan = require("../../models/Plan");
const UserSubscription = require("../../models/UserSubscription");
router.use(i18nextMiddleware.handle(i18next));


const htmlPage =
  '<html><head><title>Main</title></head><body></body><script defer >res = %value%; window.opener.postMessage(res, "*");window.close();</script></html>';

const FAILURE_ROUTE = `${backend}/api/externalAuth/failed`;


const successResponse = (res, user) => {
  let responseHTML = htmlPage.replace(
    "%value%",
    JSON.stringify({ user: user.toAuthJSON() })
  );
  return res.status(200).send(responseHTML);
};

const errorResponse = (res, err) => {
  let responseHTML = htmlPage.replace("%value%", JSON.stringify({ err }));
  return res.status(400).send(responseHTML);
};

const validateEmailUser = async (req, res, next) => {
  const lang = req.session?.lastQuery?.lang || 'en';
  req.t = i18next.getFixedT(lang);
  const { lastQuery } = req.session;

  try {
    if (lastQuery.deviceType === "web") {
      if (!req.user.emails[0].value)
        return next(new BadRequestResponse(req.t("user.errors.emailNotFound")));

      let user = await User.findOne({ email: req.user.emails[0].value });

      if (user) {
        if (lastQuery.role !== user.role)
          return errorResponse(res, `No account is associated with this email`);

        if (req.user.provider === "google" && user.hash)
          return errorResponse(
            res,
            req.t("user.errors.userAlreadyRegisteredWithProfile")
          );

        if (user.status === "inactive")
          return errorResponse(res,  req.t("user.errors.userBlocked"));
        if (!user.isEmailVerified)
          return errorResponse(res, req.t("user.errors.userUnverified") );

        return successResponse(res, user);
      }
    } else {
      if (!req.user.emails[0].value) {
          return next(new BadRequestResponse(req.t("user.errors.emailNotFound")));
      }

      let user = await User.findOne({ email: req.user.emails[0].value });
      if (user) {
        if (user.hash)
          return errorResponse(
            res,
            req.t("user.errors.userAlreadyRegisteredWithProfile")
          );

        if (user.status === "inactive")
          return errorResponse(res, req.t("user.errors.userBlocked"));
        if (!user.isEmailVerified)
          return errorResponse(res, req.t("user.errors.userUnverified"));

        return successResponse(res, user);
      }
    }

    next();
  } catch (err) {
    errorResponse(res, err.message);
  }
};

const storeQuery = (req, res, next) => {
  req.session.lastQuery = req.query;
  next();
};

const validateErrors = (req, res, next) => {
  if (req.session.lastQuery.deviceType === "web") {
    if (req.query.error) return errorResponse(res, req.query.error_description);
    next();
  } else {
    if (req.query.error) return errorResponse(res, req.query.error_description);
    next();
  }
};



router.get(
  "/google",
  storeQuery,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

//app auth
router.get(
  "/google/callback",
  validateErrors,

  passport.authenticate("google", {
    session: false,
    failureRedirect: FAILURE_ROUTE,
  }),
  validateEmailUser,
  async function (req, res, next) {
    try {
      const { lastQuery } = req.session;

      let newUser = new User({
        email: req.user.emails[0].value,
        googleId: req.user.id,
        isEmailVerified: true,
        status: lastQuery.role === "patient" ? "active" : "pending",
        role: lastQuery.role,
        profileCompletionStatus: lastQuery.role === "patient" ? 1 : 2,
        timeZone: lastQuery.timezone,
      });

      newUser.fullName = req.user.displayName;

      if (req.user.photos && req.user.photos.length > 0) {
        newUser.profileImage = req.user.photos[0].value;
      }

      let wallet = new Wallet();
      await wallet.save();
      newUser.wallet = wallet._id;

      if (lastQuery.deviceType === "web") {
        newUser.save((err, user) => {
          if (err) return errorResponse(res, err.message);

          return successResponse(res, user);
        });
      } else {

        try {
          const result = await newUser.save();
        
          if (lastQuery.role === "patient") {
            const freePlan = await Plan.findOne({ type: "free" });
            if (!freePlan) {
              return errorResponse(res, "Free plan not found");
            }
        
            const newUserSubscription = new UserSubscription({
              userId: result._id,
              plan: freePlan._id,
              status: "active",
              aiConsultationsLeft: freePlan.limits.aiConsultations,
              medicalReportsLeft: freePlan.limits.medicalReports,
            });
            await newUserSubscription.save();
          }
        
          return successResponse(res, result);
        } catch (err) {
          return errorResponse(res, err.message);
        }



  
      }
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
);




router.get("/failed", (req, res, next) => {
  return errorResponse(res, ErrorMessages.generalMessage);
});

module.exports = router;
