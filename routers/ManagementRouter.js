const express = require('express');
const {
    assignOrUpdateAccess,
    deleteEmployeeAccess,
    fetchAllAssignedEmployees
} = require('../controllers/AccessManagement')

const router = express.Router();

router.post("/assign-access", assignOrUpdateAccess);
router.delete("/delete-access/:employeeName", deleteEmployeeAccess);
router.get("/assigned-employees", fetchAllAssignedEmployees);

module.exports = router;