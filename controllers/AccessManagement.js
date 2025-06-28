// controllers/accessController.js
const {EmployeeAccess,ClientAccess} = require("../models/editableColumn");
const User = require('../models/users');

// Helper function to handle common access operations
const handleAccessOperations = (Model, nameField) => {
  return {
    // Assign or update access
    assignOrUpdate: async (req, res) => {
      try {
        const { [nameField]: name, editableColumns, assignedByAdmin } = req.body;
        
        // Validate input
        if (!name || !Array.isArray(editableColumns) || !assignedByAdmin) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const existingAccess = await Model.findOne({ [nameField]: name });
        
        if (existingAccess) {
          // Update existing access
          existingAccess.editableColumns = editableColumns;
          existingAccess.assignedByAdmin = assignedByAdmin;
          await existingAccess.save();
          return res.status(200).json({ 
            message: `${nameField === 'employeeName' ? 'Employee' : 'Client'} access updated successfully`,
            data: existingAccess
          });
        } else {
          // Create new access
          const newAccess = new Model({
            [nameField]: name,
            editableColumns,
            assignedByAdmin
          });
          await newAccess.save();
          return res.status(201).json({ 
            message: `${nameField === 'employeeName' ? 'Employee' : 'Client'} access created successfully`,
            data: newAccess
          });
        }
      } catch (error) {
        console.error(`Error in assignOrUpdate ${nameField === 'employeeName' ? 'employee' : 'client'} access:`, error);
        return res.status(500).json({ 
          error: `Failed to ${req.method === 'POST' ? 'create' : 'update'} ${nameField === 'employeeName' ? 'employee' : 'client'} access`
        });
      }
    },

    // Delete access
    deleteAccess: async (req, res) => {
      try {
        const name = req.params[nameField];
        const deletedAccess = await Model.findOneAndDelete({ [nameField]: name });
        
        if (!deletedAccess) {
          return res.status(404).json({ 
            error: `${nameField === 'employeeName' ? 'Employee' : 'Client'} access not found` 
          });
        }
        
        return res.status(200).json({ 
          message: `${nameField === 'employeeName' ? 'Employee' : 'Client'} access deleted successfully`,
          data: deletedAccess
        });
      } catch (error) {
        console.error(`Error deleting ${nameField === 'employeeName' ? 'employee' : 'client'} access:`, error);
        return res.status(500).json({ 
          error: `Failed to delete ${nameField === 'employeeName' ? 'employee' : 'client'} access`
        });
      }
    },

    // Get all assigned accesses
    getAllAssigned: async (req, res) => {
      try {
        const accesses = await Model.find().sort({ createdAt: -1 });
        return res.status(200).json({ 
          message: `${nameField === 'employeeName' ? 'Employees' : 'Clients'} access list retrieved successfully`,
          data: accesses
        });
      } catch (error) {
        console.error(`Error fetching ${nameField === 'employeeName' ? 'employee' : 'client'} accesses:`, error);
        return res.status(500).json({ 
          error: `Failed to fetch ${nameField === 'employeeName' ? 'employee' : 'client'} accesses`
        });
      }
    }
  };
};

// Initialize operations for both employee and client
const employeeOperations = handleAccessOperations(EmployeeAccess, 'employeeName');
const clientOperations = handleAccessOperations(ClientAccess, 'clientName');

// User management
const getUserByRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    // Validate role
    if (!['employee', 'client'].includes(role)) {
      return res.status(400).json({ error: "Invalid role specified" });
    }

    const users = await User.find({ role }).select('name email role').sort({ name: 1 });
    
    return res.status(200).json({ 
      message: `${role.charAt(0).toUpperCase() + role.slice(1)}s retrieved successfully`,
      data: users
    });
  } catch (error) {
    console.error(`Error fetching users by role ${req.params.role}:`, error);
    return res.status(500).json({ 
      error: `Failed to fetch ${req.params.role}s`
    });
  }
};

// Get all available columns (common for both employee and client)
const getAvailableColumns = async (req, res) => {
  try {
    // In a real application, you might get these from a database or configuration
    const columns = [
      "caseId", "remarks", "name", "details", "details1", "priority", 
      
    ];
    
    return res.status(200).json({ 
      message: "Columns retrieved successfully",
      data: columns
    });
  } catch (error) {
    console.error("Error fetching columns:", error);
    return res.status(500).json({ error: "Failed to fetch columns" });
  }
};

module.exports = {
  // Employee access
  assignOrUpdateEmployeeAccess: employeeOperations.assignOrUpdate,
  deleteEmployeeAccess: employeeOperations.deleteAccess,
  fetchAllAssignedEmployees: employeeOperations.getAllAssigned,
  
  // Client access
  assignOrUpdateClientAccess: clientOperations.assignOrUpdate,
  deleteClientAccess: clientOperations.deleteAccess,
  fetchAllAssignedClients: clientOperations.getAllAssigned,
  
  // Common
  getUsersByRole: getUserByRole,
  getAvailableColumns
};












// const User = require('../models/users');
// const EmployeeAccess = require("../models/editableColumn");


// exports.getEmployee = async(req,res) =>{
//     try {
//         const employees = await User.find({role:"employee"});
//         res.json(employees);
//       } catch (error) {
//         res.status(500).json({ error: error.message });
//       }
// }


// //////////////////////-Employee-Access-////////////////////////

// // Fetch all employees (for dropdown)
// exports.fetchAllEmployees = async (req, res) => {
//   try {
//     const employees = await EmployeeAccess.find({}, { employeeName: 1, _id: 0 });
//     res.status(200).json(employees);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch employees" });
//   }
// };

// // Assign/Update editable columns for an employee
// // Assign/Update editable columns for an employee
// exports.assignOrUpdateAccess = async (req, res) => {
//   const { employeeName, editableColumns, assignedByAdmin } = req.body;
//   try {
//     const existingAccess = await EmployeeAccess.findOne({ employeeName });
//     if (existingAccess) {
//       // Replace the existing editableColumns with the new selection
//       existingAccess.editableColumns = editableColumns;
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


// // Delete employee access
// exports.deleteEmployeeAccess = async (req, res) => {
//   const { employeeName } = req.params;
//   try {
//     await EmployeeAccess.findOneAndDelete({ employeeName });
//     res.status(200).json({ message: "Employee access deleted successfully!" });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to delete employee access" });
//   }
// };

// // Fetch all assigned employees (for main table)
// exports.fetchAllAssignedEmployees = async (req, res) => {
//   try {
//     const assignedEmployees = await EmployeeAccess.find();
//     res.status(200).json(assignedEmployees);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch assigned employees" });
//   }
// };