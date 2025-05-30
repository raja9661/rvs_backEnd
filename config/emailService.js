const nodemailer = require("nodemailer");
require("dotenv").config();

const sendEmail = async (to, subject, text) => {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail", // Use your email provider (Gmail, Outlook, etc.)
      auth: {
        user: process.env.EMAIL, // Your email
        pass: process.env.PASSWORD, // Your email password or App Password
      },
    });

    let mailOptions = {
      from: process.env.EMAIL,
      to: to,
      subject: subject,
      text: text,
    };

    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.log("Error sending email:");
  }
};

module.exports = sendEmail;














// const nodemailer = require("nodemailer");
// require("dotenv").config();

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL,
//     pass: process.env.PASSWORD,
//   },
// });

// const sendEmail = async (to, subject, text) => {
//   try {
//     await transporter.sendMail({ from: process.env.EMAIL, to, subject, text });
//   } catch (error) {
//     console.log("Email Error:", error);
//   }
// };

// module.exports = { sendEmail };
