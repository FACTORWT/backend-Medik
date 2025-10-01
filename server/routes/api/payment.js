let mongoose = require("mongoose");
let router = require("express").Router();
const Payment = require("../../models/Payment");
const Appointment = mongoose.model("Appointment");
const moment = require('moment-timezone');

let auth = require("../auth");

let { OkResponse, BadRequestResponse } = require("express-http-response");
const {
  sendNotification,
  sendPushNotification,
} = require("../../utilities/notification");
const { scheduleEmails } = require("../../scheduleTasks/queue");
const { frontend } = require("../../config");
const { sendEmail } = require("../../utilities/nodemailer");

const { StripeSecretKey, PublishableKey } = require("../../config");
const stripe = require("stripe")(StripeSecretKey);

async function handleResponse(response) {
  if (response.status == "CREATED") {
    return response;
  }

  const errorMessage = await response.text();
  throw new Error(errorMessage);
}

router.get(
  "/doctor-payments/:id",
  auth.required,
  auth.doctor,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const query = {
        doctor: id,
        status: "completed",
        isCompletionVerified: true,
        isPaid: true,
      };

      const appointments = await Appointment.find(query);

      // Extract the appointment IDs
      const appointmentIds = appointments.map((appointment) => appointment._id);

      // Find payments corresponding to the appointment IDs
      const payments = await Payment.find({
        appointment: { $in: appointmentIds },
      });

      console.log("payments", payments);

      return next(new OkResponse(payments));
    } catch (error) {
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.get(
  "/find-transactions",
  auth.required,
  auth.doctor,
  async (req, res, next) => {
    try {
      const { wallet } = req.user;

      const query = {
        doctor: req.user._id,
        status: "completed",
        isCompletionVerified: true,
        isPaid: true,
      };

      const appointments = await Appointment.find(query);
      const appointmentIds = appointments.map((appointment) => appointment._id);

      // Find payments related to these appointment IDs
      const payments = await Payment.find({
        appointment: { $in: appointmentIds },
        status: "Completed",
      });

      // Retrieve Stripe balance for the doctor
      const stripeBalance = await stripe.balance.retrieve();
      const availableBalance =
        stripeBalance.available.find((bal) => bal.currency === "usd")?.amount ||
        0;

      // Convert Stripe balance to normal currency format (Stripe stores in cents)
      const stripeBalanceUSD = availableBalance / 100;

      return next(
        new OkResponse({
          payments: payments,
          canWithdraw: stripeBalanceUSD >= wallet.currentBalance,
        })
      );
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return next(new BadRequestResponse(error.message));
    }
  }
);

router.post("/onsite/:id", auth.required, auth.user, async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const { consultationFee, amount, discount } = req.body;
  

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return next(
        new BadRequestResponse(req.t("stripe.errors.appointmentNotFound"))
      );
    }

    appointment.isPaid = true;
    appointment.paymentMethod = "cash";

    await appointment.save();
    // Create payment record
    const payment = new Payment({
      paymentId: new mongoose.Types.ObjectId().toString(),
      payer: req.user._id,
      payee: appointment.doctor._id,
      appointment: appointmentId,
      status: "Completed",
      paymentMethod: "cash",
      consultationFee,
      discount,
      amount,
      withDraw: false,
    });
    await payment.save();

    // Prepare user notification data
    const meetingTime = moment.tz(appointment.slotTime, "UTC"); // This is the original slot time in UTC
    const patientMeetingTime = meetingTime
      .clone()
      .tz(appointment.patient.timeZone);
    const doctorMeetingTime = meetingTime
      .clone()
      .tz(appointment.doctor.timeZone);


    const user = {
      patientEmail: appointment.patient.email,
      doctorEmail: appointment.doctor.email,
      patientName: appointment.patient.fullName,
      doctorName: appointment.doctor.fullName,

      daySlot: appointment.daySlot,
      day: appointment.day,
      date: appointment.date,
      slotTime: appointment.slotTime,
      duration: appointment.duration,
      patientPhone: appointment.patient.phone,
      doctorPhone: appointment.doctor.phone,
      patientMeetingTime: patientMeetingTime.format("ddd, MMM D, YYYY, h:mm A"),
      doctorMeetingTime: doctorMeetingTime.format("ddd, MMM D, YYYY, h:mm A"),
    };

    // console.log("appointment from onsite *********", appointment);

    scheduleEmails({
      ...user,
      patientTimeZone: appointment.patient.timeZone,
      doctorTimeZone: appointment.doctor.timeZone,
    });

    // console.log("user object coming", user);

    if (!user.patientEmail || !user.doctorEmail) {
      console.error("Missing email addresses:", {
        patientEmail: user.patientEmail,
        doctorEmail: user.doctorEmail,
      });
      throw new Error("Missing email addresses for patient or doctor");
    }

    sendEmail(user, "onsite", { onsite: true });

    await sendNotification(
      "Appointment Created",
      `Hello ${appointment.patientName}, your onsite appointment with Dr.${appointment.doctorName} is confirmed`,
      `Hola ${appointment.patientName}, tu cita presencial con el Dr.${appointment.doctorName} está confirmada`,
      appointment.patient._id,
      appointment.doctor._id,
      appointment._id,
      { appointmentId: appointment._id }
    );

    await sendPushNotification(
      "Onsite Appointment Confirmed",
      `Your onsite appointment with Dr.${appointment.doctorName} is booked.`,
      appointment.patient._id
    );

    await sendNotification(
      "Appointment Created",
      `Hello ${appointment.doctorName}, you have an onsite appointment with ${appointment.patientName}`,
      `Hola Dr.${appointment.doctorName}, tiene una cita presencial con ${appointment.patientName}`,
      appointment.doctor._id,
      appointment.patient._id,
      appointment._id,
      { appointmentId: appointment._id }
    );

    await sendPushNotification(
      "Onsite Appointment Confirmed",
      `You have an onsite appointment with ${appointment.patientName}`,
      appointment.doctor._id
    );

    return next(new OkResponse("Appointment created successfully"));
  } catch (err) {
    console.error("Error updating payment intent:", err);
    return next(new BadRequestResponse(req.t("stripe.errors.paymentFailed")));
  }
});

router.get("/find/:id", auth.required, auth.user, async (req, res, next) => {
  try {
    const id = req.params.id;

    const payment = await Payment.findOne({ paymentId: id });

    return next(new OkResponse(payment));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

router.get(
  "/appointment/:id",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      const id = req.params.id;

      const payment = await Payment.findOne({ appointment: id });

      return next(new OkResponse(payment));
    } catch (error) {
      return next(new BadRequestResponse(error));
    }
  }
);

router.get(
  "/in-progress",
  auth.required,
  auth.doctor,
  async (req, res, next) => {
    try {
      const appointment = await Appointment.find({
        doctor: req.user._id,
        isCompletionVerified: false,
        status: { $eq: "completed" },
        isPaid: true,
      });

      const pendingApprovalCounts = appointment.length;

      return next(new OkResponse(pendingApprovalCounts));
    } catch (error) {
      console.log("error", error);
      return next(
        new BadRequestResponse(req.t("appointment.errors.unexpectedError"))
      );
    }
  }
);

module.exports = router;
