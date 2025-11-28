const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Admin report routes
router.get('/admin/reports', reportController.getReportData);
router.get('/admin/reports/download', reportController.downloadReportExcel);
router.post('/update-cell', reportController.updateCellData);

module.exports = router;