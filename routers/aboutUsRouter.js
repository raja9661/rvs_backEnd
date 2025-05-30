const express = require('express');
const router = express.Router();

const {createUser,
    getAboutFormData
   
} = require('../controllers/AboutUsController')
router.post('/contactus', getAboutFormData)

module.exports = router;