const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Consolidated dashboard endpoint
router.post('/data',  dashboardController.getDashboardData);

// Case details with expanded hierarchy
router.post('/case-details',  dashboardController.getCaseDetails);

// Manual update trigger
router.post('/update',  dashboardController.sendManualUpdate);

module.exports = router;