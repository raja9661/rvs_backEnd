const mongoose = require("mongoose");

const employeeAccessSchema = new mongoose.Schema({
  employeeName: { type: String, required: true, unique: true },
  editableColumns: { type: [String], default: [] }, // Correct syntax
  assignedByAdmin: { type: String, required: true },
}, { timestamps: true });

const clientAccessSchema = new mongoose.Schema({
  clientName: { type: String, required: true, unique: true },
  editableColumns: { type: [String], default: [] },
  assignedByAdmin: { type: String, required: true },
}, { timestamps: true });

module.exports = {
  EmployeeAccess: mongoose.model('EmployeeAccess', employeeAccessSchema),
  ClientAccess: mongoose.model("ClientAccess", clientAccessSchema),
};