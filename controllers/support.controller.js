const SupportIssue = require("../models/supportIssue.model");
const nodemailer = require("nodemailer");
require("dotenv").config();


// Create a new issue
exports.createIssue = async (req, res) => {
  try {
    const { title, description } = req.body;

    const attachments = req.files?.map(file => ({
      filename: file.originalname,
      url: file.location,       // S3 file URL
      key: file.key,            // S3 object key (path inside the bucket)
      bucket: file.bucket,      // S3 bucket name
      mimetype: file.mimetype,
      size: file.size,
    }));

    const issue = new SupportIssue({
      title,
      description,
      attachments,
    });

    await issue.save();
    res.status(201).json({ success: true, issue });
  } catch (error) {
    console.error("Create Issue Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// exports.createIssue = async (req, res) => {
//   try {
//     const { title, description } = req.body;
//     const attachments = req.files?.map(file => ({
//       filename: file.originalname,
//       path: file.path,
//       mimetype: file.mimetype,
//       size: file.size,
//     }));

//     const issue = new SupportIssue({
//       title,
//       description,
//       attachments,
//       createdBy: req.user._id,
//     });

//     await issue.save();
//     res.status(201).json({ success: true, issue });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// Send issue to developer via email
exports.sendIssueToDeveloper = async (req, res) => {
  try {
    const issue = await SupportIssue.findById(req.params.id);
    console.log("issue:",issue)
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    console.log("hello")
    // Configure email transporter (Nodemailer)
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });
    console.log("hello1")

    const mailOptions = {
      from: process.env.EMAIL,
      to: "info@rvsdoc.com",
      subject: `New Support Issue: ${issue.title}`,
      html: `
        <h2>${issue.title}</h2>
        <p>${issue.description}</p>
        <p>Status: ${issue.status}</p>
      `,
      attachments: issue.attachments.map(file => ({
        filename: file.filename,
        path: file.path,
      })),
    };
    console.log("hello3")
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: "Issue sent to developer!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all issues
exports.getAllIssues = async (req, res) => {
  try {
    const issues = await SupportIssue.find({ createdBy: req.user._id });
    res.status(200).json({ success: true, issues });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete an issue
exports.deleteIssue = async (req, res) => {
  try {
    await SupportIssue.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Issue deleted!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};