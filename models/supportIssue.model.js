const mongoose = require("mongoose");

const supportIssueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  attachments: [
    {
      filename: String,
      path: String,
      mimetype: String,
      size: Number,
    },
  ],
  status: { type: String, enum: ["pending", "resolved", "in-progress"], default: "pending" },
  // createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SupportIssue", supportIssueSchema);