let router = require("express").Router();
let { OkResponse, BadRequestResponse } = require("express-http-response");
let mongoose = require("mongoose");
const auth = require("../auth");
const { frontend } = require("../../config");
const { sendEmail } = require("../../utilities/nodemailer");
const {
  sendNotification,
  sendPushNotification,
} = require("../../utilities/notification");
const Payment = mongoose.model("Payment");
const Appointment = mongoose.model("Appointment");
const Meeting = mongoose.model("Meeting");
const { StripeSecretKey, PublishableKey } = require("../../config");
const stripe = require("stripe")(StripeSecretKey);
const { formatDateToTimeZone } = require("../../utilities/dateAndTimeFormator");
const { scheduleEmails } = require("../../scheduleTasks/queue");
const moment = require("moment-timezone");

// console.log("StripeSecretKey", StripeSecretKey);
// const stripe = new Stripe(StripeSecretKey, {
//   apiVersion: "2023-10-16",
//   appInfo: {
//     // For sample support and debugging, not required for production:
//     name: "AI Medik",
//     version: "0.0.1",
//     url: "https://ai-medik.com/",
//   },
// });

// console.log("Stripe Connection ", stripe);
router.post("/create-payment-intent", auth.required, async (req, res, next) => {
  try {
    const { amount, payee, payer, appointmentId, consultationFee, discount } = req.body;
    const amountInCents = Math.round(amount * 100);


    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      payment_method_types: ["card"],
      setup_future_usage: "off_session",
      transfer_group: "AI-Medik",
    });

    const payment = new Payment({
      paymentId: paymentIntent.id,
      appointment: appointmentId,
      amount: amount,
      discount,
      consultationFee,
      payee: payee,
      payer: payer,
      consultationFee,
      withdraw: false,
    });
    await payment.save();

    return next(
      new OkResponse({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: payment.amount,
        appointmentId: payment.appointmentId,
      })
    );
  } catch (error) {
    console.error(`Error creating payment: ${error.message}`);
    return next(
      new BadRequestResponse(req.t("stripe.errors.paymentCreationFailed"))
    );
  }
});

router.post(
  "/reschedule/create-rescheduling-intent",
  async (req, res, next) => {
    try {
      const { amount, payee, payer, appointmentId } = req.body;
      const amountInCents = Math.round(amount * 100);
      const platformFeePercentage = 0.1; // 10% platform fee

      // Calculate the consultation fee (doctor's fee)
      const consultationFee = amount / (1 + platformFeePercentage);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
        setup_future_usage: "off_session",
        transfer_group: "AI-Medik",
      });

      const transaction = new Payment({
        paymentId: paymentIntent.id,
        appointment: appointmentId,
        consultationFee: consultationFee,
        amount: amount,
        payee: payee,
        payer: payer,
        withDraw: false,
        type: "reschedule",
      });

      await transaction.save();

      return next(
        new OkResponse({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        })
      );
    } catch (error) {
      console.error(`Error creating payment: ${error.message}`);
      return next(
        new BadRequestResponse(
          req.t("stripe.errors.paymentIntentCreationFailed")
        )
      );
    }
  }
);

router.get(
  "/v1/payment_intents/:id",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      const id = req.params.id;

      console.log("Id received", id);

      const paymentIntent = await stripe.paymentIntents.retrieve(id);
      console.log("paymentIntent", paymentIntent);

      if (paymentIntent.status !== "succeeded") {
        return next(
          new BadRequestResponse(
            req.t("stripe.errors.paymentIntentNotSucceeded")
          )
        );
      }

      const payment = await Payment.findOne({ paymentId: id });
      if (!payment) {
        return next(
          new BadRequestResponse(req.t("stripe.errors.paymentNotFound"))
        );
      }

      if (payment.status === "Completed") {
        return next(new OkResponse(paymentIntent));
      }

      payment.chargeId = paymentIntent.latest_charge;
      payment.status = "Completed";
      await payment.save();

      const appointmentId = payment.appointment._id;

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return next(
          new BadRequestResponse(req.t("stripe.errors.appointmentNotFound"))
        );
      }

      appointment.isPaid = true;
      await appointment.save();
      const meeting = new Meeting({
        appointment: appointmentId,
        patient: req.user._id,
        doctor: appointment.doctor._id,
        daySlot: appointment.daySlot,
        day: appointment.day,
        date: appointment.date,
        slotTime: appointment.slotTime,
        duration: appointment.duration,
      });

      await meeting.save();
      const meetingTime = moment.tz(appointment.slotTime, "UTC"); // This is the original slot time in UTC
      const patientMeetingTime = meetingTime
        .clone()
        .tz(appointment.patient.timeZone);
      const doctorMeetingTime = meetingTime
        .clone()
        .tz(appointment.doctor.timeZone);

      const link = `${frontend}/?roomId=${meeting?.roomId}`;
      const user = {
        patientEmail: req.user.email,
        doctorEmail: appointment.doctor.email,
        patientName: req.user.fullName,
        doctorName: appointment.doctor.fullName,
        roomId: meeting.roomId,
        daySlot: appointment.daySlot,
        day: appointment.day,
        date: appointment.date,
        slotTime: appointment.slotTime,
        duration: appointment.duration,
        meetingLink: link,
        doctorPhone: appointment.doctor.phone,
        patientPhone: appointment.patient.phone,
        patientMeetingTime: patientMeetingTime.format("ddd, MMM D, YYYY, h:mm A"),
        doctorMeetingTime: doctorMeetingTime.format("ddd, MMM D, YYYY, h:mm A"),
      };
      scheduleEmails({
        ...user,
        patientTimeZone: appointment.patientTimeZone,
        doctorTimeZone: appointment.doctor.timeZone,
      });
      sendEmail(user, "videoMeeting", { meeting: true });

      await sendNotification(

        "Appointment Created",
        `Hello ${appointment.patientName}, your appointment with Dr.${appointment.doctorName} `,
        `Hola ${appointment.patientName}, tu cita con el Dr.${appointment.doctorName}`,
        appointment.patient._id,
        appointment.doctor._id,
        appointment._id,
        { appointmentId: appointment._id }
      );

      await sendPushNotification(
        "Appointment Created",
        `Hello ${appointment.patientName}, your appointment with Dr.${appointment.doctorName} `,
        appointment.patient._id
      );

      await sendNotification(
        "Appointment Created",
        `Hello ${appointment.doctorName}, your appointment with ${appointment.patientName}`,
        `Hola ${appointment.doctorName}, tu cita con el ${appointment.patientName}`,
        appointment.doctor._id,
        appointment.patient._id,
        appointment._id,
        { appointmentId: appointment._id }
      );

      await sendPushNotification(
        "Appointment Created",
        `Hello ${appointment.doctorName}, your appointment with  ${appointment.patientName}`,

        appointment.doctor._id
      );

      await sendNotification(
        "Payment Success",
        `Payment of $${payment.amount} transferred successfully`,
        `Pago de $${payment.amount} recibido con éxito para`,

        appointment.patient._id,
        appointment.doctor._id,
        appointment._id,
        { appointmentId: appointment._id }
      );

      await sendPushNotification(
        "Payment Success",
        `Payment of $${payment.amount} transferred successfully`,
        appointment.patient._id
      );

      return next(new OkResponse(paymentIntent));
    } catch (err) {
      console.error("Error updating payment intent:", err);
      return next(new BadRequestResponse(req.t("stripe.errors.paymentFailed")));
    }
  }
);

router.get(
  "/reschedule/v1/payment_intents",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      const {
        total,
        payment_intent,
        appointmentId,
        daySlot,
        day,
        slotTime,
        duration,
      } = req.query;

      if (
        !appointmentId ||
        !payment_intent ||
        !total ||
        !slotTime ||
        !duration
      ) {
        return next(
          new BadRequestResponse(
            req.t("stripe.errors.missingRequiredParameters")
          )
        );
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(
        payment_intent
      );

      if (paymentIntent.status !== "succeeded") {
        return next(
          new BadRequestResponse(
            req.t("stripe.errors.paymentIntentNotSucceeded")
          )
        );
      }

      const previousMeeting = await Meeting.findOne({
        appointment: appointmentId,
      });
      previousMeeting.day = day;
      previousMeeting.duration = duration;
      previousMeeting.slotTime = slotTime;
      previousMeeting.daySlot = daySlot;

      const appointment = await Appointment.findOne({ _id: appointmentId });

      if (!appointment)
        return next(
          new BadRequestResponse(req.t("stripe.errors.appointmentNotFound"))
        );
      const previousSlotTime = appointment.slotTime;
      const doctorTimeZone = appointment.doctor.timeZone;
      const patientTimeZone = appointment.patientTimeZone;

      appointment.slotTime = slotTime;
      appointment.duration = duration;
      appointment.day = day;
      appointment.daySlot = daySlot;
      appointment.isRescheduling = true;

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

      const dateLongFormat = "MMMM DD YYYY";
      const doctorFormattedDate = formatDateToTimeZone(
        slotTime,
        dateLongFormat,
        doctorTimeZone
      );

      const patientFormattedDate = formatDateToTimeZone(
        slotTime,
        dateLongFormat,
        patientTimeZone
      );
      const previousFormatDate = formatDateToTimeZone(
        previousSlotTime,
        dateLongFormat,
        doctorTimeZone
      );

      await sendNotification(
        "booking-reschedule",
        `Hello ${appointment.doctor.fullName}, your session has been rescheduled from ${previousFormatStartTime} ${previousFormatDate}, to ${doctorFormattedStartTime} ${doctorFormattedDate}`,
        `Hola ${appointment.doctor.fullName}, tu sesión ha sido reprogramada desde ${previousFormatStartTime} ${previousFormatDate}, a ${doctorFormattedStartTime} ${doctorFormattedDate}`,
        appointment.doctor._id
      );

      await sendNotification(
        "booking-reschedule",
        `Hello ${appointment.patient.fullName}, your session has been rescheduled from ${previousFormatStartTime} ${previousFormatDate}, to ${patientFormattedStartTime} ${patientFormattedDate}`,
        `Hola ${appointment.doctor.fullName}, tu sesión ha sido reprogramada desde ${previousFormatStartTime} ${previousFormatDate}, a ${doctorFormattedStartTime} ${doctorFormattedDate}`,

        appointment.patient._id
      );

      // const link = `${frontend}/?roomId=${meeting?.roomId}`;
      // sendEmail(user, "videoMeeting", { meeting: true });

      const payment = await Payment.findOne({ paymentId: payment_intent });
      if (!payment) {
        return next(
          new BadRequestResponse(req.t("stripe.errors.paymentNotFound"))
        );
      }

      if (payment.status === "Completed") {
        return next(new OkResponse(paymentIntent));
      }

      payment.chargeId = paymentIntent.latest_charge;
      payment.status = "Completed";
      await payment.save();
      await appointment.save();
      await previousMeeting.save();

      return next(new OkResponse(paymentIntent));
    } catch (err) {
      console.error("Error updating payment intent:", err);
      return next(
        new BadRequestResponse(req.t("stripe.errors.reschedulingFailed"))
      );
    }
  }
);

//for app
router.post("/payment-sheet", async (req, res, next) => {
  try {
    const { amount, payee, payer, appointmentId } = req.body;
    const platformFeePercentage = 0.1; // 10% platform fee

    // Calculate the consultation fee (doctor's fee)
    const consultationFee = amount / (1 + platformFeePercentage);

    const customer = await stripe.customers.create();
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2024-04-10" }
    );
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    const payment = new Payment({
      paymentId: paymentIntent.id,
      appointment: appointmentId,
      amount: amount,
      payee: payee,
      payer: payer,
      withdraw: false,
      consultationFee: consultationFee,
    });
    await payment.save();

    return next(
      new OkResponse({
        paymentIntent: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: PublishableKey,
      })
    );
  } catch (error) {
    console.error(`Error creating payment: ${error.message}`);
    return next(
      new BadRequestResponse(req.t("stripe.errors.paymentIntentCreationFailed"))
    );
  }
});

//for app
router.post("/reschedule/payment-sheet", async (req, res, next) => {
  try {
    const { amount, payee, payer, appointmentId } = req.body;
    const platformFeePercentage = 0.1; // 10% platform fee

    // Calculate the consultation fee (doctor's fee)
    const consultationFee = amount / (1 + platformFeePercentage);

    const customer = await stripe.customers.create();
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2024-04-10" }
    );
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    const transaction = new Payment({
      paymentId: paymentIntent.id,
      appointment: appointmentId,
      amount: amount,
      payee: payee,
      payer: payer,
      withDraw: false,
      type: "reschedule",
      consultationFee: consultationFee,
    });

    await transaction.save();

    return next(
      new OkResponse({
        paymentIntent: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: PublishableKey,
      })
    );
  } catch (error) {
    console.error(`Error creating payment: ${error.message}`);
    return next(
      new BadRequestResponse(req.t("stripe.errors.paymentIntentCreationFailed"))
    );
  }
});

module.exports = router;
