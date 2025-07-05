// models/ColumnConfig.js
const mongoose = require("mongoose");

const columnConfigSchema = new mongoose.Schema({
  role: { type: String, enum: ["admin", "employee", "client"], required: true, unique: true },
  columnOrder: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ColumnConfig", columnConfigSchema);