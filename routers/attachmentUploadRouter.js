const express = require('express');
const router = express.Router();

const {
   uploadAttachment
} = require('../controllers/kyc')

const upload = require("../config/multer")
router.post("/upload-attachment", upload.single("file"), uploadAttachment);

module.exports = router;