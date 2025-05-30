const express = require("express");

const { 
    singleUpload, 
    bulkUpload,
    uploadFile,
    extractData,
    processRecords, 
    // excelUpload,
    getTrackerData,
    updateTrackerData,
    singleTrackerData ,
    getTemplate,
    updaterequirement,
    deleteRow,
    getProductname,
    deletedItems,
    deletePermanently,
    restoreRecords,
    getDashboardStats,
    getCaseStatusDistribution,
    getRecentActivity,
    sendManualUpdate,
    getCaseDetails,
    getVerificationTrendsData,
    uploadAttachment,
    downloadAttachment ,
    getAttachments,
    deleteAttachment,
    similarRecords,
    batchUpdate,
    uploadSingleAttachment
} = require("../controllers/kyc")


const upload = require("../config/multer")

const router = express.Router();

router.post("/single-upload", singleUpload);
router.post("/bulk-upload", bulkUpload);
// router.post("/excel-upload", upload.single("file"), excelUpload);
router.post('/upload-file', upload.single('file'), uploadFile);
router.post('/extract-data/:fileKey', extractData);
router.post('/process-records/:fileKey', processRecords);
router.post("/update-data", updateTrackerData);
router.post("/recheck", updaterequirement);
router.get("/tracker-data", getTrackerData);
router.get("/single-tracker", singleTrackerData);
router.get("/download-template", getTemplate);
router.get("/getProductname", getProductname);
router.delete("/delete-data", deleteRow);
router.get("/deleted-items", deletedItems);
router.delete('/delete-permanently', deletePermanently);
router.post("/restore-records", restoreRecords);

// router.get('/dashboard/stats', getDashboardStats);
// router.get('/dashboard/trends', getVerificationTrends);
// router.get('/dashboard/distribution', getCaseStatusDistribution);
// router.get('/dashboard/activity', getRecentActivity);
// router.post('/dashboard/refresh', sendManualUpdate);

router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/trends', getVerificationTrendsData);
router.get('/dashboard/distribution', getCaseStatusDistribution);
router.get('/dashboard/activity', getRecentActivity);
router.post('/dashboard/refresh', sendManualUpdate);
router.get('/dashboard/case-details', getCaseDetails);




router.post("/upload-attachment", upload.single("file"), uploadAttachment);
router.post("/upload-single", upload.single("file"), uploadSingleAttachment);
router.get("/attachments", getAttachments);
router.get("/download-attachment/:caseId/:filename", downloadAttachment);
router.delete("/delete-attachment/:caseId/:filename", deleteAttachment);


router.post('/find-similar-records', similarRecords);
router.post('/batch-update', batchUpdate );



module.exports = router;
