const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected DB:", mongoose.connection.name); // Should print "rvsdoc"
    console.log("✅ MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    console.log("🔁 Retrying MongoDB connection in 5 seconds...");

    setTimeout(connectDB, 5000); // Retry after 5 seconds (no crash)
  }
};

// Prevent Node process from exiting on unhandled DB-related promise errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});

module.exports = connectDB;






// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// dotenv.config();

// const connectDB = async() => {
//     try {
//         await mongoose.connect(process.env.MONGO_URL,{
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         })
//         console.log("Connected DB:", mongoose.connection.name); // should print "rvsdoc"
//         console.log("✅ MongoDB Connected Successfully!");
//     } catch (error) {
//         console.error("❌ MongoDB Connection Error:", error.message);
//         process.exit(1);
//     }
// }

// module.exports = connectDB