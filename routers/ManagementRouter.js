const express = require('express');
const router = express.Router();
const accessController = require('../controllers/AccessManagement');

// Employee access routes
router.get('/assigned-employees', accessController.fetchAllAssignedEmployees);
router.post('/assign-employee-access', accessController.assignOrUpdateEmployeeAccess);
router.delete('/delete-employee-access/:employeeName', accessController.deleteEmployeeAccess);

// Client access routes
router.get('/assigned-clients', accessController.fetchAllAssignedClients);
router.post('/assign-client-access', accessController.assignOrUpdateClientAccess);
router.delete('/delete-client-access/:clientName', accessController.deleteClientAccess);

// Common routes
router.get('/users/:role', accessController.getUsersByRole);
router.get('/available-columns', accessController.getAvailableColumns);

module.exports = router;