const express = require('express');
const router = express.Router();

const {
   uploadAttachment
} = require('../controllers/kyc')

const upload = require("../config/multer")
router.post("/upload-attachment", upload.array("files"), uploadAttachment);

module.exports = router;