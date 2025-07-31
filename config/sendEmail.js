
require("dotenv").config();
const { Resend } = require("resend");


if(!process.env.RESEND_API_KEY){
    console.log("CHECK EMAIL API INSIDE THE ENV FILE!")
}

const resend = new Resend(process.env.RESEND_API_KEY)

const sendEmail = async({ sendTo, subject, html })=>{
    try 
    {
        const { data, error } = await resend.emails.send({
            from: 'NoReply <support@rvsdoc.com>',
            to: sendTo,
            subject: subject,
            html: html,
        })

        if (error) {
            return console.error({ error })
        }

        return data
    } catch (error) {
        console.log(error)
    }
}

module.exports = sendEmail;


// if (!process.env.RESEND_API_KEY) {
//   console.error("CHECK EMAIL API INSIDE THE ENV FILE!");
// }

// const resend = new Resend(process.env.RESEND_API_KEY);

// const sendEmail = async ({ sendTo, subject, html, attachments = [] }) => {
//   try {
//     const { data, error } = await resend.emails.send({
//       from: 'NoReply <support@rvsdoc.com>', 
//       to: sendTo,
//       subject,
//       html,
//       attachments: attachments.map(file => ({
//         filename: file.filename,
//         path: file.url,
//       }))
//     });

//     if (error) {
//       console.error("❌ Email sending failed:", error);
//       return null;
//     }

//     console.log("✅ Email sent successfully:", data);
//     return data;
//   } catch (err) {
//     console.error("❌ Email sending exception:", err);
//     return null;
//   }
// };

