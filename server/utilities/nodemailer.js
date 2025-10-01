const nodemailer = require("nodemailer");
const {
  emailVerifyTemplate,
  forgetEmailTemplate,
  meetingEmailPatientTemplate,
  meetingEmailDoctorTemplate,
  patientConsultationReminderTemplate,
  doctorConsultationReminderTemplate,
  meetingEmailPatientTemplateOnSite,
  meetingEmailDoctorTemplateOnSite,
  premiumSubscriptionTemplate,
} = require("../emailTemplates/authTemplates");

const SENDER_ADDRESS = "AI Medik<ai-medik@gmail.com>";

const setTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const selectTemplate = (user, body, template, role) => {
  if (body.verifyEmail) template = emailVerifyTemplate(user);
  else if (body.forgetEmail) template = forgetEmailTemplate(user);
  else if (body.subscription) template = premiumSubscriptionTemplate(user);
  else if (body.meeting && role == "patient")
    template = meetingEmailPatientTemplate(user);
  else if (body.meeting && role == "doctor")
    template = meetingEmailDoctorTemplate(user);
  else if (body.onsite && role == "patient")
    template = meetingEmailPatientTemplateOnSite(user);
  else if (body.onsite && role == "doctor")
    template = meetingEmailDoctorTemplateOnSite(user);
  else console.log("Body Not Valid", body);

  return template;
};

const setMessage = (user, toEmail, subject, template) => {
  console.log("sender address", SENDER_ADDRESS);
  return {
    to: toEmail,
    from: SENDER_ADDRESS,
    subject,
    html: template,
  };
};

exports.sendEmail = (user, subject, body) => {
  console.log("USer", user);
  console.log("subject", subject);
  console.log("body", body);

  const transporter = setTransporter();

  if (subject == "videoMeeting") {
    let template = "";

    const patientTemplate = selectTemplate(user, body, template, "patient");
    const patientMsg = setMessage(
      user,
      user.patientEmail,
      "Video Meeting",
      patientTemplate
    );

    const doctorTemplate = selectTemplate(user, body, template, "doctor");
    const doctorMsg = setMessage(
      user,
      user.doctorEmail,
      "Video Meeting",
      doctorTemplate
    );

    Promise.all([
      transporter.sendMail(patientMsg),
      transporter.sendMail(doctorMsg),
    ])
      .then((info) => console.log("Emails sent", info))
      .catch((err) => console.log(err));
  } else if (subject == "onsite") {
    let template = "";

    const patientTemplate = selectTemplate(user, body, template, "patient");
    const patientMsg = setMessage(
      user,
      user.patientEmail,
      "Onsite Appointment",
      patientTemplate
    );

    const doctorTemplate = selectTemplate(user, body, template, "doctor");
    const doctorMsg = setMessage(
      user,
      user.doctorEmail,
      "Onsite Appointment",
      doctorTemplate
    );

    Promise.all([
      transporter.sendMail(patientMsg),
      transporter.sendMail(doctorMsg),
    ])
      .then((info) => console.log("Emails sent", info))
      .catch((err) => console.log(err));
  } else {
    let template = "";
    template = selectTemplate(user, body, template);
    const msg = setMessage(user, user.email, subject, template);

    transporter.sendMail(msg, (err, info) => {
      if (err) console.log("error while sending mail", err);
      else console.log("Email sent", info);
    });
  }
};

exports.sendEmailReminder = async (user, subject, message, role) => {
  console.log("Email", user.email);
  console.log("message", message);
  template=""
  if(role =='patient'){
    template = patientConsultationReminderTemplate(message);
  }else if(role =='doctor'){
    template = doctorConsultationReminderTemplate(message);
  }


  const transporter = setTransporter();

  const mailOptions = {
    from: SENDER_ADDRESS,
    to: user.email,
    subject: subject,
    html: template,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info);
  } catch (error) {
    console.error("Failed to send email:", error.message);
  }
};
