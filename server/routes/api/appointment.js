let mongoose = require("mongoose");
let router = require("express").Router();
let User = mongoose.model("User");
let moment = require("moment");
let Appointment = mongoose.model("Appointment");
let auth = require("../auth");
const Meeting = mongoose.model("Meeting");

let {
  OkResponse,
  BadRequestResponse,
  NotFoundResponse,
} = require("express-http-response");
const { emitEvent } = require("../../utilities/realTime");

const Wallet = require("../../models/Wallet");
const { sendNotification } = require("../../utilities/notification");
const {
  notifyCancellation,
  calculatePatientRefund,
  notifyAbsentToDoctor,
  notifyAbsentToPatient,
} = require("../../utilities/bookingHelpers");
const Payment = require("../../models/Payment");
const { StripeSecretKey } = require("../../config");
const { formatDateToTimeZone } = require("../../utilities/dateAndTimeFormator");
const stripe = require("stripe")(StripeSecretKey);

router.param("_id", (req, res, next, _id) => {
  Appointment.findOne({ _id }, (err, appointment) => {
    if (err)
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    if (!appointment)
      return next(
        new BadRequestResponse(
          req.t("appointment.errors.appointmentNotFound"),
          423
        )
      );
    req.appointment = appointment;
    next();
  });
});

//single appointment detail for app
router.get(
  "/appointment-detail/:_id",
  auth.required,
  auth.user,
  (req, res, next) => {
    const appointmentDetail = req.appointment;
    return next(new OkResponse(appointmentDetail));
  }
);

//get registered appointments
router.get("/appointments", auth.required, auth.user, (req, res, next) => {
  let query = { isPaid: true };
  if (req.user.role === "doctor") query.doctor = req.user._id;
  else if (req.user.role === "patient") query.patient = req.user._id;

  const options = {
    sort: { createdAt: -1 },
  };

  Appointment.find(query, null, options, (err, appointments) => {
    if (err) {
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }

    return next(new OkResponse(appointments));
  });
});

router.get(
  "/booked-appointments/:appointmentIdOnly/:date",
  auth.required,
  auth.user,
  (req, res, next) => {
    const options = {
      sort: { createdAt: -1 },
    };

    const date = req.params.date;
    const appointmentId = req.params.appointmentIdOnly;

    const startOfDay = new Date(date).setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setUTCHours(23, 59, 59, 999);

    let query = {
      doctor: appointmentId,
      slotTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      isPaid: true,
    };

    Appointment.find(query, null, options, (err, appointments) => {
      if (err)
        return next(
          new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
        );

      return next(new OkResponse(appointments));
    });
  }
);

router.get(
  "/filter-appointments",
  auth.required,
  auth.doctor,
  async (req, res, next) => {
    const {
      patientName,
      startDate,
      endDate,
      isPrescribed,
      patientId,
      date,
      searchPatient,
      selectedTab,
      thisWeekStartDate,
      thisWeekEndDate,
      isAppointmentCompleted,
    } = req.query.params;

    const filter = {
      isPaid: true,
      patient: patientId,
    };

    if (date) {
      filter.slotTime = {
        $gte: new Date(date).setUTCHours(0, 0, 0, 0),
        $lte: new Date(date).setUTCHours(23, 59, 59, 999),
      };
    }
    if (startDate && endDate) {
      filter.slotTime = {
        $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
        $lte: new Date(endDate).setUTCHours(23, 59, 59, 999),
      };
    } else if (startDate) {
      filter.slotTime = {
        $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      };
    }

    if (thisWeekStartDate && thisWeekEndDate) {
      filter.slotTime = {
        $gte: new Date(thisWeekStartDate).setUTCHours(0, 0, 0, 0),
        $lte: new Date(thisWeekEndDate).setUTCHours(23, 59, 59, 999),
      };
    }

    if (patientName) {
      filter.patientName = patientName;
    }

    if (searchPatient) {
      filter.patientName = { $regex: new RegExp(searchPatient, "i") };
    }

    if (isAppointmentCompleted) {
      filter.status = "completed";
    }

    if (isPrescribed === "false") filter.isPrescribed = false;
    if (isPrescribed === "true") filter.isPrescribed = true;

    if (selectedTab === "my") {
      filter.doctor = req.user._id;
    }

    if (selectedTab === "all") {
      filter.doctor = { $ne: req.user._id }; // Exclude current user
    }
    const options = {
      sort: { createdAt: -1 },
    };

    Appointment.find(filter, null, options, (err, appointments) => {
      if (err)
        return next(
          new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
        );

      return next(new OkResponse(appointments));
    });
  }
);

//Get appoitments And Also Filter out the appoitments of the doctors for patient side
router.get(
  "/filter-patient-appointments",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    const {
      startDate,
      endDate,
      isPrescribed,
      date,
      doctorId,
      searchDoctor,
      thisWeekStartDate,
      thisWeekEndDate,
      isAppointmentCompleted,
    } = req.query.params;

    const filter = {
      isPaid: true,
      patient: req.user.id,
      doctor: doctorId,
    };

    if (searchDoctor) {
      filter.doctorName = { $regex: new RegExp(searchDoctor, "i") };
    }

    if (isAppointmentCompleted) {
      filter.status = "completed";
    }

    if (date) {
      filter.slotTime = {
        $gte: new Date(date).setUTCHours(0, 0, 0, 0),
        $lte: new Date(date).setUTCHours(23, 59, 59, 999),
      };
    }
    if (startDate && endDate) {
      filter.slotTime = {
        $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
        $lte: new Date(endDate).setUTCHours(23, 59, 59, 999),
      };
    } else if (startDate) {
      filter.slotTime = {
        $gte: new Date(startDate).setUTCHours(0, 0, 0, 0),
      };
    }

    if (thisWeekStartDate && thisWeekEndDate) {
      filter.slotTime = {
        $gte: new Date(thisWeekStartDate).setUTCHours(0, 0, 0, 0),
        $lte: new Date(thisWeekEndDate).setUTCHours(23, 59, 59, 999),
      };
    }

    if (isPrescribed === "false") filter.isPrescribed = false;
    if (isPrescribed === "true") filter.isPrescribed = true;

    const options = {
      sort: { createdAt: -1 },
    };

    Appointment.find(filter, null, options, (err, appointments) => {
      if (err)
        return next(
          new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
        );

      return next(new OkResponse(appointments));
    });
  }
);

router.get(
  "/booked-appointments/:appointmentIdOnly",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      let query = {
        doctor: req.params.appointmentIdOnly,
        slotTime: req.query.date,
        isPaid: true,
      };

      const appointments = await Appointment.find(query);

      return next(new OkResponse(appointments));
    } catch (error) {
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

//for app
router.get(
  "/get-appointments/:date",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      const date = moment.utc(req.params.date, "YYYY-MM-DD");

      if (!date.isValid()) {
        return next(
          new BadRequestResponse(
            req.t("appointment.errors.missingRequiredParameter")
          )
        );
      }

      const startOfDay = date.startOf("day").toDate();
      const endOfDay = date.endOf("day").toDate();

      let query = {
        slotTime: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        isPaid: true,
      };

      if (req.user.role === "doctor") query.doctor = req.user._id;
      if (req.user.role === "patient") query.patient = req.user._id;

      const appointments = await Appointment.find(query);

      return next(new OkResponse(appointments));
    } catch (error) {
      console.error("Unexpected error:", error);
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

router.post("/create", auth.required, auth.patient, async (req, res, next) => {
  try {
    if (!req.body)
      return next(
        new BadRequestResponse(
          req.t("appointment.errors.missingRequiredParameter"),
          422
        )
      );
      console.log("req.body from *******",req.body)
    const findBookedSlot = await Appointment.findOne({
      slotTime: req.body.slotTime,
      isPaid: true,
      doctor: req.body.doctor,
      status: { $ne: "cancelled" }, // Allow reusing cancelled slots
    });

    if (findBookedSlot) {
      return next(
        new BadRequestResponse(req.t("appointment.errors.slotNotAvailable"))
      );
    }

    const findDoctor = await User.findOne({ _id: req.body.doctor });
    if (!findDoctor) {
      return next(
        new BadRequestResponse(req.t("appointment.errors.doctorNotFound"))
      );
    }
    if (findDoctor.status == "inactive") {
      return next(
        new BadRequestResponse(req.t("appointment.errors.doctorInactive"))
      );
    }

    // const requestedSlot = findDoctor.slots.find(
    // 	(item) => item.time === req.body.slotTime && item.dates.includes(req.body.day)
    // );

    // if (!requestedSlot) {
    // 	return next(new BadRequestResponse("Doctor has been deleted this slot"));
    // }

    let appointment = new Appointment();
    appointment.patient = req.user._id;
    appointment.doctor = req.body.doctor;
    appointment.slotTime = req.body.slotTime;
    appointment.patientTimeZone = req.body.patientTimeZone;
    appointment.doctorName = req.body.doctorName;
    appointment.daySlot = req.body.daySlot;
    appointment.day = req.body.day;
    appointment.duration = req.body.duration;
    appointment.fee = req.body.fee;

    await appointment.save();
    return next(new OkResponse(appointment.toAuthJSON()));
  } catch (error) {
    return next(
      new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
    );
  }
});

router.put(
  "/update/:_id",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      if (!!!req.body)
        return next(
          new BadRequestResponse(
            req.t("appointment.errors.missingRequiredParameter"),
            422
          )
        );

      req.appointment.patientName =
        req.body.patientName || req.appointment.patientName;
      req.appointment.age = req.body.age || req.appointment.age;
      req.appointment.details = req.body.details || req.appointment.details;
      req.appointment.gender =  req?.user?.gender || req.body.gender;
      req.appointment.paymentMethod = req.body.paymentMethod ||  req.appointment.paymentMethod;




      if (req.body.type !== "self") {
        req.appointment.isForMySelf = false;
        req.appointment.gender = req.body.gender;
        req.appointment.relation = req.body.relation;
        req.appointment.phone = req.body.phone;
      req.appointment.paymentMethod = req.body.paymentMethod ||  req.appointment.paymentMethod;

      }

      const updatedAppointment = await req.appointment.save();

      return next(new OkResponse(updatedAppointment.toAuthJSON()));
    } catch (error) {
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

router.put(
  "/completion/:_id",
  auth.required,
  auth.doctor,
  async (req, res, next) => {
    try {
  

      req.appointment.status = "completed";

      const savedAppointment = await req.appointment.save();

      emitEvent(`appointment-completed-${savedAppointment._id}`);

      return next(new OkResponse(savedAppointment.toAuthJSON()));
    } catch (error) {
      console.log("error", error);
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

router.put(
  "/verify-completion/:_id",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      if (req.appointment.status !== "completed") {
        return next(
          new BadRequestResponse(
            req.t("appointment.errors.cannotCompleteBeforeDoctor"),
            423
          )
        );
      }

      req.appointment.isCompletionVerified = true;
      const savedAppointment = await req.appointment.save();

      const doctorWalletId = savedAppointment.doctor.wallet;

      const doctorWallet = await Wallet.findById(doctorWalletId);
      if (!doctorWallet) {
        return next(
          new NotFoundResponse(req.t("appointment.errors.walletNotFound"))
        );
      }

      if (req.appointment.paymentMethod === "card") {
        const platformFee = req.appointment.fee * 0.1; // 10% platform fee
        const doctorEarnings = req.appointment.fee - platformFee; // Doctor gets 90%
    
        doctorWallet.currentBalance += doctorEarnings; // Doctor receives 90%
    }
    
      
      if (req.appointment.paymentMethod === "cash") {
        const platformFee = req.appointment.fee * 0.1; // 10% platform fee
        doctorWallet.totalEarnings += req.appointment.fee;  // Doctor receives 90%
        doctorWallet.payableAmount += platformFee;  // Platform collects 10%
      }
      
      
      await doctorWallet.save();

      emitEvent(`appointment-verified-${savedAppointment._id}`);

      return next(new OkResponse(savedAppointment.toAuthJSON()));
    } catch (error) {
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

router.put(
  "/user/absent/:_id",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      req.appointment.isUserAbsent = true;
      req.appointment.status = "completed";
      req.appointment.isCompletionVerified = true;

      req.appointment.absentBy = userId;
      await req.appointment.save();

      emitEvent(`user-absent-${req.appointment._id}`, {
        absentDetails: req.appointment,
      });

      if (userId.toString() === req.appointment.doctor._id.toString()) {
        console.log("Doctor marked absent");
        await notifyAbsentToPatient(req.appointment);
      }
      if (userId.toString() === req.appointment.patient._id.toString()) {
        await notifyAbsentToDoctor(req.appointment);
      }

      return next(
        new OkResponse(req.t("appointment.messages.appointmentAbsent"))
      );
    } catch (error) {
      console.error("Error marking user as absent:", error);
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

router.put("/cancel/:_id", auth.required, auth.user, async (req, res, next) => {
  try {
    const { user, appointment } = req;
    const cancellationPolicyIdentifier = req.body.cancellationPolicy;
    const cancelReason = req.body.reason;

    if (appointment.status === "completed") {
      return next(
        new BadRequestResponse(
          req.t("appointment.errors.cannotCancelCompletedAppointment")
        )
      );
    }

    if (cancellationPolicyIdentifier === "") {
      return next(
        new BadRequestResponse(
          req.t("appointment.errors.cancellationNotAllowed")
        )
      );
    }

    
    

    const refundResult = await handleRefund(
      appointment,
      user,
      cancellationPolicyIdentifier,
      cancelReason
    );

    if (refundResult.status === "ok") {
      emitEvent(`appointment-cancelled-${appointment._id}`, refundResult.data);
      return next(new OkResponse(refundResult.message));
    } else {
      return next(new BadRequestResponse(refundResult.message));
    }
  } catch (error) {
    console.error("Error in API:", error);
    return next(
      new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
    );
  }
});

async function handleRefund(
  appointment,
  user,
  cancellationPolicy,
  cancelReason
) {
  const transaction = await Payment.findOne({
    appointment: appointment._id,
    type: "new",
  });

  if (!transaction) {
    return {
      message: "Transaction not found against this booking",
      status: "cancelled",
    };
  }

  const serviceFee = 0;
  const totalPrice = parseInt(transaction.amount) + serviceFee;

  let refundAmount = 0;
  console.log("sd", user._id.toString() === appointment.doctor._id.toString())

  
  // If the doctor initiated the cancellation
  if (user._id.toString() === appointment.doctor._id.toString() && appointment.paymentMethod === "card" ) {
    refundAmount = totalPrice;

  }

  // If the patient initiated the cancellation
  if (user._id.toString() === appointment.patient._id.toString()  && appointment.paymentMethod === "card") {
    refundAmount = calculatePatientRefund(totalPrice, cancellationPolicy);
  }

// no transfer i want to do just basic database values change for onsite appointment cancellation for patient cancellation  
  if (user._id.toString() === appointment.patient._id.toString()   && appointment.paymentMethod === "cash") {
    appointment.status = "cancelled";
    appointment.cancelledBy = user._id;
    appointment.cancelReason = cancelReason;
    await appointment.save();
    await notifyCancellation(appointment);
    return {
      message: "Appointment cancelled",
      status: "ok",
      data: appointment,
    };
  }

// no transfer i want to do just basic database values change for onsite appointment cancellation for doctor cancellation  

  if (user._id.toString() === appointment.doctor._id.toString()   && appointment.paymentMethod === "cash") {
    appointment.status = "cancelled";
    appointment.cancelledBy = user._id;
    appointment.cancelReason = cancelReason;
    await appointment.save();
    await notifyCancellation(appointment);
    return {
      message: "Appointment cancelled",
      status: "ok",
      data: appointment,
    };
  }
  try {
    // 
    const charge = await stripe.charges.retrieve(transaction.chargeId);

    if (charge.refunded) {
      return {
        message: "This appointment has been cancelled",
        status: "cancelled",
      };
    }

    await stripe.refunds.create({
      charge: transaction.chargeId,
      amount: refundAmount * 100,
    });

    // const refundMessage = `Hello ${appointment.patient.fullName}, a refund amount of $${refundAmount} has been processed.`;
    // await sendNotification("refund-processed", refundMessage, "system", appointment.patient._id);

    await sendNotification(
      "refund-processed",
      `Hello ${appointment.patient.fullName}, a refund amount of $${refundAmount} has been processed`,
      `Hola ${appointment.patient.fullName}, se ha procesado un reembolso de $${refundAmount}.`,
      appointment.patient._id
    );

    appointment.status = "cancelled";
    appointment.cancelledBy = user._id;
    appointment.cancelReason = cancelReason;
    await appointment.save();

    await notifyCancellation(appointment);

    return {
      message: "Refund processed successfully.",
      status: "ok",
      data: appointment,
    };
  } catch (error) {
    console.error("Error processing refund:", error);

    return {
      message:
        error.message || "An error occurred while processing the refund.",
      status: "cancelled",
    };
  }
}

router.put(
  "/rescheduling/:_id",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      const { duration, patientTimeZone, fee, daySlot, doctor, slotTime, day } =
        req.body;

      if (
        !duration ||
        !patientTimeZone ||
        !fee ||
        !daySlot ||
        !doctor ||
        !slotTime
      ) {
        return next(new BadRequestResponse("Required missing parameter"));
      }

      const previousSlotTime = req.appointment.slotTime;
      const doctorTimeZone = req.appointment.doctor.timeZone;

      req.appointment.slotTime = slotTime;
      req.appointment.duration = duration;
      req.appointment.daySlot = daySlot;
      req.appointment.day = day;
      req.appointment.patientTimeZone = patientTimeZone;
      req.appointment.fee = fee;
      req.appointment.isRescheduling = true;

      const previousMeeting = await Meeting.findOne({
        appointment: req.appointment?._id,
      });
      previousMeeting.day = day;
      previousMeeting.duration = duration;
      previousMeeting.slotTime = slotTime;
      previousMeeting.daySlot = daySlot;

      const doctorFormattedStartTime = formatDateToTimeZone(
        slotTime,
        "h:mm A",
        doctorTimeZone
      );

      const patientFormattedStartTime = formatDateToTimeZone(
        slotTime,
        "h:mm A",
        patientTimeZone
      );

      const previousFormatStartTime = formatDateToTimeZone(
        previousSlotTime,
        "h:mm A",
        doctorTimeZone
      );

      const dateLongFormat = "MMMM D YYYY";
      const doctorFormattedDate = formatDateToTimeZone(
        slotTime,
        dateLongFormat,
        doctorTimeZone
      );

      const patientFormattedDate = formatDateToTimeZone(
        slotTime,
        dateLongFormat,
        doctorTimeZone
      );

      const previousFormatDate = formatDateToTimeZone(
        previousSlotTime,
        dateLongFormat,
        doctorTimeZone
      );

      await sendNotification(
        "booking-reschedule",
        `Hello ${req.appointment.doctor.fullName}, your session has been rescheduled from ${previousFormatStartTime} ${previousFormatDate}, to ${doctorFormattedStartTime} ${doctorFormattedDate}`,
        `Hola ${req.appointment.doctor.fullName}, tu sesión ha sido reprogramada de ${previousFormatStartTime} ${previousFormatDate} a ${doctorFormattedStartTime} ${doctorFormattedDate}`,
        req.appointment.doctor._id
      );
      
      await sendNotification(
        "booking-reschedule",
        `Hello ${req.appointment.patient.fullName}, your session has been rescheduled from ${previousFormatStartTime} ${previousFormatDate}, to ${patientFormattedStartTime} ${patientFormattedDate}`,
        `Hola ${req.appointment.patient.fullName}, tu sesión ha sido reprogramada de ${previousFormatStartTime} ${previousFormatDate} a ${patientFormattedStartTime} ${patientFormattedDate}`,
        req.appointment.patient._id
      );
      

      await req.appointment.save();
      await previousMeeting.save();

      return next(new OkResponse(req.appointment));
    } catch (error) {
      console.log("Error", error);
      return next(new BadRequestResponse(error));
    }
  }
);






module.exports = router;
