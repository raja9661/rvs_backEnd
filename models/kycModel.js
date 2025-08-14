const mongoose = require("mongoose");

const trackerSchema = new mongoose.Schema({
    userId: {type: String, default: "" }, 
    caseId:{type: String, default: "" },
    remarks: { type: String, default: "" },
    name: { type: String, default: "" },
    details: { type: String, default: "" },
    details1: { type: String, default: "" },
    priority: { type: String, default: "" },
    correctUPN: { type: String, default: ""},
    product: { type: String, default: "" },
    updatedProductName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    requirement: { type: String, default: "" },
    updatedRequirement: { type: String, default: "" },
    accountNumberDigit: { type: String, default: "" },
    bankCode: { type: String, default: "" },
    clientCode: { type: String, default: "" },
    vendorName: { type: String, default: "" },
    dateIn: { type: String, default: "" },
    dateInDate: { type: String, default: "" },
    status: { type: String, default: "Pending" },
    caseStatus: { type: String, default: "New Pending" },
    productType: { type: String, default: "" },
    listByEmployee: { type: String, default: "" },
    dateOut: { type: String, default: "" },
    dateOutInDay: { type: String, default: "" },
    sentBy: { type: String, default: "" },
    autoOrManual: { type: String, default: "manual" },
    caseDoneBy: { type: String, default: "" },
    clientTAT: { type: String, default: "" },
    customerCare: { type: String, default: "" },
    sentDate: { type: String, default: "" },
    sentDateInDay: { type: String, default: "" },
    clientType: { type: String, default: "" },
    dedupBy: { type: String, default: "" },
    vendorRate: { type: String, default:"" },
    clientRate: { type: String, default:"" },
    NameUploadBy: { type: String, default:"" },
    ReferBy: { type: String, default:"" },
    isRechecked: { type: Boolean, default: false },
    isDedup: { type: Boolean, default: false },
    recheckedAt: { type: Date },
    ipAddress:{ type: String, default: "" },
    vendorStatus:{ type: String, default: "" },
    year: { type: String }, // Add year field
    month: { type: String }, // Add month field
    role: { type: String, enum: ["admin", "employee", "client"]},

    attachments: [{
        caseId:String,
        filename: String,
        originalname: String,
        mimetype: String,
        size: Number,
        path: String,
        location: String,
        key: String,
        uploadedAt:String
      }],
}, { timestamps: true });

trackerSchema.index({ year: 1 });
trackerSchema.index({ month: 1 });
trackerSchema.index({ clientCode: 1 });
trackerSchema.index({ updatedProductName: 1 });
trackerSchema.index({ listByEmployee: 1 });
trackerSchema.index({ createdAt: 1 });
trackerSchema.index({ year: 1, month: 1, clientCode: 1 });


module.exports = mongoose.model("KYCdoc", trackerSchema);
