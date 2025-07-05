const express = require("express");
const router = express.Router();
const ColumnConfig = require("../models/ColumnPreferences");
const KYC = require("../models/kycModel");

// Get current column order for a role
router.get("/:role", async (req, res) => {
  try {
    const config = await ColumnConfig.findOne({ role: req.params.role });
    res.json(config?.columns || []);
  } catch (err) {
    res.status(500).json({ message: "Error fetching column order" });
  }
});

// Save or update column order
router.post("/", async (req, res) => {
  const { role, columns } = req.body;
  try {
    const updated = await ColumnConfig.findOneAndUpdate(
      { role },
      { columns },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ message: "Error saving column order" });
  }
});

// Get all column names from schema
router.get("/all-columns", async (req, res) => {
  try {
    const schemaPaths = KYC.schema.paths;
    const allColumns = Object.keys(schemaPaths).filter(
      key => !["_id", "__v", "createdAt", "updatedAt"].includes(key)
    );
    res.json(allColumns);
  } catch (err) {
    res.status(500).json({ message: "Error fetching column names" });
  }
});

module.exports = router;
