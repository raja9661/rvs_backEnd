const SupportIssue = require("../models/supportIssue.model");
const { DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const nodemailer = require("nodemailer");
const s3Client = require('../config/s3Config');
const sendEmail = require("../config/sendEmail");
const issueTemplate = require("../utils/issueTemplate");

const dotenv = require('dotenv');

dotenv.config();


// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   }
// });

// Helper function to delete files from S3
const deleteFromS3 = async (attachments) => {
  try {
    await Promise.all(
      attachments.map(async (file) => {
        const deleteParams = {
          Bucket: file.bucket,
          Key: file.key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      })
    );
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
};

// Create new issue with automatic email to developer



exports.createIssue = async (req, res) => {
  try {
    const { title, description } = req.body;

    const attachments = req.files?.map(file => ({
      filename: file.originalname,
      url: file.location,
      key: file.key,
      bucket: file.bucket,
      mimetype: file.mimetype,
      size: file.size,
    })) || [];

    const issue = new SupportIssue({
      title,
      description,
      attachments,
    });

    await issue.save();
    

    await sendEmail({
      sendTo: 'ufs_support@rvsdoc.com',
       subject : "ISSUE",
            html : issueTemplate({
                sub : title,
                issue : description
            }),
      attachments: attachments.map(file => ({
        filename: file.filename,
        url: file.url,
      }))
    });

    res.status(201).json({ success: true, issue });
  } catch (error) {
    console.error("Create Issue Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create issue",
      details: error.message,
    });
  }
};


// exports.createIssue = async (req, res) => {
//   try {
//     const { title, description } = req.body;
//     // const createdBy = req.user._id;

//     const attachments = req.files?.map(file => ({
//       filename: file.originalname,
//       url: file.location,
//       key: file.key,
//       bucket: file.bucket,
//       mimetype: file.mimetype,
//       size: file.size,
//     }));

//     const issue = new SupportIssue({
//       title,
//       description,
//       attachments,
//       // createdBy
//     });

//     await issue.save();

//     // Send email with attachments
//     const transporter = nodemailer.createTransport({
//       service: "Gmail",
//       auth: {
//         user: process.env.EMAIL,
//         pass: process.env.PASSWORD,
//       },
//     });

//     const mailOptions = {
//       from: `Support System <${process.env.EMAIL}>`,
//       to: "info@rvsdoc.com",
//       subject: `[SUPPORT] ${title}`,
//       html: `
//         <h2>New Support Issue</h2>
//         <p><strong>Title:</strong> ${title}</p>
//         <p><strong>Description:</strong></p>
//         <div style="background:#f5f5f5;padding:1rem;border-radius:4px;">
//           ${description.replace(/\n/g, '<br>')}
//         </div>
//       `,
//       attachments: attachments?.map(file => ({
//         filename: file.filename,
//         path: file.url
//       })) || []
//     };

//     await transporter.sendMail(mailOptions);

//     res.status(201).json({ success: true, issue });
//   } catch (error) {
//     console.error("Create Issue Error:", error);
//     res.status(500).json({ 
//       success: false, 
//       error: "Failed to create issue",
//       details: error.message 
//     });
//   }
// };

// Get all issues for current user
exports.getAllIssues = async (req, res) => {
  try {
    const issues = await SupportIssue.find({})
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, issues });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete issue and its attachments from S3
exports.deleteIssue = async (req, res) => {
  try {
    const issue = await SupportIssue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({ success: false, error: "Issue not found" });
    }

    

    // Delete attachments from S3 if they exist
    if (issue.attachments?.length > 0) {
      await deleteFromS3(issue.attachments);
    }

    await SupportIssue.findByIdAndDelete(req.params.id);

    res.status(200).json({ 
      success: true, 
      message: "Issue and attachments deleted successfully" 
    });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete issue",
      details: error.message 
    });
  }
};

// Get single issue
exports.getIssue = async (req, res) => {
  try {
    const issue = await SupportIssue.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!issue) {
      return res.status(404).json({ success: false, error: "Issue not found" });
    }

    res.status(200).json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// const SupportIssue = require("../models/supportIssue.model");
// const nodemailer = require("nodemailer");
// require("dotenv").config();


// // Create a new issue
// exports.createIssue = async (req, res) => {
//   try {
//     const { title, description } = req.body;

//     const attachments = req.files?.map(file => ({
//       filename: file.originalname,
//       url: file.location,       // S3 file URL
//       key: file.key,            // S3 object key (path inside the bucket)
//       bucket: file.bucket,      // S3 bucket name
//       mimetype: file.mimetype,
//       size: file.size,
//     }));

//     const issue = new SupportIssue({
//       title,
//       description,
//       attachments,
//     });

//     await issue.save();
//     res.status(201).json({ success: true, issue });
//   } catch (error) {
//     console.error("Create Issue Error:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // exports.createIssue = async (req, res) => {
// //   try {
// //     const { title, description } = req.body;
// //     const attachments = req.files?.map(file => ({
// //       filename: file.originalname,
// //       path: file.path,
// //       mimetype: file.mimetype,
// //       size: file.size,
// //     }));

// //     const issue = new SupportIssue({
// //       title,
// //       description,
// //       attachments,
// //       createdBy: req.user._id,
// //     });

// //     await issue.save();
// //     res.status(201).json({ success: true, issue });
// //   } catch (error) {
// //     res.status(500).json({ success: false, error: error.message });
// //   }
// // };

// // Send issue to developer via email
// exports.sendIssueToDeveloper = async (req, res) => {
//   try {
//     const issue = await SupportIssue.findById(req.params.id);
//     console.log("issue:",issue)
//     if (!issue) return res.status(404).json({ error: "Issue not found" });
//     console.log("hello")
//     // Configure email transporter (Nodemailer)
//     const transporter = nodemailer.createTransport({
//       service: "Gmail",
//       auth: {
//         user: process.env.EMAIL,
//         pass: process.env.PASSWORD,
//       },
//     });
//     console.log("hello1")

//     const mailOptions = {
//       from: process.env.EMAIL,
//       to: "info@rvsdoc.com",
//       subject: `New Support Issue: ${issue.title}`,
//       html: `
//         <h2>${issue.title}</h2>
//         <p>${issue.description}</p>
//         <p>Status: ${issue.status}</p>
//       `,
//       attachments: issue.attachments.map(file => ({
//         filename: file.filename,
//         path: file.path,
//       })),
//     };
//     console.log("hello3")
//     await transporter.sendMail(mailOptions);
//     res.status(200).json({ success: true, message: "Issue sent to developer!" });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Get all issues
// exports.getAllIssues = async (req, res) => {
//   try {
//     const issues = await SupportIssue.find({ createdBy: req.user._id });
//     res.status(200).json({ success: true, issues });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Delete an issue
// exports.deleteIssue = async (req, res) => {
//   try {
//     await SupportIssue.findByIdAndDelete(req.params.id);
//     res.status(200).json({ success: true, message: "Issue deleted!" });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };