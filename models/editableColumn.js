const mongoose = require("mongoose");

const employeeAccessSchema = new mongoose.Schema({
  employeeName: { type: String, required: true, unique: true },
  editableColumns: { type: [String], default: [] }, // Correct syntax
  assignedByAdmin: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("EmployeeAccess", employeeAccessSchema);