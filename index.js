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


const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://localhost:8080', 
  'https://www.rvsdoc.com',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); //Allow non-browser tools like Postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());


const _dirname = path.resolve();
const frontendBuildPath = path.join(_dirname, '../client/dist');


app.use(express.static(frontendBuildPath));


app.use('/auth', authRouter);
app.use('/kyc', kycRoutes);
app.use('/access', accessManager);
app.use('/mapping', Mapping);
app.use('/dashboard', LiveDashRoute);
app.use('/about', AboutUs);


app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});


connectdb();


const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`🚀 Server is Running on Port: ${port}`);
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
