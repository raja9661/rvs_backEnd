// config/s3Config.js
const { S3Client } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@smithy/node-http-handler");
const https = require("https");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      maxSockets: 300,      
      keepAlive: true
    }),
    socketAcquisitionWarningTimeout: 5000,
  }),
});

module.exports = s3;




// // config/s3Config.js
// const { S3Client } = require('@aws-sdk/client-s3');

// const s3 = new S3Client({
//   region: process.env.AWS_REGION, // e.g. "us-east-1"
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// module.exports = s3;
