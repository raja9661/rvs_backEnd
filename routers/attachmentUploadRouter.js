const express = require('express');
const router = express.Router();

const {
   uploadAttachment,
   verifyFile,
   downloadFile
} = require('../controllers/kyc')

const upload = require("../config/multer")
router.post("/upload-attachment", upload.array("files"), uploadAttachment);
router.post("/verify-file", verifyFile);
router.post("/download-file", downloadFile);

module.exports = router;