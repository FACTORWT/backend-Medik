const router = require("express").Router();

// Rest of your routes...
router.use("/user", require("./user"));
router.use("/appointment", require("./appointment"));
router.use("/prescription", require("./prescription"));
router.use("/upload", require("./upload"));
router.use("/notification", require("./notification"));
router.use("/public", require("./public"));
router.use("/externalAuth", require("./externalAuth"));
router.use("/admin", require("./admin"));
router.use("/message", require("./message"));
router.use("/chat", require("./chat"));
router.use("/payment", require("./payment"));
router.use("/review", require("./review"));
router.use("/transcription", require("./transcription"));
router.use("/notification", require("./notification"));
router.use("/meeting", require("./meeting"));
router.use("/ai", require("./ai"));
router.use("/session", require("./session"));
router.use("/stripe", require("./stripe"));
router.use("/wallet", require("./wallet"));
router.use("/history", require("./history"));
router.use("/hospital", require("./hospital"));
router.use("/contact", require("./contact"));
router.use("/userSubscription", require("./userSubscription"));
  




module.exports = router;
