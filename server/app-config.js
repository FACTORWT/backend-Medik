const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport");
const errorhandler = require("errorhandler");
const mongoose = require("mongoose");
const secret = require("./config").secret;
const createLocaleMiddleware = require("express-locale");
const compression = require("compression");
const httpResponse = require("express-http-response");
let isProduction = process.env.NODE_ENV === "production";
const i18next = require("./utilities/i18next");

const History = require("./models/History");

const { allowedOrigins, MONGODB_URI, frontend } = require("./config");
const { reminderQueue } = require("./scheduleTasks");

module.exports = (app) => {
  app.use(
    cors({
      credentials: true,
      origin: function (origin, callback) {
        // allow requests with no origin
        console.log('Origin', origin, allowedOrigins.indexOf(origin))
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
          var msg =
            "The CORS policy for this site does not " +
            "allow access from the specified Origin.";
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
    })
  );

  // Add CORS headers for static files
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(compression());
  app.use(require("i18next-http-middleware").handle(i18next));
  // Normal express config defaults
  app.use(require("morgan")("dev"));
  app.use(bodyParser.urlencoded({ extended: false, limit: "500mb" }));
  // app.use(bodyParser.json({ limit: "500mb" }));
  app.use(
    bodyParser.json({
      // Because Stripe needs the raw body, we compute it but only when hitting the Stripe callback URL.
      verify: function (req, res, buf) {
        var url = req.originalUrl;
        console.log("URL", url);
        if (url.endsWith("/webhook")) {
          req.rawBody = buf.toString();
        }
      },
    })
  );
  // Get the user's locale, and set a default in case there's none
  app.use(
    createLocaleMiddleware({
      priority: ["accept-language", "default"],
      default: "en_US", // ko_KR
    })
  );

  // Debugging information (optional, for development purposes)
  // (async () => {
  //   try {
  //     console.log("Completed Jobs:", await reminderQueue.getCompleted());
  //     (await reminderQueue.getJobs()).forEach((job) => console.log("Job Data:", job.data, "Job ID:", job.id));
  //     console.log("Delayed Jobs:", await reminderQueue.getDelayed());
  //     console.log("Waiting Jobs Count:", await reminderQueue.getWaitingCount());
  //     const nextJob = await reminderQueue.getNextJob();
  //     console.log("Next Job in Queue:", nextJob?.data, "Job ID:", nextJob?.id);
  //   } catch (error) {
  //     console.error("Error fetching job details:", error);
  //   }
  // })();

  app.use(require("method-override")());
  app.use(express.static(path.join(__dirname, "/public")));

  app.use(
    session({
      secret: secret,
      cookie: { maxAge: 60000 },
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(errorhandler());

  mongodb: mongoose
    .connect(`${MONGODB_URI}?retryWrites=false`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    })
    .catch((err) => {
      console.log(err);
    })
    .then(() => {
      console.log(
        `connected to db in ${isProduction ? "Prod" : "Dev"} environment`
      );
    });
  mongoose.set("debug", true);
  require("./scheduleTasks/worker");

  require("./models/User");
  require("./models/Appointment");
  require("./models/Prescription");
  require("./models/ChatGroup");
  require("./models/Message");
  require("./models/DoctorCategories");
  require("./models/Notification");
  require("./models/Hospital");
  require("./models/Review");
  require("./models/Blogs");
  require("./models/Chat");
  require("./models/Meeting");
  require("./models/Session");
  require("./models/Wallet");
  require("./models/History");
  require("./models/Contact");
  require("./models/Plan");
  require("./models/UserSubscription");

  require("./utilities/passport");

  app.use(passport.initialize());

  // Update the static file serving configuration
  app.use('/uploads', express.static(path.join(process.cwd(), 'server/public/uploads'), {
    setHeaders: (res, path, stat) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
  }));

  app.use(require("./routes"));

  app.get("/preview/:id/:time", async (req, res) => {
    const fileName = req.params.id;

    console.log("file name", fileName);
    const expiryTime = Number(req.params.time);
    const timeNow = Date.now();

    if (timeNow > expiryTime) {
      return res.redirect(`${frontend}/?expired=1`);
    }

    try {
      // Find the radiology image in the database
      const history = await History.findOne({
        "radiology.images": { $regex: fileName, $options: 'i' }
      });

      if (!history) {
        return res.status(404).send("File not found");
      }

      // Find the radiology entry containing the image
      const radiologyEntry = history.radiology.find(r => 
        r.images.some(img => img.includes(fileName))
      );

      if (!radiologyEntry) {
        return res.status(404).send("Radiology entry not found");
      }

      // Find the full image URL
      const imageUrl = radiologyEntry.images.find(img => 
        img.includes(fileName)
      );

      if (!imageUrl) {
        return res.status(404).send("Image URL not found");
      }

	  console.log("image url" , imageUrl)

      // Redirect to your frontend DICOM viewer with the full image URL
    //   return res.redirect(
    //     `http://localhost:3200/blogs`
    //   );

	  return res.redirect(
        `${frontend}/dicom-viewer?file=${encodeURIComponent(fileName)}`
      );
    } catch (error) {
      console.error("Error in preview route:", error);
      return res.status(500).send("Internal server error");
    }
  });

  app.use(function (req, res, next) {
    let err = new Error("Not Found");
    err.status = 404;
    next(err);
  });
  app.use(httpResponse.Middleware);

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);

    res.json({
      errors: {
        message: err.message,
        error: err,
      },
    });
  });

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      errors: {
        message: err.message,
        error: {},
      },
    });
  });
};
