const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },       // Full S3 URL
  key: { type: String, required: true },      // S3 object key
  bucket: { type: String, required: true },   // S3 bucket name
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const supportIssueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  attachments: [attachmentSchema],
  status: { 
    type: String, 
    enum: ["pending", "resolved", "in-progress"], 
    default: "pending" 
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model("SupportIssue", supportIssueSchema);

// const mongoose = require("mongoose");

// const supportIssueSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   description: { type: String, required: true },
//   attachments: [
//     {
//       filename: String,
//       path: String,
//       mimetype: String,
//       size: Number,
//     },
//   ],
//   status: { type: String, enum: ["pending", "resolved", "in-progress"], default: "pending" },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("SupportIssue", supportIssueSchema);