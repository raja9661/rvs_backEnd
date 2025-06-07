const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');

const connectdb = require('./config/db');
const socket = require('./config/socket');


const authRouter = require('./routers/authRouter');
const kycRoutes = require('./routers/kycRouter');
const accessManager = require('./routers/ManagementRouter');
const Mapping = require('./routers/mappingRouter');
const LiveDashRoute = require('./routers/dashboardRoutes');
const AboutUs = require('./routers/aboutUsRouter');


dotenv.config();

const app = express();
const server = http.createServer(app);


const io = socket.init(server);


// const allowedOrigins = [
//   'http://localhost:3000',
//   'http://127.0.0.1:3000',
//   'http://localhost:5173',
//   'http://localhost:8080', 
//   'https://www.rvsdoc.com',
//   'http://13.126.216.112:5173',
//   'http://127.0.0.1:8080'
  
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true); //Allow non-browser tools like Postman
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     } else {
//       return callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000', 
  'http://localhost:5173',
  'http://localhost:8080',
  'https://www.rvsdoc.com',
  'http://13.126.216.112:5173',
  'http://127.0.0.1:8080'
];

// Enhanced CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('Request Origin:', origin); // Debug log
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser.json());


// const _dirname = path.resolve();
// const frontendBuildPath = path.join(_dirname, '../client/dist');


// app.use(express.static(frontendBuildPath));


app.use('/api/auth', authRouter);
app.use('/api/kyc', kycRoutes);
app.use('/api/access', accessManager);
app.use('/api/mapping', Mapping);
app.use('/api/dashboard', LiveDashRoute);
app.use('/api/about', AboutUs);



app.get('*', (req, res) => {
  res.send('This is working now.');
});


connectdb();


app.listen(process.env.PORT || 8080, '0.0.0.0', () => {
  console.log("Server running on 0.0.0.0:8080");
});


// const express = require('express')
// const cors = require("cors");
// const dotenv = require("dotenv");
// const http = require("http");
// const bodyParser = require("body-parser");


// // Import database and socket configuration
// const connectdb = require("./config/db");
// const socket = require("./config/socket");

// // Import routes
// const authRouter = require("./routers/authRouter");
// const kycRoutes = require("./routers/kycRouter");
// const accessManager = require("./routers/ManagementRouter");
// // const vendorRouter = require("./routers/vendorRouter");
// const Mapping = require("./routers/mappingRouter")

// // Load environment variables
// dotenv.config();

// // Create Express app and HTTP server
// const app = express();
// const server = http.createServer(app); // Create HTTP server

// // Initialize WebSocket only once
// const io = socket.init(server);

// // Middleware setup
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser.json());

// // Connect to database
// connectdb();

// // Routes
// app.use("/auth", authRouter);
// app.use("/kyc", kycRoutes);
// app.use("/access", accessManager);
// // app.use("/vendor",  vendorRouter);
// app.use("/mapping", Mapping);

// // Start server using `server.listen` instead of `app.listen`
// const port = process.env.PORT || 8080;
// server.listen(port, () => {
//   console.log(`🚀 Server is Running on Port: ${port}`);
// });
