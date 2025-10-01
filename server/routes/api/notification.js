let Notification = require("../../models/Notification");
let router = require("express").Router();
let {
  OkResponse,
  BadRequestResponse,
  UnauthorizedResponse,
} = require("express-http-response");
let auth = require("../auth");

const { sendNotification } = require("../../utilities/notification");

router.param("notificationId", (req, res, next, _id) => {
  Notification.findOne({ _id }, (err, notification) => {
    if (err) return next(err);
    if (!notification)
      return next(new BadRequestResponse("Notification not found"));
    req.notification = notification;
    next();
  });
});

router.get("/create/:userId", function (req, res, next) {
  sendNotification({
    title: "Notification testing",
    type: "system",
    sentTo: req.params.userId,
  });
  return next(new OkResponse({ message: "notification sent" }));
});

router.get("/", auth.required, auth.user, function (req, res, next) {
  const options = {
    page: +req.query.page || 1,
    limit: +req.query.page || 50,
    sort: { createdAt: -1 },
  };

  let query = {};
  Notification.paginate(
    { sentTo: req.user._id },
    options,
    function (err, result) {
      if (err) return next(new BadRequestResponse("Server Error"));
      return next(new OkResponse(result));
    }
  );
});

router.get("/mark-all", auth.required, auth.user, function (req, res, next) {
  Notification.updateMany(
    { sentTo: req.user._id, isRead: false },
    { $set: { isRead: true } },
    function (err, result) {
      if (err) return next(new BadRequestResponse("Server Error"));
      return next(new OkResponse());
    }
  );
});
router.get(
  "/mark-as-read/:notificationId",
  auth.required,
  auth.user,
  function (req, res, next) {
    req.notification.isRead = true;
    req.notification.save(function (err, result) {
      if (err){
      console.log("Error while marking notification as read", err);
        return next(new BadRequestResponse(err.message));
      } 
        
      return next(new OkResponse());
    });
  }
);

router.get(
  "/mark-as-unread/:notificationId",
  auth.required,
  auth.user,
  function (req, res, next) {
    req.notification.isRead = false;
    req.notification.save(function (err, result) {
      if (err) return next(new BadRequestResponse(err));
      return next(new OkResponse());
    });
  }
);

router.delete(
  "/delete/:notificationId",
  auth.required,
  auth.user,
  (req, res, next) => {
    if (req.notification.sentTo.email === req.user.email) {
      req.notification.remove((err, notification) => {
        if (err) return next(new BadRequestResponse("Server Error"));
        return next(new OkResponse("Deleted"));
      });
    } else return next(new UnauthorizedResponse("Unauthorized"));
  }
);

router.delete("/deleteAll", auth.required, auth.user, (req, res, next) => {
  let query = {
    sentTo: req.user._id,
  };
  Notification.find(query, (err, notifications) => {
    if (err) return next(new BadRequestResponse(err));
    // remove all items
    notifications.forEach(async (notification) => {
      try {
        await notification.remove();
      } catch (errors) {
        return next(new BadRequestResponse(errors));
      }
    });
    return next(new OkResponse("Deleted"));
  });
});
module.exports = router;
