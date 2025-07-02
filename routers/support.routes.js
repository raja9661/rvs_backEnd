const express = require("express");
const router = express.Router();
const supportController = require("../controllers/support.controller");
const upload = require("../config/multer");


router.post("/issues",  upload.array("support"), supportController.createIssue);
router.get("/issues",  supportController.getAllIssues);
router.get("/issues/:id",  supportController.getIssue);
router.delete("/issues/:id",  supportController.deleteIssue);

module.exports = router;