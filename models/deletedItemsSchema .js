const mongoose = require('mongoose');

const DeletedItemsSchema = new mongoose.Schema({
    //   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
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
      status: { type: String, default: "New Data" },
      caseStatus: { type: String, default: "New Pending" },
      productType: { type: String, default: "" },
      listByEmployee: { type: String, default: "" },
      dateOut: { type: String, default: "" },
      sentBy: { type: String, default: "" },
      autoOrManual: { type: String, default: "manual" },
      caseDoneBy: { type: String, default: "" },
      clientTAT: { type: String, default: "" },
      customerCare: { type: String, default: "" },
      sentDate: { type: String, default: "" },
      clientType: { type: String, default: "" },
      dedupBy: { type: String, default: "" },
      vendorRate: { type: Number, defaul:"" },
      clientRate: { type: Number, defaul:"" },
  deletedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DeletedItems', DeletedItemsSchema);