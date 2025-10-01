const { reminderQueue } = require("../scheduleTasks");
const { sendEmailReminder } = require("../utilities/nodemailer");
const TwilioService = require("../utilities/twilioService");

reminderQueue.process(async (job, done) => {
  const { subject, message, email, phone } = job.data;

  console.log("Processing job data:", job.data);

  try {
    if (email) {
        await sendEmailReminder({ email }, subject, message, message.role);
    }

    if (phone) {
      let title;
      if (message.role === 'doctor') {
        title = `Appointment with patient ${message.otherPersonName}`;
      } else {
        title = `Appointment with Dr. ${message.otherPersonName}`;
      }

      await TwilioService.sendMeetingReminder(phone, {
        title: title,
        timeUntilStart: "30 minutes",
        startTime: message.time,
        date: message.date
      });
    }

    console.log(`Reminders sent successfully`);
    done(); // Mark job as done successfully
  } catch (error) {
    console.error("Error processing reminder job:", error);
    done(new Error('Failed to send reminders')); // Mark job as failed
  }
});





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