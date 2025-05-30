const multer = require('multer');
const multerS3 = require('multer-s3');
const dotenv = require('dotenv');
const s3 = require('./s3Config'); // Import your S3Client

const path = require('path');
dotenv.config();

// Dynamic folder logic based on route
function chooseFolder(req) {
  if (req.originalUrl.includes('/upload-attachment')) return 'attachments/';
  if (req.originalUrl.includes('/excel-upload')) return 'excels/';
  return '';
}

const upload = multer({
  storage: multerS3({
    s3: s3,             
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const folder = chooseFolder(req);
      const filename = Date.now() + '-' + file.originalname;
      cb(null, `${folder}${filename}`);
    },
  }),
});

module.exports = upload;
