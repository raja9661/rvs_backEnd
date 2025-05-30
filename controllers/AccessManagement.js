const User = require('../models/users');
const EmployeeAccess = require("../models/editableColumn");


exports.getEmployee = async(req,res) =>{
    try {
        const employees = await User.find({role:"employee"});
        res.json(employees);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
}


//////////////////////-Employee-Access-////////////////////////

// Fetch all employees (for dropdown)
exports.fetchAllEmployees = async (req, res) => {
  try {
    const employees = await EmployeeAccess.find({}, { employeeName: 1, _id: 0 });
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};

// Assign/Update editable columns for an employee
// Assign/Update editable columns for an employee
exports.assignOrUpdateAccess = async (req, res) => {
  const { employeeName, editableColumns, assignedByAdmin } = req.body;
  try {
    const existingAccess = await EmployeeAccess.findOne({ employeeName });
    if (existingAccess) {
      // Replace the existing editableColumns with the new selection
      existingAccess.editableColumns = editableColumns;
      await existingAccess.save();
      res.status(200).json({ message: "Access updated successfully!" });
    } else {
      // Create new access
      const newAccess = new EmployeeAccess({ employeeName, editableColumns, assignedByAdmin });
      await newAccess.save();
      res.status(201).json({ message: "Access assigned successfully!" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to assign/update access" });
  }
};
// exports.assignOrUpdateAccess = async (req, res) => {
//   const { employeeName, editableColumns, assignedByAdmin } = req.body;
//   try {
//     const existingAccess = await EmployeeAccess.findOne({ employeeName });
//     if (existingAccess) {
//       // Merge new columns with existing ones, skipping duplicates
//       const uniqueColumns = [...new Set([...existingAccess.editableColumns, ...editableColumns])];
//       existingAccess.editableColumns = uniqueColumns;
//       await existingAccess.save();
//       res.status(200).json({ message: "Access updated successfully!" });
//     } else {
//       // Create new access
//       const newAccess = new EmployeeAccess({ employeeName, editableColumns, assignedByAdmin });
//       await newAccess.save();
//       res.status(201).json({ message: "Access assigned successfully!" });
//     }
//   } catch (error) {
//     res.status(500).json({ error: "Failed to assign/update access" });
//   }
// };


// Delete employee access
exports.deleteEmployeeAccess = async (req, res) => {
  const { employeeName } = req.params;
  try {
    await EmployeeAccess.findOneAndDelete({ employeeName });
    res.status(200).json({ message: "Employee access deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete employee access" });
  }
};

// Fetch all assigned employees (for main table)
exports.fetchAllAssignedEmployees = async (req, res) => {
  try {
    const assignedEmployees = await EmployeeAccess.find();
    res.status(200).json(assignedEmployees);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch assigned employees" });
  }
};