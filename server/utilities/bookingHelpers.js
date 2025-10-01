const { formatDateToTimeZone } = require("./dateAndTimeFormator");
const { sendNotification, sendPushNotification } = require("./notification");

async function formatBookingTime(time, timeZoneValue) {
  const startTime = formatDateToTimeZone(time, "h:mm A", timeZoneValue);
  const dateLongFormat = "MMMM Do YYYY";
  const formattedDate = formatDateToTimeZone(
    time,
    dateLongFormat,
    timeZoneValue
  );
  return `${startTime}, ${formattedDate}`;
}

const cancellationReasons = [
  {
    id: "Personal emergency",
    label: "Personal emergency",
    label2: "Emergencia personal",
  },
  {
    id: "Scheduling Conflicts",
    label: "Scheduling Conflicts",
    label2: "Conflictos de programación",
  },
	{
    id: "Medical emergency with another patient",
    label: "Medical emergency with another patient",
    label2: "Emergencia médica con otro paciente",
  },
  {
    id: "Personal illness/health issue",
    label: "Personal illness/health issue",
    label2: "Emergencia médica con otro paciente",
  },
  { id: "other", label: "Other Reason", label2: "Otra Razón" },
];


const getLocalizedReason = (reasonId) => {
  const reasons =cancellationReasons;
  const reason = reasons.find((r) => {
    const idMatch = r.id.toLowerCase() === reasonId.toLowerCase();
    const labelMatch = r.label.toLowerCase() === reasonId.toLowerCase();
    const label2Match = r.label2.toLowerCase() === reasonId.toLowerCase();
    return idMatch || labelMatch || label2Match;
  });
  
  console.log("Looking up reason:", reasonId);
  console.log("Matched reason object:", reason);

  if (reason) {
    return {
      en: reason.label,
      es: reason.label2,
    };
  } else {
    console.warn("Unmatched reason, using fallback:", reasonId);
    return {
      en: reasonId,
      es: reasonId,
    };
  }
};


exports.notifyCancellation = async (booking) => {
  const patientFormattedTime = await formatBookingTime(
    booking.slotTime,
    booking.patientTimeZone
  );
  const doctorFormattedTime = await formatBookingTime(
    booking.slotTime,
    booking.doctor.timeZone
  );

  const reason = getLocalizedReason(booking.cancelReason);

  const messageToPatient = `Hello ${booking.patient.fullName}, your session on ${patientFormattedTime} with ${booking.doctor.fullName} has been cancelled. Reason: ${reason.en}`;
  const messageToDoctor = `Hello ${booking.doctor.fullName}, your session on ${doctorFormattedTime} with ${booking.patient.fullName} has been cancelled. Reason: ${reason.en}`;

  await sendNotification(
    "Booking Cancelled",
    messageToPatient,
    `Hola ${booking.patient.fullName}, tu sesión el ${patientFormattedTime} con ${booking.doctor.fullName} ha sido cancelada. Motivo: ${reason.es}`,
    booking.patient._id,
    booking.doctor._id,
    booking
  );

  await sendNotification(
    "Booking Cancelled",
    messageToDoctor,
    `Hola ${booking.doctor.fullName}, tu sesión el ${doctorFormattedTime} con ${booking.patient.fullName} ha sido cancelada. Motivo: ${reason.es}`,
    booking.doctor._id,
    booking.patient._id,
    booking
  );

  await sendPushNotification(
    "Booking Cancelled",
    messageToPatient,
    booking.patient._id
  );
  await sendPushNotification(
    "Booking Cancelled",
    messageToDoctor,
    booking.doctor._id
  );
};

exports.notifyAbsentToDoctor = async (booking) => {
  const doctorFormattedTime = await formatBookingTime(
    booking.slotTime,
    booking.doctor.timeZone
  );
  const messageToDoctor = `The patient ${booking.patient.fullName} has marked you as absent for meeting scheduled on ${doctorFormattedTime}`;

  await sendNotification(
    "You have marked Absent",
    `The patient ${booking.patient.fullName} has marked you as absent for meeting scheduled on ${doctorFormattedTime}`,
    `El paciente ${booking.patient.fullName} te ha marcado como ausente para la reunión programada para el ${doctorFormattedTime}`,
    booking.doctor._id
  );

  await sendPushNotification(
    "You have marked Absent",
    messageToDoctor,
    booking.doctor._id
  );
};

exports.notifyAbsentToPatient = async (booking) => {
  const patientFormattedTime = await formatBookingTime(
    booking.slotTime,
    booking.patientTimeZone
  );

  const messageToPatient = `Dr ${booking.doctor.fullName} has marked you as absent for meeting scheduled on ${patientFormattedTime}`;

  console.log("Notification message", messageToPatient);
  await sendNotification(
    "You have marked Absent",
    `Dr ${booking.doctor.fullName} has marked you as absent for meeting scheduled on ${patientFormattedTime}`,
    `El Dr. ${booking.doctor.fullName} te ha marcado como ausente para la reunión programada para el ${patientFormattedTime}`,
    booking.patient._id
  );

  await sendPushNotification(
    "You have marked Absent",
    messageToPatient,
    booking.patient._id
  );
};

exports.calculatePatientRefund = (totalAmount, cancellationPolicy) => {
  switch (cancellationPolicy) {
    case "policy_24h":
      return (totalAmount * 95) / 100;
    case "policy_12h_24h":
      return (totalAmount * 50) / 100;
    default:
      return 0;
  }
};
