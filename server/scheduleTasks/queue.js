const moment = require('moment-timezone');
const { reminderQueue } = require('.');






const scheduleEmails = async (meetingDetails) => {
  const { patientTimeZone, doctorTimeZone, patientName, doctorName, slotTime, patientEmail, doctorEmail , doctorPhone , patientPhone } = meetingDetails;

  const meetingTime = moment.tz(slotTime, 'UTC'); // This is the original slot time in UTC

  // Convert the meeting time to the patient and doctor time zones
  const patientMeetingTime = meetingTime.clone().tz(patientTimeZone);
  const doctorMeetingTime = meetingTime.clone().tz(doctorTimeZone);

  console.log("patientMeetingTime *********",patientMeetingTime)
  console.log("doctorMeetingTime *********",doctorMeetingTime)

  // Calculate reminder times (30 minutes before the meeting)
  const patientReminderTime = meetingTime.clone().tz(patientTimeZone).subtract(30, 'minutes');
  const doctorReminderTime = meetingTime.clone().tz(doctorTimeZone).subtract(30, 'minutes');

  // Calculate delays in milliseconds from now until the reminder times
  const now = moment();
  const patientDelay = Math.max(patientReminderTime.diff(now), 0);  // Ensure delay is non-negative
  const doctorDelay = Math.max(doctorReminderTime.diff(now), 0);    // Ensure delay is non-negative


  // Schedule reminders for the doctor
  await scheduleReminders(doctorEmail, patientName, doctorMeetingTime.format('hh:mm A'), doctorMeetingTime.format('DD MMMM YYYY'), doctorDelay, "doctor");
  await scheduleSmsReminders(doctorPhone, patientName, doctorMeetingTime.format('hh:mm A'), doctorMeetingTime.format('DD MMMM YYYY'), doctorDelay, 'doctor', patientName);

  // Schedule reminders for the patient
  await scheduleReminders(patientEmail, doctorName, patientMeetingTime.format('hh:mm A'), patientMeetingTime.format('DD MMMM YYYY'), patientDelay,"patient");
  await scheduleSmsReminders(patientPhone, doctorName, patientMeetingTime.format('hh:mm A'), patientMeetingTime.format('DD MMMM YYYY'), patientDelay, 'patient', doctorName);
};

const scheduleReminders = async (email, name, time, date, delay, role) => {
  await reminderQueue.add({
    email,
    subject: `Reminder: Appointment in 30 minutes`,
    message: {
      name, 
      time,
      date,
      role
    }
  }, { delay });
};


const scheduleSmsReminders = async (phone, name, time, date, delay, role, otherPersonName) => {
  await reminderQueue.add({
    phone,
    subject: `Reminder: Appointment in 30 minutes`,
    message: {
      name, 
      time,
      date,
      role,
      otherPersonName
    }
  }, { delay });
};


module.exports = { scheduleEmails  ,scheduleSmsReminders };
