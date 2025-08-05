const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 10000000, 
  },
});

module.exports = mongoose.model("Counter", counterSchema);
