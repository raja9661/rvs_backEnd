const KYC = require("../models/kycModel");
const ColumnConfig = require("../models/ColumnPreferences");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const XlsxPopulate = require("xlsx-populate");
const mongoose = require("mongoose"); // Add this import for ObjectId conversion
const moment = require('moment-timezone');
const Fuse = require("fuse.js");
const User = require("../models/users");
const { Product, Vendor, ClientCode,ManageClientCode } = require("../models/MappingItems");
const {EmployeeAccess,ClientAccess} = require("../models/editableColumn");
const editableColumn = require("../models/editableColumn");
const DeletedItems = require("../models/deletedItemsSchema ");
const axios = require("axios");
const upload = require("../config/multer");
const { getIo } = require("../config/socket");
const { GetObjectCommand ,HeadObjectCommand } = require("@aws-sdk/client-s3");
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/s3Config');
const streamToBuffer = require("../utils/streamToBuffer");
const Counter = require("../models/uniqueCaseId"); 
// const ColumnConfig = require("../models/ColumnPreferences");
const { 
  fetchDashboardStats,
  getRecentActivity,
  sendDashboardUpdates,
  getVerificationTrendsData
} = require("../utils/dashboardUpdates");
const { parseCustomDateTime,  formatForFrontend } = require('../utils/dateUtils');


const date = new Date();
const generateCaseId = () => {
  return Math.floor(10000 + Math.random() * 90000); // Generates a 5-digit number
};

const getFormattedDateTime = () => {
  return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
};

const getFormattedDateDay = () => {
  return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, dddd");
};

// const getFormattedDateDay = () => {
//   return moment().format("DD-MM-YYYY, dddd");
// };

// // Function to get Date and Time
// const getFormattedDateTime = () => {
//   const date = new Date();

//   // Get the date in YYYY-MM-DD format
//   const formattedDate = date.toISOString().split("T")[0];

//   // Get the time in HH:MM:SS format
//   const time = date.toLocaleTimeString();

//   return `${formattedDate}, ${time}`;
// };

// // Function to get Date and Day
// const getFormattedDateDay = () => {
//   const date = new Date();

//   // Get the day of the week (e.g., 'Monday', 'Tuesday', etc.)
//   const day = date.toLocaleString("en-US", { weekday: "long" });

//   // Get the date in YYYY-MM-DD format
//   const formattedDate = date.toISOString().split("T")[0];

//   return `${formattedDate}, ${day}`;
// };

function countDigits(accountNumber) {
  return accountNumber.toString().length;
}
let products = [];
let fuse;

const getData = async () => {
  products = await Product.find({}); // Fetch products from the database

  // Initialize Fuse.js after products are fetched
  const fuseOptions = {
    keys: ["productName"], // Field to search (productName)
    threshold: 0.3, // Adjust threshold for fuzzy matching
    includeScore: true, // Include match score in results
  };
  fuse = new Fuse(products, fuseOptions);
};

const findBestMatch = async (productName) => {
  if (!fuse) {
    await getData(); // Ensure products are fetched and fuse is initialized
  }

  const results = fuse.search(productName);

  if (results.length > 0) {
    // Return the best match (first result)
    const bestMatch = results[0].item;
    // console.log(bestMatch.correctUPN);
    return {
      updatedName: bestMatch.updatedProduct,
      upn: bestMatch.correctUPN,
      productType: bestMatch.productType,
      clientCode: bestMatch.clientCode,
      clientType: bestMatch.clientType,
    };
  }

  // If no match is found, return null or default values
  return null;
};

// utils/clientTypeMapper.js

// const getClientType = (clientCode) => {
//   const cleanedCode = clientCode.trim().replace(/\s+/g, "").toUpperCase();

//   const agencyCodes = new Set([
//     "OG",
//     "KM",
//     "PMC",
//     "MT",
//     "TG",
//     "VEN",
//     "SK",
//     "RF",
//     "ALT",
//     "SS",
//     "CCS",
//     "RCA",
//     "UR",
//     "PRA",
//     "GL",
//     "AP",
//     "HF",
//     "CV",
//     "VG",
//     "VG-1",
//     "CCC",
//   ]);

//   const corporateCodes = new Set([
//     "ILC",
//     "PRO",
//     "NTK-2",
//     "NTK-3",
//     "NTK-4",
//     "AC",
//     "HAIER",
//     "ATT",
//   ]);

//   const otherCodes = new Set(["BK", "SATNAM", "DEE", "JAI"]);

//   if (agencyCodes.has(cleanedCode)) return "AGENCY";
//   if (corporateCodes.has(cleanedCode)) return "CORPORATE";
//   if (otherCodes.has(cleanedCode)) return "OTHER";

//   return "UNKNOWN";
// };
const getClientType = async (clientCode) => {
  if (!clientCode) return "UNKNOWN";
  // console.log(clientCode)

  const cleanedCode = clientCode.trim().replace(/\s+/g, "").toUpperCase();
  // console.log(cleanedCode)
  try {
    const record = await ManageClientCode.findOne({ clientCode: cleanedCode });
    // console.log(record)
    if (!record) {
      return "UNKNOWN";
    }

    return record.clientType || "UNKNOWN";
  } catch (error) {
    console.error("Error fetching client type:", error);
    return "UNKNOWN";
  }
};
exports.getProductname = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


let client_user = "";
const getClientCode = async (userId, clientId) => {
  const user = await User.findOne({ userId: clientId });
  if (user) {
    client_user = clientId;
    return user?.clientCode || null;
  } else {
    // Normalize input (trim, uppercase, remove spaces)
    const normalizedInput = clientId?.trim().toUpperCase().replace(/\s+/g, "");

    // Check if it matches any client code directly
    const client = await ClientCode.findOne({
      clientCode: { $in: [normalizedInput] }, 
    });

    return client ? normalizedInput : null;
  }
};

const getIPAddress = (req) => {
  return req.headers["x-forwarded-for"] || req.connection.remoteAddress;
};



const generateRandomAlphanumeric = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateUniqueCaseId = async () => {
  let unique = false;
  let caseId = '';

  while (!unique) {
    caseId = generateRandomAlphanumeric(6);
    const exists = await KYC.findOne({ caseId });
    if (!exists) unique = true;
  }

  return caseId;
};







// Single KYC Upload

function normalizeProductName(name) {
  return name.trim().toUpperCase();
}



exports.singleUpload = async (req, res) => {
  try {
    let { name, product, accountNumber, requirement, userId, clientId,ReferBy } =
      req.body;
      
    let NameUploadBy = "";
    let userclientcode = "";
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }
    if(userId && clientId)
    {
      NameUploadBy = userId
      const user = await User.findOne({ clientCode: clientId });
      
      if(!user){
        return res
        .status(400)
        .json({ success: false, message: `No user is Found with this client code ${clientId}` });
      }else{
        userclientcode = clientId
      }
    }
    if(userId && !clientId){
      NameUploadBy = userId
      const user = await User.findOne({ userId: userId });
      if(!user){
        return res
        .status(400)
        .json({ success: false, message: `No user is Found with this userId ${userId}` });
      }else{
        userclientcode = user.clientCode
      }
    }
    

    // Resolve client code (handles both clientId and clientCode input)
    // let userclientcode = await getClientCode(userId, clientId);


    const currentDate = moment().format("YYYY-MM-DD");

    // Check for duplicate KYC
    const existingKYC = await KYC.findOne({
      accountNumber,
      product,
      requirement,
      clientCode:userclientcode,
      createdAt: {
        $gte: new Date(`${currentDate}T00:00:00Z`),
        $lt: new Date(`${currentDate}T23:59:59Z`),
      },
    });

    if (existingKYC) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Duplicate KYC request for the same day",
        });
    }

    const normalizedProduct = normalizeProductName(product);
    const manualMapping = await Product.findOne({ productName: normalizedProduct });
    let  standardized = ""
    if(manualMapping){
      // console.log("manualMapping:",manualMapping)
      standardized = {
      updatedName: manualMapping.updatedProduct,
      upn: manualMapping.correctUPN,
      productType: manualMapping.productType,
    };
    }else{

    const bestMatch = await findBestMatch(product);
    standardized = bestMatch || {
    updatedName: "Not Mapped",
    upn: "Not Mapped",
    productType: "Not Mapped",
    };

    }

    // Standardize product name
    
    let isduplicate = false
    if(standardized.productType === "ITO"){

    const existingKYCRecords = await KYC.find({ accountNumber, product:normalizedProduct });
    if (existingKYCRecords.length > 0) {
      isduplicate = true
    for (const record of existingKYCRecords) {
    record.isDedup = true;
    await record.save(); 
  }
}
    }

    // Get additional data
    const employees = await ClientCode.find({ clientCode: userclientcode });
    const empName = employees[0]?.EmployeeName || "";
    let customerCare = "";
    if (empName) {
      const employee = await User.findOne({ name: empName });
      customerCare = employee?.phoneNumber || "";
    }
    
    const vendor = await Vendor.findOne({
      productName: standardized.updatedName,
      vendorType: 'default'
   });
    
    const vandorname = vendor?.vendorName || "not found";

    let ipAddress = getIPAddress(req);
            if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
              const ipResponse = await axios.get("https://api64.ipify.org?format=json");
              ipAddress = ipResponse.data.ip; // Get actual public IP
            }
    const uniqueCaseId = await generateUniqueCaseId()
    // Create new KYC record
    const newKYC = new KYC({
      name,
      product,
      accountNumber,
      requirement,
      userId,
      caseId: uniqueCaseId || generateCaseId(),
      dateIn: getFormattedDateTime(),
      dateInDate: getFormattedDateDay(),
      accountNumberDigit: countDigits(accountNumber),
      correctUPN: standardized.upn,
      productType: standardized.productType,
      updatedProductName: standardized.updatedName,
      clientCode: userclientcode,
      listByEmployee: empName,
      clientType: await getClientType(userclientcode),
      vendorName: vandorname,
      // createdAt: getFormattedDateTime(),
      customerCare,
      NameUploadBy,
      ipAddress,
      ReferBy:ReferBy||"",
      year: date.getFullYear().toString(),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      isDedup:isduplicate
    });

    const response = await newKYC.save();

    res.json({
      success: true,
      message: "KYC data saved successfully",
      data: response,
    });
  } catch (error) {
    console.error("Error in singleUpload:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// Bulk KYC Upload (Handsontable)
// exports.bulkUpload = async (req, res) => {
//   try {
//     const { data } = req.body;

//     if (!data || !Array.isArray(data) || data.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or empty data",
//       });
//     }

//     const currentDate = moment().format("YYYY-MM-DD");
//     const results = {
//       inserted: 0,
//       fileDuplicates: 0,
//       dbDuplicates: 0,
//       failed: 0,
//       failedRecords: [],
//     };

//     const fileDuplicateTracker = new Set();
//     const insertDocs = [];
//     const dbKeys = [];
//     const uniqueUserIds = new Set();
//     const userIdClientCodeMap = new Map();
//     const clientCodeSet = new Set();

//     // Preprocess and validate input
//     for (const row of data) {
//       const accountNumber = String(row.accountNumber || "").trim();
//       const product = String(row.product || "").trim();
//       const requirement = String(row.requirement || "").trim();
//       const name = String(row.name || "").trim();
//       const userId = row.userId?.trim();
//       const clientId = row.clientId?.trim();
//       const ReferBy = row.ReferBy?.trim();

//       if (!userId) {
//         return res.status(400).json({ success: false, message: "User ID is required" });
//       }

//       if (!name || !accountNumber || !product || !requirement) {
//         results.failed++;
//         results.failedRecords.push({ ...row, error: "Missing required fields" });
//         continue;
//       }

//       const key = `${accountNumber}-${product}-${requirement}-${clientId || ""}`;
//       if (fileDuplicateTracker.has(key)) {
//         results.fileDuplicates++;
//         continue;
//       }
//       fileDuplicateTracker.add(key);

//       dbKeys.push({ accountNumber, product, requirement, clientCode: clientId });
//       if (userId) uniqueUserIds.add(userId);
//       if (clientId) clientCodeSet.add(clientId);

//       insertDocs.push({
//         original: row,
//         key,
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         clientId,
//         ReferBy,
//       });
//     }

//     // Step 1: Preload Users
//     const users = await User.find({
//       $or: [
//         { userId: { $in: Array.from(uniqueUserIds) } },
//         { clientCode: { $in: Array.from(clientCodeSet) } }
//       ]
//     });
//     users.forEach(user => {
//       if (user.userId) userIdClientCodeMap.set(user.userId, user.clientCode);
//     });

//     // Step 2: Preload same-day existing KYC records
//     const existingRecords = await KYC.find({
//       $or: dbKeys.map(key => ({
//         accountNumber: key.accountNumber,
//         product: key.product,
//         requirement: key.requirement,
//         clientCode: key.clientCode,
//         createdAt: {
//           $gte: new Date(`${currentDate}T00:00:00Z`),
//           $lt: new Date(`${currentDate}T23:59:59Z`),
//         },
//       })),
//     });

//     const existingSet = new Set(
//       existingRecords.map(
//         r => `${r.accountNumber}-${r.product}-${r.requirement}-${r.clientCode}`
//       )
//     );

//     // Step 3: Process Data
//     const bulkInsert = [];

//     for (const item of insertDocs) {
//       const {
//         original,
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         clientId,
//         ReferBy,
//         key,
//       } = item;

//       let userclientcode = "";
//       let NameUploadBy = userId;

//       if (userId && clientId) {
//         const user = users.find(u => u.clientCode === clientId);
//         if (!user) {
//           results.failed++;
//           results.failedRecords.push({ ...original, error: `No user found with client code ${clientId}` });
//           continue;
//         }
//         userclientcode = clientId;
//       } else if (userId && !clientId) {
//         const user = users.find(u => u.userId === userId);
//         if (!user) {
//           results.failed++;
//           results.failedRecords.push({ ...original, error: `No user found with userId ${userId}` });
//           continue;
//         }
//         userclientcode = user.clientCode;
//       }

//       const uniqueKey = `${accountNumber}-${product}-${requirement}-${userclientcode}`;
//       if (existingSet.has(uniqueKey)) {
//         results.dbDuplicates++;
//         continue;
//       }

//       // Standardize product
//     const normalizedProduct = normalizeProductName(product);
//     const manualMapping = await Product.findOne({ productName: normalizedProduct });
//     let  standardized = ""
//     if(manualMapping){
//       standardized = {
//       updatedName: manualMapping.updatedProduct,
//       upn: manualMapping.correctUPN,
//       productType: manualMapping.productType,
//     };
//     }else{

//     const bestMatch = await findBestMatch(product);
//     standardized = bestMatch || {
//     updatedName: product,
//     upn: "",
//     productType: "",
//     };

//     }

//       let isduplicate = false;
//       if (standardized.productType === "ITO") {
//         const existingITO = await KYC.find({
//           accountNumber,
//           product:normalizedProduct,
//         });
//         if (existingITO.length > 0) {
//           isduplicate = true;
//           for (const record of existingITO) {
//             record.isDedup = true;
//             await record.save();
//           }
//         }
//       }

//       const employees = await ClientCode.find({ clientCode: userclientcode });
//       const empName = employees[0]?.EmployeeName || "";
//       let customerCare = "";
//       if (empName) {
//         const employee = await User.findOne({ name: empName });
//         customerCare = employee?.phoneNumber || "";
//       }

//       const vendor = await Vendor.findOne({
//         productName: standardized.updatedName,
//         vendorType: 'default'
//       });
//       const vendorName = vendor?.vendorName || "not found";

//       let ipAddress = getIPAddress(req);
//       if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
//         try {
//           const ipRes = await axios.get("https://api64.ipify.org?format=json");
//           ipAddress = ipRes.data.ip;
//         } catch {
//           ipAddress = "unknown";
//         }
//       }

//       const date = new Date();
//       const uniqueCaseId = await generateUniqueCaseId()

//       bulkInsert.push({
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         caseId: uniqueCaseId || generateCaseId(),
//         dateIn: getFormattedDateTime(),
//         dateInDate: getFormattedDateDay(),
//         accountNumberDigit: countDigits(accountNumber),
//         correctUPN: standardized.upn,
//         productType: standardized.productType,
//         updatedProductName: standardized.updatedName,
//         clientCode: userclientcode,
//         listByEmployee: empName,
//         clientType: await getClientType(userclientcode),
//         vendorName,
//         customerCare,
//         NameUploadBy,
//         ipAddress,
//         ReferBy: ReferBy || "",
//         isDedup: isduplicate,
//         year: date.getFullYear().toString(),
//         month: (date.getMonth() + 1).toString().padStart(2, '0')
//       });
//     }

//     // Step 4: Bulk Insert
//     if (bulkInsert.length > 0) {
//       await KYC.insertMany(bulkInsert);
//       results.inserted = bulkInsert.length;
//     }

//     // Step 5: Final response
//     if (results.inserted === 0 && results.failed === data.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Please check client-code is assigned with active client",
//         details: results,
//       });
//     }

//     res.json({
//       success: true,
//       message: `Processed ${data.length} records`,
//       stats: {
//         totalRecords: data.length,
//         inserted: results.inserted,
//         fileDuplicates: results.fileDuplicates,
//         dbDuplicates: results.dbDuplicates,
//         failed: results.failed,
//         failedRecords: results.failedRecords,
//       },
//     });
//   } catch (error) {
//     console.error("Bulk Upload Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Bulk upload failed",
//       error: error.message,
//     });
//   }
// };
exports.bulkUpload = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty data",
      });
    }

    const currentDate = moment().format("YYYY-MM-DD");
    const results = {
      inserted: 0,
      fileDuplicates: 0,
      dbDuplicates: 0,
      failed: 0,
      failedRecords: [],
    };

    const fileDuplicateTracker = new Set();
    const insertDocs = [];
    const dbKeys = [];
    const uniqueUserIds = new Set();
    const clientCodeSet = new Set();

    // STEP 1: Collect IDs for preloading
    for (const row of data) {
      const userId = row.userId?.trim();
      const clientId = row.clientId?.trim();

      if (userId) uniqueUserIds.add(userId);
      if (clientId) clientCodeSet.add(clientId);
    }

    // STEP 2: Preload Users for mapping
    const users = await User.find({
      $or: [
        { userId: { $in: Array.from(uniqueUserIds) } },
        { clientCode: { $in: Array.from(clientCodeSet) } }
      ]
    });

    // STEP 3: Preprocess rows & build dbKeys
    for (const row of data) {
      const accountNumber = String(row.accountNumber || "").trim();
      const product = String(row.product || "").trim();
      const requirement = String(row.requirement || "").trim();
      const name = String(row.name || "").trim();
      const userId = row.userId?.trim();
      const clientId = row.clientId?.trim();
      const ReferBy = row.ReferBy?.trim();

      if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
      }
      if (!name || !accountNumber || !product || !requirement) {
        results.failed++;
        results.failedRecords.push({ ...row, error: "Missing required fields" });
        continue;
      }

      // Resolve actual clientCode (same logic as singleUpload)
      let resolvedClientCode = "";
      if (userId && clientId) {
        const user = users.find(u => u.clientCode === clientId);
        if (!user) {
          results.failed++;
          results.failedRecords.push({ ...row, error: `No user found with client code ${clientId}` });
          continue;
        }
        resolvedClientCode = clientId;
      } else if (userId && !clientId) {
        const user = users.find(u => u.userId === userId);
        if (!user) {
          results.failed++;
          results.failedRecords.push({ ...row, error: `No user found with userId ${userId}` });
          continue;
        }
        resolvedClientCode = user.clientCode;
      }

      // Check for file-level duplicate
      const fileKey = `${accountNumber}-${product}-${requirement}-${resolvedClientCode}`;
      if (fileDuplicateTracker.has(fileKey)) {
        results.fileDuplicates++;
        continue;
      }
      fileDuplicateTracker.add(fileKey);

      // Add to dbKeys for same-day DB duplicate check
      dbKeys.push({
        accountNumber,
        product,
        requirement,
        clientCode: resolvedClientCode
      });

      insertDocs.push({
        original: row,
        name,
        product,
        accountNumber,
        requirement,
        userId,
        clientCode: resolvedClientCode,
        ReferBy
      });
    }

    // STEP 4: Preload existing same-day KYC records
    const existingRecords = await KYC.find({
      $or: dbKeys.map(key => ({
        accountNumber: key.accountNumber,
        product: key.product,
        requirement: key.requirement,
        clientCode: key.clientCode,
        createdAt: {
          $gte: new Date(`${currentDate}T00:00:00Z`),
          $lt: new Date(`${currentDate}T23:59:59Z`),
        },
      })),
    });

    const existingSet = new Set(
      existingRecords.map(
        r => `${r.accountNumber}-${r.product}-${r.requirement}-${r.clientCode}`
      )
    );

    // STEP 5: Process insertable docs
    const bulkInsert = [];
    for (const item of insertDocs) {
      const { original, name, product, accountNumber, requirement, userId, clientCode, ReferBy } = item;

      const uniqueKey = `${accountNumber}-${product}-${requirement}-${clientCode}`;
      if (existingSet.has(uniqueKey)) {
        results.dbDuplicates++;
        continue;
      }

      // Standardize product
      const normalizedProduct = normalizeProductName(product);
      const manualMapping = await Product.findOne({ productName: normalizedProduct });
      let standardized = {};
      if (manualMapping) {
        standardized = {
          updatedName: manualMapping.updatedProduct,
          upn: manualMapping.correctUPN,
          productType: manualMapping.productType,
        };
      } else {
        const bestMatch = await findBestMatch(product);
        standardized = bestMatch || {
        updatedName: "Not Mapped",
        upn: "Not Mapped",
        productType: "Not Mapped",
        };
      }

      // ITO Dedup
      let isduplicate = false;
      if (standardized.productType === "ITO") {
        const existingITO = await KYC.find({ accountNumber, product: normalizedProduct });
        if (existingITO.length > 0) {
          isduplicate = true;
          for (const record of existingITO) {
            record.isDedup = true;
            await record.save();
          }
        }
      }

      // Employee / Customer care
      const employees = await ClientCode.find({ clientCode });
      const empName = employees[0]?.EmployeeName || "";
      let customerCare = "";
      if (empName) {
        const employee = await User.findOne({ name: empName });
        customerCare = employee?.phoneNumber || "";
      }

      // Vendor
      const vendor = await Vendor.findOne({
        productName: standardized.updatedName,
        vendorType: 'default'
      });
      const vendorName = vendor?.vendorName || "not found";

      // IP address
      let ipAddress = getIPAddress(req);
      if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
        try {
          const ipRes = await axios.get("https://api64.ipify.org?format=json");
          ipAddress = ipRes.data.ip;
        } catch {
          ipAddress = "unknown";
        }
      }

      const date = new Date();
      const uniqueCaseId = await generateUniqueCaseId();

      bulkInsert.push({
        name,
        product,
        accountNumber,
        requirement,
        userId,
        caseId: uniqueCaseId || generateCaseId(),
        dateIn: getFormattedDateTime(),
        dateInDate: getFormattedDateDay(),
        accountNumberDigit: countDigits(accountNumber),
        correctUPN: standardized.upn,
        productType: standardized.productType,
        updatedProductName: standardized.updatedName,
        clientCode,
        listByEmployee: empName,
        clientType: await getClientType(clientCode),
        vendorName,
        customerCare,
        NameUploadBy: userId,
        ipAddress,
        ReferBy: ReferBy || "",
        isDedup: isduplicate,
        year: date.getFullYear().toString(),
        month: (date.getMonth() + 1).toString().padStart(2, '0')
      });
    }

    // STEP 6: Bulk insert
    if (bulkInsert.length > 0) {
      await KYC.insertMany(bulkInsert);
      results.inserted = bulkInsert.length;
    }

    // STEP 7: Response
    if (results.inserted === 0 && results.failed === data.length) {
      return res.status(400).json({
        success: false,
        message: "Please check client-code is assigned with active client",
        details: results,
      });
    }

    res.json({
      success: true,
      message: `Processed ${data.length} records`,
      stats: {
        totalRecords: data.length,
        inserted: results.inserted,
        fileDuplicates: results.fileDuplicates,
        dbDuplicates: results.dbDuplicates,
        failed: results.failed,
        failedRecords: results.failedRecords,
      },
    });
  } catch (error) {
    console.error("Bulk Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: error.message,
    });
  }
};


// exports.bulkUpload = async (req, res) => {
//   try {
//     const { data } = req.body;

//     if (!data || !Array.isArray(data) || data.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or empty data",
//       });
//     }

//     const currentDate = moment().format("YYYY-MM-DD");
//     const results = {
//       inserted: 0,
//       fileDuplicates: 0,
//       dbDuplicates: 0,
//       failed: 0,
//       failedRecords: [],
//     };

//     const fileDuplicateTracker = new Set();
//     const insertDocs = [];
//     const dbKeys = [];
//     const uniqueUserIds = new Set();
//     const userIdClientCodeMap = new Map();
//     let ReferBy = "";

//     // Collect required data for bulk processing
//     for (const row of data) {
//       const accountNumber = String(row.accountNumber || "").trim();
//       const product = String(row.product || "").trim();
//       const requirement = String(row.requirement || "").trim();
//       const name = String(row.name || "").trim();
//       const userId = row.userId?.trim();
//       const clientId = row.clientId?.trim();
//       ReferBy = row.ReferBy?.trim();

//       if (!userId) {
//         return res.status(400).json({ success: false, message: "User ID is required" });
//       }

//       if (!name || !accountNumber || !product || !requirement) {
//         results.failed++;
//         results.failedRecords.push({ ...row, error: "Missing required fields" });
//         continue;
//       }

//       const key = `${accountNumber}-${product}-${requirement}`;
//       if (fileDuplicateTracker.has(key)) {
//         results.fileDuplicates++;
//         continue;
//       }
//       fileDuplicateTracker.add(key);

//       dbKeys.push({ accountNumber, product, requirement });
//       uniqueUserIds.add(userId);

//       insertDocs.push({
//         original: row,
//         key,
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         clientId,
//       });
//     }

//     // 🔄 Step 1: Preload User Info
//     const users = await User.find({ 
//       $or: [
//         { userId: { $in: Array.from(uniqueUserIds) } },
//         { clientCode: { $in: data.map(d => d.clientId).filter(Boolean) } }
//       ]
//     });
    
//     users.forEach(user => {
//       if (user.userId) {
//         userIdClientCodeMap.set(user.userId, user.clientCode);
//       }
//     });

//     // 🔄 Step 2: Preload Existing DB Records (same-day duplicates)
//     const existingRecords = await KYC.find({
//       $or: dbKeys.map(key => ({
//         accountNumber: key.accountNumber,
//         product: key.product,
//         requirement: key.requirement,
//         createdAt: {
//           $gte: new Date(`${currentDate}T00:00:00Z`),
//           $lt: new Date(`${currentDate}T23:59:59Z`),
//         },
//       })),
//     });

//     const existingSet = new Set(
//       existingRecords.map(r => `${r.accountNumber}-${r.product}-${r.requirement}`)
//     );

//     // 🔄 Step 3: Process Data & Prepare for Bulk Insert
//     const bulkInsert = [];

//     for (const item of insertDocs) {
//       const {
//         original,
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         clientId,
//         key,
//       } = item;

//       // Skip if exists in DB
//       if (existingSet.has(key)) {
//         results.dbDuplicates++;
//         continue;
//       }

//       let userclientcode = "";
//       let NameUploadBy = userId;

//       // Determine client code based on your new logic
//       if (userId && clientId) {
//         const user = users.find(u => u.clientCode === clientId);
//         if (!user) {
//           results.failed++;
//           results.failedRecords.push({ 
//             ...original, 
//             error: `No user found with client code ${clientId}` 
//           });
//           continue;
//         }
//         userclientcode = clientId;
//       } else if (userId && !clientId) {
//         const user = users.find(u => u.userId === userId);
//         if (!user) {
//           results.failed++;
//           results.failedRecords.push({ 
//             ...original, 
//             error: `No user found with userId ${userId}` 
//           });
//           continue;
//         }
//         userclientcode = user.clientCode;
//       }

//       if (!userclientcode) {
//         results.failed++;
//         results.failedRecords.push({ 
//           ...original, 
//           error: "Client code could not be determined" 
//         });
//         continue;
//       }

//       // Standardize product name
//       const bestMatch = await findBestMatch(product);
//       const standardized = bestMatch || {
//         updatedName: product,
//         upn: "",
//         productType: "",
//       };

//       let isduplicate = false
//     if(standardized.productType === "ITO"){

//     const existingKYCRecords = await KYC.find({ accountNumber, updatedProductName:standardized.updatedName });
//     if (existingKYCRecords.length > 0) {
//       isduplicate = true
//     for (const record of existingKYCRecords) {
//     record.isDedup = true;
//     await record.save(); 
//   }
// }
//     }

//       // Get additional data
//       const employees = await ClientCode.find({ clientCode: userclientcode });
//       const empName = employees[0]?.EmployeeName || "";
//       let customerCare = "";
//       if (empName) {
//         const employee = await User.findOne({ name: empName });
//         customerCare = employee?.phoneNumber || "";
//       }
      
//       const vendor = await Vendor.findOne({
//       productName: standardized.updatedName,
//       vendorType: 'default'
//    });
    
//     const vandorname = vendor?.vendorName || "not found";

//       let ipAddress = getIPAddress(req);
//       if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
//         try {
//           const ipRes = await axios.get("https://api64.ipify.org?format=json");
//           ipAddress = ipRes.data.ip;
//         } catch (err) {
//           ipAddress = "unknown";
//         }
//       }

//       bulkInsert.push({
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         caseId: generateCaseId(),
//         dateIn: getFormattedDateTime(),
//         dateInDate: getFormattedDateDay(),
//         accountNumberDigit: countDigits(accountNumber),
//         correctUPN: standardized.upn,
//         productType: standardized.productType,
//         updatedProductName: standardized.updatedName,
//         clientCode: userclientcode,
//         listByEmployee: empName,
//         clientType: await getClientType(userclientcode),
//         vendorName: vandorname,
//         customerCare,
//         NameUploadBy,
//         ipAddress,
//         ReferBy:ReferBy || "",
//         isDedup:isduplicate,
        
//         year: new Date().getFullYear().toString(),
//         month: (new Date().getMonth() + 1).toString().padStart(2, '0')
//       });
//     }

//     // 🔄 Step 4: Bulk Insert
//     if (bulkInsert.length > 0) {
//       await KYC.insertMany(bulkInsert);
//       results.inserted = bulkInsert.length;
//     }

//     // 🔄 Step 5: Final Response
//     if (results.inserted === 0 && results.failed === data.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Plese check client-code is assign with active client  ",
//         details: results, 
//       });
//     }

//     res.json({
//       success: true,
//       message: `Processed ${data.length} records`,
//       stats: {
//         totalRecords: data.length,
//         inserted: results.inserted,
//         fileDuplicates: results.fileDuplicates,
//         dbDuplicates: results.dbDuplicates,
//         failed: results.failed,
//         failedRecords: results.failedRecords,
//       },
//     });
//   } catch (error) {
//     console.error("Bulk Upload Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Bulk upload failed",
//       error: error.message,
//     });
//   }
// };




// Excel File Upload
////////////////////////*********************/////////////////////////////////
const getS3FileBuffer = async (bucket, key) => {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const data = await s3.send(command); // `s3` is your S3Client instance
        return streamToBuffer(data.Body);
      };
// Step 1: Upload file to S3
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { userId, clientId } = req.body;
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }

    // console.log("file key:",req.file.key)
    res.json({
      success: true,
      message: "File uploaded successfully",
      fileKey: req.file.key,
      nextStep: `${process.env.BACKEND_URL}/kyc/extract-data/${req.file.key}`
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: "File upload failed" });
  }
};

// Step 2: Extract data and store IP
exports.extractData = async (req, res) => {
  try {
    const { fileKey } = req.params;
    const { userId, clientId , ReferBy } = req.body;

    // Get IP address
    let ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
      const ipResponse = await axios.get("https://api64.ipify.org?format=json");
      ipAddress = ipResponse.data.ip;
    }

    // Get file from S3
    const fileBuffer = await getS3FileBuffer(process.env.AWS_BUCKET_NAME, fileKey);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Store extracted data temporarily (could use memory or temp S3 file)
    // In this example, we'll just return the count and proceed to next step
    res.json({
      success: true,
      message: "Data extracted successfully",
      recordCount: jsonData.length,
      ipAddress,
      nextStep: `${process.env.BACKEND_URL}/kyc/process-records/${fileKey}`,
      data: jsonData.slice(0, 5) // Sample of first 5 records for verification
    });
  } catch (error) {
    console.error("Extraction error:", error);
    res.status(500).json({ success: false, message: "Data extraction failed" });
  }
};

exports.processRecords = async (req, res) => {
  try {
    const { fileKey } = req.params;
    const { userId, clientId, ipAddress,ReferBy } = req.body;
    // console.log("ReferBy",ReferBy)

    // Validate userId
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Get file from S3 again
    const fileBuffer = await getS3FileBuffer(process.env.AWS_BUCKET_NAME, fileKey);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const currentDate = moment().format("YYYY-MM-DD");
    
    // Process records in smaller chunks
    const batchSize = 50;
    const results = {
      total:0,
      inserted: 0,
      duplicates: 0,
      failed: 0,
      failedRecords: []
    };

    // First validate client code
    let userclientcode = "";
    if (userId && clientId) {
      const user = await User.findOne({ clientCode: clientId });
      if (!user) {
        return res.status(400).json({ 
          success: false, 
          message: `No user found with client code ${clientId}` 
        });
      }
      userclientcode = clientId;
    } else if (userId && !clientId) {
      const user = await User.findOne({ userId: userId });
      if (!user) {
        return res.status(400).json({ 
          success: false, 
          message: `No user found with userId ${userId}` 
        });
      }
      userclientcode = user.clientCode;
    }

    results.total = jsonData.length
    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const batchResults = await processBatch(
        batch, 
        userId, 
        userclientcode, 
        ipAddress, 
        currentDate,
        ReferBy,
        userclientcode
      );
      
      results.inserted += batchResults.inserted;
      results.duplicates += batchResults.duplicates;
      results.failed += batchResults.failed;
      results.failedRecords.push(...batchResults.failedRecords);
    }

    res.json({
      success: true,
      message: "Records processed successfully",
      results
    });
  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).json({ success: false, message: "Record processing failed" });
  }
};

async function processBatch(batch, userId, userclientcode, ipAddress, currentDate,ReferBy,userclientcode) {
  const results = {
    inserted: 0,
    duplicates: 0,
    failed: 0,
    failedRecords: []
  };

  // Get employee details once per batch
  const employees = await ClientCode.find({ clientCode: userclientcode });
  const empName = employees[0]?.EmployeeName || "";
  let customerCare = "";
  if (empName) {
    const employee = await User.findOne({ name: empName });
    customerCare = employee?.phoneNumber || "";
  }

  // Process each record
  for (const row of batch) {
    try {
      const name = String(row["Name"] || "").trim();
      const accountNumber = String(row["Account Number"] || "").trim();
      const product = String(row["Product"] || "").trim();
      const requirement = String(row["Requirement"] || "").trim();

      // Validate required fields
      if (!name || !accountNumber || !product || requirement === "") {
        results.failed++;
        results.failedRecords.push({
          row,
          error: "Missing required fields"
        });
        continue;
      }

      // Check for existing records in DB
      const exists = await KYC.findOne({
        accountNumber,
        product,
        requirement,
        clientCode:userclientcode,
        createdAt: {
          $gte: new Date(`${currentDate}T00:00:00Z`),
          $lt: new Date(`${currentDate}T23:59:59Z`),
        }
      });

      if (exists) {
        results.duplicates++;
        continue;
      }

      // Standardize product name
    const normalizedProduct = normalizeProductName(product);
    const manualMapping = await Product.findOne({ productName: normalizedProduct });
    let  standardized = ""
    if(manualMapping){
      // console.log("manualMapping",manualMapping)
      standardized = {
      updatedName: manualMapping.updatedProduct,
      upn: manualMapping.correctUPN,
      productType: manualMapping.productType,
    };
    }else{

    const bestMatch = await findBestMatch(product);
    standardized = bestMatch || {
     updatedName: "Not Mapped",
     upn: "Not Mapped",
     productType: "Not Mapped",
    };

    }

      let isduplicate = false
    if(standardized.productType === "ITO"){

    const existingKYCRecords = await KYC.find({ accountNumber, product:normalizedProduct });
    if (existingKYCRecords.length > 0) {
      isduplicate = true
    for (const record of existingKYCRecords) {
    record.isDedup = true;
    await record.save(); 
  }
}
    }

      // Get vendor
      const vendor = await Vendor.findOne({
      productName: standardized.updatedName,
      vendorType: 'default'
   });
    
    const vandorname = vendor?.vendorName || "not found";
    const uniqueCaseId = await generateUniqueCaseId()

      // Create new record
      await KYC.create({
        name,
        product,
        accountNumber,
        requirement,
        userId,
        caseId: uniqueCaseId || generateCaseId(),
        dateIn: getFormattedDateTime(),
        dateInDate: getFormattedDateDay(),
        accountNumberDigit: countDigits(accountNumber),
        correctUPN: standardized.upn,
        productType: standardized.productType,
        updatedProductName: standardized.updatedName,
        clientCode: userclientcode,
        listByEmployee: empName,
        clientType: await getClientType(userclientcode),
        vendorName: vandorname,
        createdAt: currentDate,
        customerCare,
        NameUploadBy: userId,
        ipAddress,
        ReferBy:ReferBy || "",
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
        isDedup:isduplicate
      });

      results.inserted++;
    } catch (error) {
      console.error("Error processing row:", error);
      results.failed++;
      results.failedRecords.push({
        row,
        error: error.message
      });
    }
  }

  return results;
}

// Step 3: Process records
// exports.processRecords = async (req, res) => {
//   try {
//     const { fileKey } = req.params;
//     const { userId, clientId, ipAddress } = req.body;

//     // Get file from S3 again (or could pass data from previous step)
//     const fileBuffer = await getS3FileBuffer(process.env.AWS_BUCKET_NAME, fileKey);
//     const workbook = XLSX.read(fileBuffer, { type: "buffer" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    
//     const currentDate = moment().format("YYYY-MM-DD");
    
//     // Process records in smaller chunks
//     const batchSize = 50;
//     const results = {
//       inserted: 0,
//       duplicates: 0,
//       failed: 0,
//       failedRecords: []
//     };

//     for (let i = 0; i < jsonData.length; i += batchSize) {
//       const batch = jsonData.slice(i, i + batchSize);
//       const batchResults = await processBatch(batch, userId, clientId, ipAddress, currentDate,res);
      
//       results.inserted += batchResults.inserted;
//       results.duplicates += batchResults.duplicates;
//       results.failed += batchResults.failed;
//       results.failedRecords.push(...batchResults.failedRecords);
//     }

//     res.json({
//       success: true,
//       message: "Records processed successfully",
//       results
//     });
//   } catch (error) {
//     console.error("Processing error:", error);
//     res.status(500).json({ success: false, message: "Record processing failed" });
//   }
// };

// async function processBatch(batch, userId, clientId, ipAddress, currentDate,res) {
//   const results = {
//     inserted: 0,
//     duplicates: 0,
//     failed: 0,
//     failedRecords: []
//   };

//   // Get client code once per batch
//     let NameUploadBy = "";
//     let userclientcode = "";
//     if (!userId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "User ID is required" });
//     }
//     if(userId && clientId)
//     {
//       NameUploadBy = userId
//       const user = await User.findOne({ clientCode: clientId });
      
//       if(!user){
//         return res
//         .status(400)
//         .json({ success: false, message: `No user is Found with this client code ${clientId}` });
//       }else{
//         userclientcode = clientId
//       }
//     }
//     if(userId && !clientId){
//       NameUploadBy = userId
//       const user = await User.findOne({ userId: userId });
//       if(!user){
//         return res
//         .status(400)
//         .json({ success: false, message: `No user is Found with this userId ${userId}` });
//       }else{
//         userclientcode = user.clientCode
//       }
//     }

//   // Get employee details once per batch
//   const employees = await ClientCode.find({ clientCode: userclientcode });
//   const empName = employees[0]?.EmployeeName || "";
//   let customerCare = "";
//   if (empName) {
//     const employee = await User.findOne({ name: empName });
//     customerCare = employee?.phoneNumber || "";
//   }

//   // Process each record
//   for (const row of batch) {
//     try {
//       const name = String(row["Name"] || "").trim();
//       const accountNumber = String(row["Account Number"] || "").trim();
//       const product = String(row["Product"] || "").trim();
//       const requirement = String(row["Requirement"] || "").trim();

//       // Validate required fields
//       if (!name || !accountNumber || !product || requirement === "") {
//         results.failed++;
//         results.failedRecords.push({
//           row,
//           error: "Missing required fields"
//         });
//         continue;
//       }

//       // Check for existing records in DB
//       const exists = await KYC.findOne({
//         accountNumber,
//         product,
//         requirement,
//         createdAt: {
//           $gte: new Date(`${currentDate}T00:00:00Z`),
//           $lt: new Date(`${currentDate}T23:59:59Z`),
//         }
//       });

//       if (exists) {
//         results.duplicates++;
//         continue;
//       }

//       // Standardize product name
//       const bestMatch = await findBestMatch(product);
//       const standardized = bestMatch || {
//         updatedName: product,
//         upn: "",
//         productType: "",
//       };

//       // Get vendor
//       const vendor = await Vendor.findOne({ productName: standardized.updatedName });
//       const vandorname = vendor?.vendorName || "not found";

//       // Create new record
//       await KYC.create({
//         name,
//         product,
//         accountNumber,
//         requirement,
//         userId,
//         caseId: generateCaseId(),
//         dateIn: getFormattedDateTime(),
//         dateInDate: getFormattedDateDay(),
//         accountNumberDigit: countDigits(accountNumber),
//         correctUPN: standardized.upn,
//         productType: standardized.productType,
//         updatedProductName: standardized.updatedName,
//         clientCode: userclientcode,
//         listByEmployee: empName,
//         clientType: await getClientType(userclientcode),
//         vendorName: vandorname,
//         createdAt: currentDate,
//         customerCare,
//         NameUploadBy,
//         ipAddress,
//         year: date.getFullYear().toString(),
//         month: (date.getMonth() + 1).toString().padStart(2, '0')
//       });

//       results.inserted++;
//     } catch (error) {
//       console.error("Error processing row:", error);
//       results.failed++;
//       results.failedRecords.push({
//         row,
//         error: error.message
//       });
//     }
//   }

//   return results;
// }



// exports.excelUpload = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No file uploaded",
//       });
//     }

//     const getS3FileBuffer = async (bucket, key) => {
//       const command = new GetObjectCommand({ Bucket: bucket, Key: key });
//       const data = await s3.send(command); // `s3` is your S3Client instance
//       return streamToBuffer(data.Body);
//     };
    
   
//     let { userId, clientId } = req.body;

//     let NameUploadBy = "";
//     if (!userId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "User ID is required" });
//     } else {
//       const userName = await User.findOne({ userId });
//       NameUploadBy = userName?.name || "";
//     }

//     const currentDate = moment().format("YYYY-MM-DD");

//     // Read Excel file
//     // const fileBuffer = fs.readFileSync(filePath);
//     const fileBuffer = await getS3FileBuffer(process.env.AWS_BUCKET_NAME, req.file.key);
//     const workbook = XLSX.read(fileBuffer, { type: "buffer" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];

//     if (!sheet) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid file format",
//       });
//     }
    

//     // Process data
//     const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
//     const results = {
//       inserted: 0,
//       fileDuplicates: 0,
//       dbDuplicates: 0,
//       failed: 0,
//       failedRecords: [],
//     };

//     const fileDuplicateTracker = new Set();

//     for (const row of jsonData) {
//       try {
//         const name = String(row["Name"] || "").trim();
//         const accountNumber = String(row["Account Number"] || "").trim();
//         const product = String(row["Product"] || "").trim();
//         const requirement = String(row["Requirement"] || "").trim();

//         // Validate required fields
//         if (!name || !accountNumber || !product || requirement === "") {
//           results.failed++;
//           results.failedRecords.push({
//             ...row,
//             error: "Missing required fields",
//           });
//           continue;
//         }

//         // Check for duplicates in the same file
//         const fileKey = `${product}-${requirement}-${accountNumber}`;
//         if (fileDuplicateTracker.has(fileKey)) {
//           results.fileDuplicates++;
//           continue;
//         }
//         fileDuplicateTracker.add(fileKey);

//         // Standardize product name
//         const bestMatch = await findBestMatch(product);
//         const standardized = bestMatch || {
//           updatedName: product,
//           upn: "",
//           productType: "",
//         };

//         // Get client code
//         // Get client code
//         // Resolve client code (handles both clientId and clientCode input)
//         let userclientcode = await getClientCode(userId, clientId);
//         if (!userclientcode && clientId) {
//           return res
//             .status(400)
//             .json({ success: false, message: "Invalid Client ID/Code" });
//         }
//         if (!clientId) {
//           let new_clientcode = await User.findOne({ userId });
//           userclientcode = new_clientcode.clientCode;
//         }
//         if (!userclientcode) {
//           results.failed++;
//           results.failedRecords.push({
//             ...row,
//             error: "Client code not found",
//           });
//           continue;
//         }

//         // Get additional data
//         const employees = await ClientCode.find({ clientCode: userclientcode });
//         const empName = employees[0]?.EmployeeName || "";
//         let customerCare = "";
//         if (empName) {
//           const employee = await User.findOne({ name: empName });
//           customerCare = employee?.phoneNumber || "";
//         }
//         const vendor = await Vendor.find({
//           productName: standardized.updatedName,
//         });
//         const vandorname = vendor[0]?.vendorName || "not found";

//         if (client_user) {
//           userId = client_user;
//         }

//         let ipAddress = getIPAddress(req);
//             if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
//               const ipResponse = await axios.get("https://api64.ipify.org?format=json");
//               ipAddress = ipResponse.data.ip; // Get actual public IP
//             }

//         // Check for existing records in DB
//         const existsInDB = await KYC.findOne({
//           accountNumber,
//           product,
//           requirement,
//           createdAt: {
//             $gte: new Date(`${currentDate}T00:00:00Z`),
//             $lt: new Date(`${currentDate}T23:59:59Z`),
//           },
//         });

//         if (existsInDB) {
//           results.dbDuplicates++;
//           continue;
//         }

//         // Create new record
//         await KYC.create({
//           name,
//           product,
//           accountNumber,
//           requirement,
//           userId,
//           caseId: generateCaseId(),
//           dateIn: getFormattedDateTime(),
//           dateInDate: getFormattedDateDay(),
//           accountNumberDigit: countDigits(accountNumber),
//           correctUPN: standardized.upn,
//           productType: standardized.productType,
//           updatedProductName: standardized.updatedName,
//           clientCode: userclientcode,
//           listByEmployee: empName,
//           clientType: getClientType(userclientcode),
//           vendorName: vandorname,
//           createdAt: currentDate,
//           customerCare,
//           NameUploadBy,
//           ipAddress
//         });

//         results.inserted++;
//       } catch (error) {
//         console.error("Error processing row:", error);
//         results.failed++;
//         results.failedRecords.push({
//           ...row,
//           error: error.message,
//         });
//       }
//     }


//     if (results.inserted === 0 && results.failed === jsonData.length) {
//       return res.status(400).json({
//         success: false,
//         message: "No valid data found in the file",
//         details: results,
//       });
//     }
//     res.json({
//       success: true,
//       message: `Processed ${jsonData.length} records`,
//       stats: {
//         totalRecords: jsonData.length,
//         inserted: results.inserted,
//         fileDuplicates: results.fileDuplicates,
//         dbDuplicates: results.dbDuplicates,
//         failed: results.failed,
//         failedRecords: results.failedRecords,
//       },
//     });
//     // res.json({
//     //   success: true,
//     //   message: `Processed ${jsonData.length} records`,
//     //   ...results
//     // });
//   } catch (error) {
//     console.error("Excel upload failed:", error);
//     if (req.file?.path) {
//       fs.unlinkSync(req.file.path);
//     }
//     res.status(500).json({
//       success: false,
//       message: "Excel upload failed",
//       error: error.message,
//     });
//   }
// };

//////////////////////***************************////////////////////////////////
// Helper function to order fields
// function orderFields(document, fieldOrder) {
//   if (!document) return document;
  
//   const orderedDoc = {};
//   const doc = document.toObject ? document.toObject() : document;

//   // Add fields in specified order
//   fieldOrder.forEach(field => {
//     if (doc[field] !== undefined) {
//       orderedDoc[field] = doc[field];
//     }
//   });

//   // Add any remaining fields not in the order list
//   Object.keys(doc).forEach(field => {
//     if (!orderedDoc[field] && !fieldOrder.includes(field)) {
//       orderedDoc[field] = doc[field];
//     }
//   });

//   return orderedDoc;
// }
// controllers/trackerController.js

// Helper function to order fields
function orderFields(document, fieldOrder) {
  if (!document) return document;
  
  const orderedDoc = {};
  const doc = document.toObject ? document.toObject() : document;

  fieldOrder.forEach(field => {
    if (doc[field] !== undefined) {
      orderedDoc[field] = doc[field];
    }
  });

  Object.keys(doc).forEach(field => {
    if (!orderedDoc[field] && !fieldOrder.includes(field)) {
      orderedDoc[field] = doc[field];
    }
  });

  return orderedDoc;
}

// Get all available columns (for admin configuration)
exports.getAvailableColumns = async (req, res) => {
  try {
    // Get all fields from schema except internal ones
    const schemaFields = Object.keys(KYC.schema.paths).filter(
      field => !['_id', '__v', 'createdAt', 'updatedAt'].includes(field)
    );
    
    res.json({ 
      success: true, 
      columns: schemaFields 
    });
  } catch (error) {
    console.error("Error fetching available columns:", error);
    res.status(500).json({ success: false, message: "Failed to fetch columns" });
  }
};

// Get column configuration for a role
exports.getColumnConfig = async (req, res) => {
  try {
    const { role } = req.params;
    
    const config = await ColumnConfig.findOne({ role });
    
    if (!config) {
      // Return default order if no config exists
      const schemaFields = Object.keys(KYC.schema.paths).filter(
        field => !['_id', '__v', 'createdAt', 'updatedAt'].includes(field)
      );
      return res.json({ 
        success: true, 
        config: { 
          role, 
          columnOrder: schemaFields 
        } 
      });
    }
    
    res.json({ success: true, config });
  } catch (error) {
    console.error("Error fetching column config:", error);
    res.status(500).json({ success: false, message: "Failed to fetch config" });
  }
};

// Update column configuration
exports.updateColumnConfig = async (req, res) => {
  try {
    const { role } = req.params;
    const { columnOrder } = req.body;
    
    if (!Array.isArray(columnOrder)) {
      return res.status(400).json({ 
        success: false, 
        message: "columnOrder must be an array" 
      });
    }
    
    const config = await ColumnConfig.findOneAndUpdate(
      { role },
      { columnOrder, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
    
    res.json({ success: true, config });
  } catch (error) {
    console.error("Error updating column config:", error);
    res.status(500).json({ success: false, message: "Failed to update config" });
  }
};

// Updated getTrackerData function using column config
exports.getTrackerData = async (req, res) => {
  try {
    const { 
      role, 
      userId, 
      name, 
      page = 1, 
      pageSize = 50,
      searchQuery = "",
      // Filter parameters
      product,
      productType,
      status,
      caseStatus,
      dateInStart,
      dateInEnd,
      dateOutStart,
      dateOutEnd,
      sentDate,
      vendorStatus,
      priority,
      clientType,
      clientCode,
       ...filters
    } = req.query;
    
    const skip = (page - 1) * pageSize;

    // In your server endpoint, before the query


// After building the query
    
    // Get column order for this role
    const config = await ColumnConfig.findOne({ role });
    let columnOrder = config?.columnOrder;
    
    if (!columnOrder) {
      // Fallback to all fields if no config exists
      columnOrder = Object.keys(KYC.schema.paths).filter(
        field => !['_id', '__v', 'createdAt','userId', 'updatedAt'].includes(field)
      );
    }
    
    // Build projection based on column order
    const projection = {};
    columnOrder.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 0;
    
    let query = {};
    
    // Search functionality
    if (searchQuery) {
  const regex = { $regex: searchQuery, $options: "i" };

  query.$or = [
    { caseId: regex },
    { userId: regex },
    { remarks: regex },
    { name: regex },
    { details: regex },
    { details1: regex },
    { priority: regex },
    { correctUPN: regex },
    { product: regex },
    { updatedProductName: regex },
    { accountNumber: regex },
    { requirement: regex },
    { updatedRequirement: regex },
    { accountNumberDigit: regex },
    { bankCode: regex },
    { clientCode: regex },
    { vendorName: regex },
    { dateIn: regex },
    { dateInDate: regex },
    { status: regex },
    { caseStatus: regex },
    { productType: regex },
    { listByEmployee: regex },
    { dateOut: regex },
    { dateOutInDay: regex },
    { sentBy: regex },
    { autoOrManual: regex },
    { caseDoneBy: regex },
    { clientTAT: regex },
    { customerCare: regex },
    { sentDate: regex },
    { sentDateInDay: regex },
    { clientType: regex },
    { dedupBy: regex },
    { vendorRate: regex },
    { clientRate: regex },
    { NameUploadBy: regex },
    { ReferBy: regex },
    { ipAddress: regex },
    { vendorStatus: regex },
    { year: regex },
    { month: regex },
    { role: regex },
    { "attachments.filename": regex },
    { "attachments.originalname": regex },
    { "attachments.key": regex }
  ];
}

    
    // Apply filters
    if (product) query.product = product;
    if (productType) query.productType = productType;
    if (status) query.status = status;
    if (caseStatus) query.caseStatus = caseStatus;
    if (vendorStatus) query.vendorStatus = vendorStatus;
    if (priority) query.priority = priority;
    if (clientCode) query.clientCode = clientCode;
    if (clientType) query.clientType = clientType;

// Enhanced date filtering with debugging
 if (dateInStart || dateInEnd) {
      if (dateInStart && dateInEnd) {
        // RANGE QUERY - handle as string comparison
        const startDate = moment(dateInStart, "DD-MM-YYYY").format("DD-MM-YYYY");
        const endDate = moment(dateInEnd, "DD-MM-YYYY").format("DD-MM-YYYY");
        
        if (startDate === endDate) {
          // Single day
          query.dateIn = { $regex: `^${startDate}` };
        } else {
          // Date range - compare as strings
          query.$and = [
            { 
              dateIn: { 
                $gte: `${startDate}, 00:00:00 AM`,
                $lte: `${endDate}, 11:59:59 PM`
              }
            }
          ];
        }
      }
      else if (dateInStart) {
        // Single start date
        const dateStr = moment(dateInStart, "DD-MM-YYYY").format("DD-MM-YYYY");
        query.dateIn = { $regex: `^${dateStr}` };
      }
      else if (dateInEnd) {
        // Single end date
        const dateStr = moment(dateInEnd, "DD-MM-YYYY").format("DD-MM-YYYY");
        query.dateIn = { $lte: `${dateStr}, 11:59:59 PM` };
      }
    }

    // DATE OUT FILTER (same logic)
    if (dateOutStart || dateOutEnd) {
  // Initialize dateOut filter object
  const dateOutFilter = {};
  
  // Format dates consistently
  const startDateStr = dateOutStart ? moment(dateOutStart, "DD-MM-YYYY").format("DD-MM-YYYY") : null;
  const endDateStr = dateOutEnd ? moment(dateOutEnd, "DD-MM-YYYY").format("DD-MM-YYYY") : null;

  // Case 1: Both start and end dates provided
  if (startDateStr && endDateStr) {
    if (startDateStr === endDateStr) {
      // Single day match - use regex for exact day
      dateOutFilter.$regex = `^${startDateStr}`;
    } else {
      // Date range - use string comparison
      dateOutFilter.$gte = `${startDateStr}, 00:00:00 AM`;
      dateOutFilter.$lte = `${endDateStr}, 11:59:59 PM`;
    }
  }
  // Case 2: Only start date provided
  else if (startDateStr) {
    dateOutFilter.$regex = `^${startDateStr}`;
  }
  // Case 3: Only end date provided
  else if (endDateStr) {
    dateOutFilter.$lte = `${endDateStr}, 11:59:59 PM`;
  }

  // Only apply the filter if we have valid conditions
  if (Object.keys(dateOutFilter).length > 0) {
    // Exclude empty dateOut values and apply the filter
    query.dateOut = {
      ...dateOutFilter,
      $ne: "", // Exclude empty values
      $exists: true // Ensure field exists
    };

    // For range queries, we need to ensure we don't match invalid date strings
    if (dateOutFilter.$gte || dateOutFilter.$lte) {
      query.dateOut.$regex = /^\d{2}-\d{2}-\d{4}, \d{2}:\d{2}:\d{2} [AP]M$/;
    }
  }
}


Object.entries(filters).forEach(([key, value]) => {
  if (Array.isArray(value) && value.length > 0) {
    query[key] = { $in: value };
  }
});

    if (sentDate) {
      query.sentDate = {
        $regex: `^${sentDate}`,
        $options: 'i'
      };
    }
    
    // Role-based query conditions
    if (role === "admin") {
      // No additional filters for admin
    } else if (role === "employee") {
      query.listByEmployee = name;
    } else if (role === "client") {
      const user = await User.findOne({ userId });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      query = {
    $and: [
      query, // Keep all existing filters
      {
        $or: [
          { userId: user.userId },
          { clientCode: user.clientCode }
        ]
      }
    ]
  };
      
      // query = {
      //   $or: [
      //     { userId: user.userId },
      //     { clientCode: user.clientCode }
      //   ]
      // };
    } else {
      return res.status(400).json({ success: false, message: "Invalid role specified" });
    }
    
    const [trackerData, totalCount] = await Promise.all([
      KYC.find(query, projection,filters)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(parseInt(pageSize)),
      KYC.countDocuments(query)
    ]);
    
    const orderedData = trackerData.map(doc => orderFields(doc, columnOrder));
    
    // Include editable columns if needed
    if (role === "employee") {
      const employeeAccess = await EmployeeAccess.findOne({ employeeName: name });
      const editableColumns = employeeAccess?.editableColumns || [];
      return res.json({ 
        data: orderedData, 
        editableColumns,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(totalCount / pageSize)
        }
      });
    } else if (role === "client") {
      const clientAccess = await ClientAccess.findOne({ clientName: name });
      const editableColumns = clientAccess?.editableColumns || [];
      return res.json({ 
        data: orderedData, 
        editableColumns,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(totalCount / pageSize)
        }
      });
    }
    
    res.json({
      data: orderedData,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    console.error("Error fetching tracker data:", error);
    res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
};
// exports.getTrackerData = async (req, res) => {
//   try {
//     const { 
//       role, 
//       userId, 
//       name, 
//       page = 1, 
//       pageSize = 50,
//       searchQuery = "",
//       // Filter parameters
//       product,
//       productType,
//       status,
//       caseStatus,
//       dateInStart,
//       dateInEnd,
//       dateOutStart,
//       dateOutEnd,
//       sentDate,
//       vendorStatus,
//       priority,
//       clientType
//     } = req.query;
    
//     const skip = (page - 1) * pageSize;
    
//     // Get column order for this role
//     const config = await ColumnConfig.findOne({ role });
//     let columnOrder = config?.columnOrder;
    
//     if (!columnOrder) {
//       // Fallback to all fields if no config exists
//       columnOrder = Object.keys(KYC.schema.paths).filter(
//         field => !['_id', '__v', 'createdAt','userId', 'updatedAt'].includes(field)
//       );
//     }
    
//     // Build projection based on column order
//     const projection = {};
//     columnOrder.forEach(field => {
//       projection[field] = 1;
//     });
//     projection._id = 0;
    
//     let query = {};
    
//     // Search functionality
//     if (searchQuery) {
//       query.$or = [
//         { caseId: { $regex: searchQuery, $options: 'i' } },
//         { accountNumber: { $regex: searchQuery, $options: 'i' } },
//         { name: { $regex: searchQuery, $options: 'i' } },
//         { clientCode: { $regex: searchQuery, $options: 'i' } },
//         { bankCode: { $regex: searchQuery, $options: 'i' } },
//         { details: { $regex: searchQuery, $options: 'i' } },
//         { remarks: { $regex: searchQuery, $options: 'i' } }
//       ];
//     }
    
//     // Apply filters
//     if (product) query.product = product;
//     if (productType) query.productType = productType;
//     if (status) query.status = status;
//     if (caseStatus) query.caseStatus = caseStatus;
//     if (vendorStatus) query.vendorStatus = vendorStatus;
//     if (priority) query.priority = priority;
//     if (clientType) query.clientType = clientType;
    
//     // Date range filters
//     if (dateInStart || dateInEnd) {
//       query.dateIn = {};
//       if (dateInStart) {
//         query.dateIn.$gte = moment(dateInStart, "DD-MM-YYYY").startOf('day').toDate();
//       }
//       if (dateInEnd) {
//         query.dateIn.$lte = moment(dateInEnd, "DD-MM-YYYY").endOf('day').toDate();
//       }
//     }
    
//     if (dateOutStart || dateOutEnd) {
//       query.dateOut = {};
//       if (dateOutStart) {
//         query.dateOut.$gte = moment(dateOutStart, "DD-MM-YYYY").startOf('day').toDate();
//       }
//       if (dateOutEnd) {
//         query.dateOut.$lte = moment(dateOutEnd, "DD-MM-YYYY").endOf('day').toDate();
//       }
//     }
    
//     if (sentDate) {
//       query.sentDate = {
//         $regex: `^${sentDate}`,
//         $options: 'i'
//       };
//     }
    
//     // Role-based query conditions
//     if (role === "admin") {
//       // No additional filters for admin
//     } else if (role === "employee") {
//       query.listByEmployee = name;
//     } else if (role === "client") {
//       const user = await User.findOne({ userId });
//       if (!user) {
//         return res.status(404).json({ success: false, message: "User not found" });
//       }
      
//       query = {
//         $or: [
//           { userId: user.userId },
//           { clientCode: user.clientCode }
//         ]
//       };
//     } else {
//       return res.status(400).json({ success: false, message: "Invalid role specified" });
//     }
    
//     const [trackerData, totalCount] = await Promise.all([
//       KYC.find(query, projection)
//         .sort({ _id: -1 })
//         .skip(skip)
//         .limit(parseInt(pageSize)),
//       KYC.countDocuments(query)
//     ]);
    
//     const orderedData = trackerData.map(doc => orderFields(doc, columnOrder));
    
//     // Include editable columns if needed
//     if (role === "employee") {
//       const employeeAccess = await EmployeeAccess.findOne({ employeeName: name });
//       const editableColumns = employeeAccess?.editableColumns || [];
//       return res.json({ 
//         data: orderedData, 
//         editableColumns,
//         pagination: {
//           total: totalCount,
//           page: parseInt(page),
//           pageSize: parseInt(pageSize),
//           totalPages: Math.ceil(totalCount / pageSize)
//         }
//       });
//     } else if (role === "client") {
//       const clientAccess = await ClientAccess.findOne({ clientName: name });
//       const editableColumns = clientAccess?.editableColumns || [];
//       return res.json({ 
//         data: orderedData, 
//         editableColumns,
//         pagination: {
//           total: totalCount,
//           page: parseInt(page),
//           pageSize: parseInt(pageSize),
//           totalPages: Math.ceil(totalCount / pageSize)
//         }
//       });
//     }
    
//     res.json({
//       data: orderedData,
//       pagination: {
//         total: totalCount,
//         page: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalPages: Math.ceil(totalCount / pageSize)
//       }
//     });
//   } catch (error) {
//     console.error("Error fetching tracker data:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch data" });
//   }
// };
// exports.getTrackerData = async (req, res) => {
//   try {
//     const { role, userId, name , page = 1, pageSize = 50} = req.query;
//     const skip = (page - 1) * pageSize;
    
//     // Get column order for this role
//     const config = await ColumnConfig.findOne({ role });
//     let columnOrder = config?.columnOrder;
    
//     if (!columnOrder) {
//       // Fallback to all fields if no config exists
//       columnOrder = Object.keys(KYC.schema.paths).filter(
//         field => !['_id', '__v', 'createdAt','userId', 'updatedAt'].includes(field)
//       );
//     }
    
//     // Build projection based on column order
//     const projection = {};
//     columnOrder.forEach(field => {
//       projection[field] = 1;
//     });
//     projection._id = 0;
    
//     let query = {};
//     let populateOptions = [];
    
//     if (role === "admin") {
//       // No additional query filters for admin
//       populateOptions = [{ path: "userId", select: "name email phoneNumber userId" }];
//     } else if (role === "employee") {
//       query.listByEmployee = name;
//     } else if (role === "client") {
//       const user = await User.findOne({ userId });
//       if (!user) {
//         return res.status(404).json({ success: false, message: "User not found" });
//       }
      
//       query = {
//         $or: [
//           { userId: user.userId },
//           { clientCode: user.clientCode }
//         ]
//       };
      
//       populateOptions = [{ path: "userId", select: "name email phoneNumber userId" }];
//     } else {
//       return res.status(400).json({ success: false, message: "Invalid role specified" });
//     }
    
//     // const trackerData = await KYC.find(query, projection)
//     //   .populate(...populateOptions)
//     //   .sort({ _id: -1 });

//     const [trackerData, totalCount] = await Promise.all([
//       KYC.find(query, projection)
//         .populate(...populateOptions)
//         .sort({ _id: -1 })
//         .skip(skip)
//         .limit(parseInt(pageSize)),
//       KYC.countDocuments(query)
//     ]);
    
//     const orderedData = trackerData.map(doc => orderFields(doc, columnOrder));
    
//     // Include editable columns if needed
//     if (role === "employee") {
//       const employeeAccess = await EmployeeAccess.findOne({ employeeName: name });
//       const editableColumns = employeeAccess?.editableColumns || [];
//       return res.json({ data: orderedData, editableColumns });
//     } else if (role === "client") {
//       const clientAccess = await ClientAccess.findOne({ clientName: name });
//       const editableColumns = clientAccess?.editableColumns || [];
//       return res.json({ data: orderedData, editableColumns });
//     }
    
//     // res.json(orderedData);
//     res.json({
//       data: orderedData,
//       pagination: {
//         total: totalCount,
//         page: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalPages: Math.ceil(totalCount / pageSize)
//       },});
//   } catch (error) {
//     console.error("Error fetching tracker data:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch data" });
//   }
// };

// // Define field orders for each role
// const FIELD_ORDERS = {
//   admin: [
//     'attachments',
//     'caseId',
//     'remarks',
//     'name',
//     'details',
//     'details1',
//     'priority',
//     'correctUPN',
//     'product',
//     'updatedProductName',
//     'accountNumber',
//     'requirement',
//     'accountNumberDigit',
//     'bankCode',
//     'clientCode',
//     'vendorName',
//     'vendorStatus',
//     'dateIn',
//     'dateInDate',
//     'status',
//     'caseStatus',
//     'productType',
//     'listByEmployee',
//     'dateOut',
//     'dateOutInDay',
//     'sentBy',
//     'autoOrManual',
//     'caseDoneBy',
//     'clientTAT',
//     'customerCare',
//     'NameUploadBy',
//     'ReferBy',
//     'sentDate',
//     'sentDateInDay',
//     'clientType',
//     'dedupBy',
//     'ipAddress',
//     'isRechecked'
//   ],
//   employee: [
//     'caseId',
//     'attachments',
//     'remarks',
//     'name',
//     'details',
//     'details1',
//     'priority',
//     'correctUPN',
//     'product',
//     'updatedProductName',
//     'accountNumber',
//     'requirement',
    
//     'accountNumberDigit',
//     'bankCode',
//     'clientCode',
//     'vendorName',
//     'vendorStatus',
//     'dateIn',
//     'dateInDate',
//     'status',
//     'caseStatus',
//     'productType',
//     'listByEmployee',
//     'dateOut',
//     'dateOutInDay',
//     'sentBy',
//     'autoOrManual',
//     'caseDoneBy',
//     'clientTAT',
//     'NameUploadBy',
//     'ReferBy',
//     'customerCare',
//     'sentDate',
//     'sentDateInDay',
//     'clientType',
//     'dedupBy',
//     'isRechecked'
//   ],
//   client: [
//     'caseId',
//     'attachments',
//     'remarks',
//     'name',
//     'details',
//     'details1',
//     'priority',
//     'correctUPN',
//     'product',
//     'updatedProductName',
//     'accountNumber',
//     'requirement',
    
//     'clientCode',
//     'dateIn',
//     'dateInDate',
//     'status',
    
//     'caseStatus',
//     'productType',
//     'listByEmployee',
//     'dateOut',
//     'sentBy',
//     'caseDoneBy',
//     'clientTAT',
//     'customerCare',
//     'NameUploadBy',
//     'ReferBy',
//     'sentDate',
//     'isRechecked'
//   ]
// };

// async function getColumnOrder(role) {
//   const config = await ColumnConfig.findOne({ role });
//   return config?.columns || FIELD_ORDERS[role] || [];
// }

// exports.getTrackerData = async (req, res) => {
//   try {
//     const { role, userId, name } = req.query;

    
    
//     let projection = {};

//     if (role === "admin") {
//       projection = {
//         _id: 0,
//         attachments: 1,
//         userId: 0,
//         caseId: 1,
//         remarks: 1,
//         name: 1,
//         details: 1,
//         details1: 1,
//         priority: 1,
//         correctUPN: 1,
//         product: 1,
//         updatedProductName: 1,
//         accountNumber: 1,
//         requirement: 1,
        
//         accountNumberDigit: 1,
//         bankCode: 1,
//         clientCode: 1,
//         vendorName: 1,
//         vendorStatus:1,
//         dateIn: 1,
//         dateInDate: 1,
//         status: 1,
//         caseStatus: 1,
//         productType: 1,
//         listByEmployee: 1,
//         dateOut: 1,
//         dateOutInDay: 1,
//         sentBy: 1,
//         autoOrManual: 1,
//         caseDoneBy: 1,
//         clientTAT: 1,
//         customerCare: 1,
//         NameUploadBy: 1,
//         ReferBy:1,
//         sentDate: 1,
//         sentDateInDay: 1,
//         clientType: 1,
//         dedupBy: 1,
//         ipAddress: 1,
//         isRechecked: 1
//       };

//       const trackerData = await KYC.find({}, projection)
//         .populate("userId", "name email phoneNumber userId")
//         .sort({ _id: -1 });

//       // const orderedData = trackerData.map(doc => orderFields(doc, FIELD_ORDERS.admin));
//       const fieldOrder = await getColumnOrder(role);
//       const orderedData = trackerData.map(doc => orderFields(doc, fieldOrder));
//       return res.json(orderedData);

//     } else if (role === "employee") {
//       projection = {
//         _id: 0,
//         caseId: 1,
//         attachments: 1,
//         remarks: 1,
//         name: 1,
//         details: 1,
//         details1: 1,
//         priority: 1,
//         correctUPN: 1,
//         product: 1,
//         updatedProductName: 1,
//         accountNumber: 1,
//         requirement: 1,
        
//         accountNumberDigit: 1,
//         bankCode: 1,
//         clientCode: 1,
//         vendorName: 1,
//         vendorStatus: 1,
//         dateIn: 1,
//         dateInDate: 1,
//         status: 1,
//         caseStatus: 1,
//         productType: 1,
//         listByEmployee: 1,
//         dateOut: 1,
//         dateOutInDay: 1,
//         sentBy: 1,
//         autoOrManual: 1,
//         caseDoneBy: 1,
//         clientTAT: 1,
//         NameUploadBy: 1,
//         ReferBy:1,
//         customerCare: 1,
//         sentDate: 1,
//         sentDateInDay: 1,
//         clientType: 1,
//         dedupBy: 1,
//         isRechecked: 1
//       };

//       const employeeAccess = await EmployeeAccess.findOne({ employeeName: name });
//       const editableColumns = employeeAccess?.editableColumns || [];

//       const EmpData = await KYC.find({ listByEmployee: name }, projection).sort({ _id: -1 });

//       const orderedData = EmpData.map(doc => orderFields(doc, FIELD_ORDERS.employee));
//       return res.json({ data: orderedData, editableColumns });

//     } else if (role === "client") {
//       projection = {
//         _id: 0,
//         userId: 0,
//         caseId: 1,
//         attachments: 1,
//         remarks: 1,
//         name: 1,
//         details: 1,
//         details1: 1,
//         priority: 1,
//         correctUPN: 1,
//         product: 1,
//         updatedProductName: 1,
//         accountNumber: 1,
//         requirement: 1,
        
//         clientCode: 1,
//         dateIn: 1,
//         status: 1,
//         dateInDate: 1,
//         caseStatus: 1,
//         productType: 1,
//         listByEmployee: 1,
//         dateOut: 1,
//         sentBy: 1,
//         caseDoneBy: 1,
//         clientTAT: 1,
//         customerCare: 1,
//         NameUploadBy: 1,
//         ReferBy:1,
//         sentDate: 1,
//         isRechecked: 1
//       };

//       // Fetch user to check if clientCode exists
//       const user = await User.findOne({ userId });

//       if (!user) {
//         return res.status(404).json({ success: false, message: "User not found" });
//       }

//       // Build query conditionally
//       const query = { userId };
//       if (user.role === "client" && user.clientCode) {
//         query.clientCode = user.clientCode;
//       }

//       const trackerData = await KYC.find({
//     $or: [
//     { userId: user.userId },       
//     { clientCode: user.clientCode } 
//   ]
// }, projection)
//         .populate("userId", "name email phoneNumber userId")
//         .sort({ _id: -1 });

//       const orderedData = trackerData.map(doc => orderFields(doc, FIELD_ORDERS.client));
//       const clientAccess = await ClientAccess.findOne({ clientName: name });
//       const editableColumns = clientAccess?.editableColumns || [];
//       return res.json({ data: orderedData, editableColumns });
//     }

//     res.status(400).json({ success: false, message: "Invalid role specified" });
//   } catch (error) {
//     console.error("Error fetching tracker data:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch data" });
//   }
// };
exports.singleTrackerData = async (req, res) => {
  try {
    const { role, userId } = req.query;
    // console.log("Requested userId:", userId);

    let projection = {
      _id: 0,
      userId: 0,
      caseId: 1,
      remarks: 1,
      name: 1,
      details: 1,
      details1: 1,
      priority: 1,
      correctUPN: 1,
      product: 1,
      updateProductName: 1,
      accountNumber: 1,
      requirement: 1,
      updatedRequirement: 1,
      clientCode: 1,
      dateIn: 1,
      dateInDate: 1,
      caseStatus: 1,
      productType: 1,
      listByEmployee: 1,
      dateOut: 1,
      sentBy: 1,
      caseDoneBy: 1,
      customerCare: 1,
      sentDate: 1,
    };
    const trackerData = await KYC.find({ userId: userId }, projection).populate(
      "userId",
      "name email phoneNumber userId"
    );
    res.json(trackerData);
  } catch (error) {
    console.error("Error fetching tracker data:", error);
    res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
};

exports.updateTrackerData = async (req, res) => {
  try {
    const { updatedData } = req.body;

    if (!Array.isArray(updatedData)) {
      return res.status(400).json({
        success: false,
        message: "Expected array of updates"
      });
    }

    const results = await Promise.all(updatedData.map(async (update) => {
      // Validate required fields
      const { caseId, changedField, userId, userName } = update;
      const newValue = update[changedField];
      
      if (!caseId || !changedField || newValue === undefined) {
        throw new Error(`Invalid update format: ${JSON.stringify(update)}`);
      }

      if (!userId || !userName) {
        throw new Error("User information missing in update");
      }

      // Validate vendor name if updating vendorName field
      if (changedField === 'vendorName') {
        const vendorExists = await Vendor.exists({ vendorName: newValue });
        if (!vendorExists) {
          throw new Error(`Vendor '${newValue}' not found in database`);
        }
      }

      // Validate employee name if updating listByEmployee field
      if (changedField === 'listByEmployee') {
        const employeeExists = await ClientCode.exists({ EmployeeName: newValue });
        if (!employeeExists) {
          throw new Error(`Employee '${newValue}' not found in database`);
        }
      }

      // Prepare update payload
      const updatePayload = {
        [changedField]: newValue,
        updatedAt: getFormattedDateTime(),
        updatedBy: userName,
        updatedById: userId
      };

      // Special field handling
      if (changedField === 'status' && newValue === "Closed") {
        updatePayload.dateOut = getFormattedDateTime();
        updatePayload.caseDoneBy = userName;
        
        const doc = await KYC.findOne({ caseId });
        if (doc?.dateIn) {
          updatePayload.clientTAT = calculateTAT(
            parseCustomDateTime(doc.dateIn),
            updatePayload.dateOut
          );
        }
      }

      if (changedField === 'caseStatus' && newValue === "Sent") {
        updatePayload.sentDate = getFormattedDateTime();
        updatePayload.sentBy = userName;
      }

      // Apply update
      const updatedDoc = await KYC.findOneAndUpdate(
        { caseId },
        { $set: updatePayload },
        { new: true, runValidators: true }
      );

      if (!updatedDoc) {
        throw new Error(`Case ${caseId} not found`);
      }

      return updatedDoc;
    }));

    res.json({
      success: true,
      updatedDocuments: results
    });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(400).json({ // Changed to 400 for client errors
      success: false,
      message: error.message,
      field: error.message.includes('Vendor') ? 'vendorName' : 
             error.message.includes('Employee') ? 'listByEmployee' : undefined
    });
  }
};
// exports.updateTrackerData = async (req, res) => {
//   try {
//     const { updatedData } = req.body;

//     if (!Array.isArray(updatedData)) {
//       return res.status(400).json({
//         success: false,
//         message: "Expected array of updates"
//       });
//     }

//     const results = await Promise.all(updatedData.map(async (update) => {
//       // Validate required fields
//       const { caseId, changedField, userId, userName } = update;
//       const newValue = update[changedField];
      
//       if (!caseId || !changedField || newValue === undefined) {
//         throw new Error(`Invalid update format: ${JSON.stringify(update)}`);
//       }

//       if (!userId || !userName) {
//         throw new Error("User information missing in update");
//       }

//       // Prepare update payload
//       const updatePayload = {
//         [changedField]: newValue,
//         updatedAt: new Date(),
//         updatedBy: userName,
//         updatedById: userId
//       };

//       // Special field handling
//       if (changedField === 'status' && newValue === "Closed") {
//         updatePayload.dateOut = getFormattedDateTime();
//         updatePayload.caseDoneBy = userName;
        
//         const doc = await KYC.findOne({ caseId });
//         if (doc?.dateIn) {
//           updatePayload.clientTAT = calculateTAT(
//             parseCustomDateTime(doc.dateIn),
//             updatePayload.dateOut
//           );
//         }
//       }

//       if (changedField === 'caseStatus' && newValue === "Sent") {
//         updatePayload.sentDate = getFormattedDateTime();
//         updatePayload.sentBy = userName;
//       }

//       // Apply update
//       const updatedDoc = await KYC.findOneAndUpdate(
//         { caseId },
//         { $set: updatePayload },
//         { new: true, runValidators: true }
//       );

//       if (!updatedDoc) {
//         throw new Error(`Case ${caseId} not found`);
//       }

//       return updatedDoc;
//     }));

//     res.json({
//       success: true,
//       updatedDocuments: results
//     });

//   } catch (error) {
//     console.error("Update Error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// Helper functions
async function handleStatusClosed(caseId, updatePayload, user) {
  const now = new Date();
  updatePayload.dateOut = now;
  updatePayload.caseDoneBy = user.name;

  const doc = await KYC.findOne({ caseId });
  if (doc?.dateIn) {
    updatePayload.clientTAT = calculateTAT(
      parseCustomDateTime(doc.dateIn),
      now
    );
  }
}

async function handleCaseStatusSent(caseId, updatePayload, user) {
  updatePayload.sentDate = new Date();
  updatePayload.sentBy = user.name;
}

function formatDocumentForFrontend(doc) {
  const formatted = doc.toObject();
  
  // Convert all dates to frontend format
  ['dateIn', 'dateOut', 'sentDate', 'createdAt', 'updatedAt'].forEach(field => {
    if (formatted[field]) {
      formatted[field] = formatForFrontend(formatted[field]);
    }
  });
  
  return formatted;
}
exports.getTemplate = async (req, res) => {
  try {
    // Create a new workbook
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    sheet.name("KYC Template");

    // Header row
    const headers = ["Name", "Product", "Account Number", "Requirement"];
    headers.forEach((header, index) => {
      sheet
        .cell(1, index + 1)
        .value(header)
        .style({ bold: true });
    });

    // Create a hidden sheet for dropdown values
    const hiddenSheet = workbook.addSheet("DropdownValues");
    const productOptions = [
      "AIRTEL",
      "ARTEL",
      "Airtel",
      "AIS 2024-25",
      "AIS 2025-26",
      "AIS 2022-23",
      "AIS 2021-22",
      "AIS 2023-24",
      "AIS 2025-24",
      "FY AIS 2023-24",
      "AIS FY 2023-24",
      "APD",
      "PAN TO BANK",
      "APD",
      "MOBILE TO PAN",
      "AU SMALL FINANCE BANK",
      "AXIS BANK",
      "axis bank",
      "AXIS",
      "AXIS",
      "AXIS  BANK",
      "Axis  Bank",
      "BANK OF BARODA",
      "BOB BANK",
      "BOB BANK",
      "BOB",
      "BOB",
      "BOB ANK",
      "bank of baroda",
      "BOB  BANK",
      "BANK  OF BARODA",
      "BOB BNK",
      "Bank of Baroda, India",
      "BANK OF BAORDA",
      "BANK OF BAORDA",
      "BANK OF INDIA",
      "BOI BANK",
      "BANK OF INDIA",
      "BOI",
      "BOM BANK",
      "BANK OF MAHARASHTRA",
      "BOM",
      "BOM BNK",
      "CANARA BANK",
      "CANARA BANK",
      "CANRA BANK",
      "CANARA",
      "CANARA",
      "CANAR BANK",
      "CARANA BANK",
      "CBI BANK",
      "CENTRAL BANK OF INDIA",
      "CENTRAL BANK",
      "CENTRAL",
      "CBI BANK",
      "CBI",
      "CBI",
      "CBI ABNK",
      "CBI BANKING",
      "CBI ANK",
      "Central Bank  Of India",
      "CENTRAL BANK OF INDIA",
      "CENTRALBANK OF INDIA",
      "Central Bank of India, India",
      "CBIBANK",
      "CBII",
      "CANTRAL BANK OF INDIA",
      "CBI BNK",
      "CBI BANI",
      "CBI BNAK",
      "CENTRL BANK OF INDIA",
      "CIBIL",
      "CIBL",
      "UBI BANK PAN SEARCH",
      "Dual Pan",
      "DUAL PAN CARD",
      "DUAL PAN CARD",
      "FIN 2022-23",
      "FIN 2023-24",
      "FIN 2024-25",
      "FIN 2017-18",
      "FIN 2018-19",
      "FIN 2019-20",
      "FIN 2015-16",
      "FIN 2021-22",
      "FIN  2023 24",
      "FIN  2024 25",
      "FIN 2023 24",
      "FIN  2023-24",
      "FIN  2024-25",
      "FIN REVISED 2023-24",
      "FIN 2023-24   ( 514264361151123)",
      "FIN  2020-21",
      "FIN  2022-23",
      "REVISED FIN 2023-24",
      "FIN 2023- 24",
      "FIN 2023 - 24",
      "FIN 2023-24",
      "FIN 2022-23 REVISED",
      "REVISED RETURN FIN 2024-25",
      "REVISED FIN 2023-24",
      "FIN -2023-24",
      "FIN -2022-23",
      "FIN-2021-22",
      "FIN 2020-21",
      "FIN-2023-24",
      "FIN 2023-24 REVISED",
      "FIN 2023 24",
      "FIN 2024 25",
      "FIN 2024-25 REVISED",
      "FIN 2025-26",
      "FIN 2016-17",
      "FIN 23-24",
      "REVISED FIN 2024-25",
      "FIN  2020 -21",
      "FIN 2024-25 REVISED RETURN",
      "UPATED 1 YEAR FIN",
      "FIN",
      "FIN 2023-24 UPDATTED",
      "FIN 2024-25 REVISED RETURN",
      "FIN 2024-25 REVISED",
      "FIN 2023-24 LASTEST FILED",
      "FIN 2022 23",
      "FIN 2022-23 REVISED RETURN",
      "REVISED FIN 2022-23",
      " (Revised ) FIN 2023-24",
      "FIN 2021-22 REVISED",
      "FIN-2024-25",
      "FIN-2022-23",
      "FIN   2023-24",
      "FIN   2024-25",
      "FIN 2024-24",
      "FIN 2024-25",
      "FIN 2024 -25",
      "FIN 2014-15",
      "FIN 24-25",
      "FIN 2023-25",
      "FIN 2018-19 revised",
      "FIN  2015-16",
      "FIN  2016-17",
      "FIN  2017-18",
      "FIN   2016-17",
      "FIN  2017-18",
      "FIN  2018-19",
      "FIN  2019-20",
      "FIN  2020-21",
      "FIN  2021-22",
      "FIN  2014-15",
      "FIN  2015-16",
      "REVISED FIN 2022-23",
      "REVISED FIN 2024-25",
      "REVISED FIN 2024-25",
      "FIN 2021 22",
      "FIN 2023 24 REVISED",
      "FORM 26AS 2022-23",
      "FORM 26AS 2023-24",
      "FORM 26AS 2024-25",
      "Form 26 AS 2023-24",
      "Form 26 AS 2024-25",
      "FORM 26AS 2025-26",
      "Form 26 AS 2025-26",
      "FORM 26AS  2024-25",
      "FORM 26AS  2025-26",
      "Form 26 AS 2022-23",
      "FORM 26A 2025-26",
      "FORM26AS 2025-26",
      "FORM 26AS 2023 24",
      "FORM 26AS 2024 25",
      "FORM 26AS 2021 22",
      "FORM 26AS 2022 23",
      "FORM 26AS 2025 26",
      "FORM 26AS 2021-22",
      "FORM26AS  2025-26",
      "FORM 26AS  2025- 26",
      "FORM 26AS 24-25",
      "FORM 26AS 25-26",
      "FORM 26AS  2023 24",
      "FORM 26AS  2024 25",
      "FORM 26AS  2025 26",
      "FORM 26AS  2022 23",
      "FORM26AS  2024-25",
      "FORM 26AS  2023-24",
      "FORM 26AS 2020 21",
      "FORM 26 AS 2021-22",
      "FORM 26AS 2023-34",
      "FORM 26AS2024-25",
      "FORM 26AS 2024 25",
      "FORM 26A 2024-25",
      "FORM 26AS 2O24-25",
      "FORM 26AS2023-24",
      "FORM26AS 2023-24",
      "Form 26 AS 2020-21",
      "FORM26AS AY 25-26",
      "FORM 26AS 2019-20",
      "FORM 26AS 2018-19",
      "Form 26 AS 2018-19",
      "Form 26 AS 2019-20",
      "FORM 2A6S 2025-26",
      "FORM 26AS 2023--24",
      "FORM 26AS2025-26",
      "FORM 26AS 2014-15",
      "FORM 26AS 2015-16",
      "FORM 26AS  FY 2024-25",
      "FORM 26AS FY 2025-26",
      "FORM 26AS 2025-25",
      "FORM 26AS 2024 26",
      "FORM 26AS 2024-25",
      "FOIRM 26AS  2023-24",
      "FOIRM 26AS  2024-25",
      "FORM 26AS 2023-24",
      "FORM 26AS 2025 -26",
      "FORM 2A6AS 2023-24",
      "FORM 26S 2025-26",
      "FORM 26AS 2020-21",
      "FORM 26AS-2023-24",
      "FORM 26AS 202025-26",
      "FORM 26AS  2025-26",
      "FORM 26AS 2025-26",
      "FORM 26AS 2011 12",
      "FORM 26AS 2012 13",
      "FORM 26AS 2014 15",
      "FORM 26AS 2015 16",
      "FORM 26AS 2016 17",
      "FORM 26AS 2017 18",
      "FORM 26AS 2018 19",
      "FORM 26AS 2019 20",
      "FORM 26AS 2020 21",
      "FORM 26AS 2021 22",
      "FORM 26AS 2022 23",
      "FORM 26AS 2023 24",
      "FORM 26AS 2025 26",
      "FORM 26AS 2013-14",
      "FORM 26AS 2024- 25",
      "FORM 26 AS 20526",
      "FORM 26AS 2016-17",
      "FORM 26AS 2017-18",
      "GSTR -1",
      "GSTR 3B",
      "HDFC BANK",
      "HDFC BANK",
      "HDFC BANK LIMITED",
      "HDFC",
      "HDFC",
      "HDFC BANK LIMITED",
      "HDFC BNAK",
      "HDFC  Bank",
      "HDFC BNK",
      "HDFCBANK",
      "HDFC BNAK",
      "ICICI BANK",
      "ICICI BANK",
      "ICICI",
      "ICICI BANK LIMITED",
      "ICICI BNK",
      "ICICI BANK LIMITED",
      "ICICI",
      "ICIC BANK",
      "ICICI  BANK",
      "ICICI BNAK",
      "CICI BANK",
      "ICICI BANK OF INDIA",
      "IDBI Bank",
      "IDBI",
      "IDBI BANKING",
      "IDBI BANK",
      "IDFC BANK",
      "IDFC",
      "IDFC FIRST BANK",
      "IDFC FIRST BANK LTD",
      "IDFC  BANK",
      "IDFC FIRST BANK",
      "IDFC BAK",
      "INDIAN BANK",
      "INDIAN BANK",
      "INDIAN  BANK",
      "INDIAN",
      "INDINA Bank",
      "INDIAN",
      "Indian Bank, India",
      "Indian  Bank",
      "INDAIN BANK",
      "INIDIAN BANK",
      "INDAN BANK",
      "INDIA BANK",
      "INDIAN ABNK",
      "INDIAN BAANK",
      "INDUSIND BANK",
      "INDUSIND",
      "INDUSIND",
      "INDUSIND BNK",
      "INDUSIND BANK",
      "INDUSND BANK",
      "INDUSLAND BANK",
      "IndusInd Bank, India",
      "Induisnd Bank",
      "INDUSIDN BANK",
      "INDUSIND BANK",
      "INDUSLND BANK",
      "INDUSTAND BANK",
      "INDIAN OVERSEAS BANK",
      "INDIAN OVERSEASE BANK",
      "IOB",
      "IOB BANK",
      "INDIAN OVRSEAS BANK",
      "INDIAN  OVERSEAS  BANK",
      "INDIAN OVERSEAS  BANK",
      "India Overseas Bank",
      "IOB",
      "Indian Overseas",
      "INDIAN OVERSES  BANK",
      "Indian Overseas Bnak",
      "INDIDAN OVERSEAS BANK",
      "Indian Overseas Bank, India",
      "INDIAN OVERSEASS BANK",
      "INDAIN OVERSEAS BANK",
      "Indian Over Seas bank",
      "INDIAN OVERSEAS BANK",
      "IOB ANK",
      "IOB BNK",
      "IOB BANK",
      "INDIAN OVERSAS BANK",
      "IOB Bankj",
      "INDIAN OVERSEAS NBANK",
      "Indina Overseas Bank",
      "Inidian Overseas Bank",
      "INDIAN OVERSEAS BANK,",
      "INDIAN  OVERSEAS BANK",
      "ITR 2022-23",
      "ITR 2023-24",
      "ITR 2024-25",
      "ITR  2023 24",
      "ITR 2023 24",
      "ITR  2024-25",
      "ITR  2023-24",
      "ITR  2022-23 REVISED",
      "ITR  2024-25 REVISED",
      "ITR-2022-23",
      "ITR-2020-21",
      "REVISED ITR 2022-23",
      "ITR-2023-24",
      "ITR-2021-22",
      "ITR-2024-25",
      "REVISED ITR 2023-24",
      "ITR  2022-23",
      "ITR 2021-22",
      "REVISED ITR 2024-25",
      "REVISED ITR 2021-22",
      "ITR  2022-2023",
      "ITR  2024-2025",
      "ITR  2023-2024",
      "ITR 2025-26",
      "ITR  2024- 25",
      "REVIEDITR 2023-24",
      "ITR 2023-24 REVISED",
      "ITR 2024-25 REVISED",
      "ITR 2023- 24",
      "ITR 2024- 25",
      "ITR 2023-2024",
      "ITR 2024-2025",
      "ITR 2024-2025 REVISED",
      "ITR 2020-21",
      "ITR  2019-20",
      "ITR 2025-24",
      "ITR -2023-24",
      "ITR  2023-24 REVISED",
      "ITR -2024-25",
      "ITR 2022 -23",
      "ITR 2023 -24",
      "ITR 2018 -19",
      "ITR 2017 -18",
      "ITR   2024-25",
      "ITR 2016-17",
      "ITR 2017-18",
      "ITR  2021- 22(REVISED ITR)",
      "ITR  2023- 24",
      "ITR 2019-20",
      "ITR 2024-25 REVISED RETURN",
      "ITR  2021-22",
      "ITR 2021-22    (AK NO : 702760160311221)",
      "ITR REVISED 2023-24",
      "ITR -2021-22",
      "ITR -2022-23",
      "ITR-2019-20",
      "ITR-2017-18",
      "ITR-2018-19",
      "ITR-2015-16",
      "ITR-2016-17",
      "ITR REVISED 2024-25",
      "ITR 2018-19",
      "ITR  2024-2025 REVISED",
      "ITR 2023-24   (AK NO: 567162350221223)",
      "ITR-2023-24",
      "ITR  2021- 22",
      "ITR  2024 25",
      "ITR  2023 24",
      "REVISED ITR 2022-23   (AK  NO:906333700311222)",
      "ITR   2023-24",
      "ITR 2023-24  (AK NO 578492161271223 )",
      "ITR 2021 22",
      "ITR 2022 23",
      "ITR 2023 24",
      "ITR 2024 25",
      " ITR  2022-23  (REVISED)",
      "ITR 2023 24 REVISED",
      "ITR 2023-24 UPDATTED",
      "ITR 2023-24 UPDATTED RETURN",
      "ITR 2022-23 BELATED",
      "ITR 2022-23 REVISED RETURN",
      "ITR 2023-24 REIVSED RETURN",
      "ITR-2024-25 REVISED",
      "ITR 2024-24",
      "ITR 2022-23 UPDATTED",
      "ITR 2023-24 UPDATTED",
      "ITR 2022-23 BELATED",
      "ITR -2024 -25",
      "ITR 2023-24 REVISED RETURN",
      "ITR-20234-25",
      "ITR 24-25",
      "ITR 2022-23 RETURN FILED",
      "ITR 2021-22 BELATED",
      "ITR 2022-23 RETURN",
      "ITR 2024-25",
      "ITR 2022-23 UPDATTED RETURN",
      "ITR 2020 21",
      "ITR   2022-23",
      "ITR  2023 24 ( REVISED )",
      "ITR-2022-23",
      "ITR 2022-23 UPDATED",
      "ITR-,2024-25",
      "ITR 2024-25 REVISED",
      "ITR  2022-2023 REVISED",
      "ITR BELATED 2022-23",
      "ITR 2020-23",
      "ITR 2023-24",
      "ITR 2022-23",
      "ITR 2023-24",
      "ITR 2021-22",
      "ITR 202324",
      "ITR  2023 -24",
      "ITR 2022-2023 BELATED RETURN",
      "ITR 2-24-25",
      "ITR 2024-25 REVSEID RETURN",
      "ITR  2023-24 REVSIED",
      "ITR 2022-23 REVISED",
      "ITR-2023-24,",
      "ITR 2017 18",
      "ITR 2018 19",
      "ITR 2019 20",
      "ITR-2022-23,",
      "ITR  2022- 23",
      "ITR 2022-23 REIVSED",
      "ITR 22-23",
      "ITR  2022-23 REVSIED",
      "ITR  2021 22  LATEST FILED",
      "ITR 2022 23 LATEST FILED",
      "ITR 2023 24 LATEST FILED",
      "ITR 2024-25 LATEST FILED",
      "ITR 2023-24 LATEST FILED",
      "ITR 2022-23 LATEST FILED",
      "ITR 2023-24 REVISED",
      "ITR 2022-23  LATEST FILED",
      "ITR 2021-22 LATEST FILED",
      "ITR 2022-23    LASTEST FILED",
      "ITR 2023-24   LATEST FILED",
      "ITR 2024-25   LATEST FILED",
      "ITR 2024-25 UPDATTED",
      "ITR 2021-22 RETURN FILED",
      "ITR 2022-23 RETUTN FILED",
      "ITR 2023-24  LATEST FILED",
      "ITR 2021-22  LATEST FILED",
      "ITR 2024 25 REVISED",
      "ITR 2024 25  LATEST FILED",
      "REVISED ITR 2021-22",
      "ITR 2023-24 (REVISED RETURN)",
      "ITR 2022 23 LATEST FILED",
      " REVISED ITR 2023-24",
      "ITR  2021-2022",
      "ITR  2022 23",
      " ITR 2023-24",
      " ITR 2024-25",
      "ITR 2023 -24",
      "ITR 2022-2023",
      "ITR  2024- 25(REVISED ITR)",
      "ITR-2022-023",
      "ITR -2024-25(REVISED RETURN",
      "ITR-2024-25(REVISED RETURN)",
      "REVISED ITR 2015-16",
      "ITR-2022-23(UPDATED RETURN)",
      "ITR  2024 25 REVISED",
      "ITR 2022- 23",
      "ITR 2023 - 24",
      "ITR 2022 - 23",
      "REVISED ITR 2020-21",
      " ITR-2024-25",
      "ITR-2022-2023(REVISED RETURN)",
      "ITR 2024 -25",
      "ITR 2024-25 UPDATED RETURN",
      "ITR 2024-25 RETURN",
      "ITR 2021-22 LATEST FIELD",
      "ITR 2023-2024 REVISED",
      "Revised ITR  2024-25",
      "ITR  2022- 23(REVISED ITR)",
      "ITR  2023-2024 REVISED",
      "ITR   2024 25 REVISED",
      "REVISED ITR 2024-25",
      "ITR  2022--2023",
      "ITR 2022-23 UDPATED RETURN",
      "ITR 2023-24 UPDATED RETURN",
      "ITR 2024 25 LATEST FILED",
      "ITR 2023 24 LASTEST FILED",
      "ITR 2021 22 LATEST FILED",
      "ITR 2024-25 REFVISED RETURN",
      "ITR 2021-22 REVISED RETURN",
      "REVISED ITR 2019-20",
      "ITR 202-23 LATEST FILED",
      "ITR 2023 24 LATEST FILE",
      " ITR 2019-20",
      "ITR  2023-24 REVSED",
      "REVISDED ITR 2024-25",
      "ITR  2024-25 REVSED",
      "ITR  2024-25 REVESD",
      "ITR A Y 2023-24 REVISED",
      "ITR  2023--2024",
      "ITR 2020-21 REVISED",
      "ITR 2024-5",
      "ITR 23-2024",
      "ITR 24-2025",
      "REVISED ITR 2018-19",
      "ITR 23-24",
      "ITR 2024-2025 REVISED RETURN",
      " ITR 2021-22",
      "JIO",
      "KARNATAKA BANK",
      "KOTAK BANK",
      "KOTAK MAHINDRA BANK",
      "KOTAK",
      "KOTAK BANK",
      "KOTAK  BANK",
      "KOTAK",
      "Kotak Mahindra",
      "Kotak Mahindra Bank",
      "Kotak Mahindra",
      "KOTAK BNK",
      "KOTAK ANK",
      "KOTK BANK",
      "KOTAKBANK",
      "PAN Card",
      "PAN CARD",
      "PANCARD",
      "PANCARD",
      "PAN CARD",
      "PAN CRD",
      "PAN  CARD",
      "PAN CRAD",
      "PAN INVESTIGATION",
      "PAN WITH PHOTO",
      "PAN  WITH PHOTO",
      "PAN WITH PHOTO",
      "Photo with pan",
      "PAN WITH PHOTO",
      "PNB BANK",
      "Punjab National Bank",
      "PNB BANK",
      "PNB",
      "PNB  BANK",
      "PNB",
      "PNB  BANK",
      "PNB BANJK",
      "PUNJAB NATIONAL  BANK",
      "PNB ANK",
      "PUNJAB NATIONAL BANK",
      "PANJAB NATIONAL BANK",
      "rbl",
      "RBL BANK",
      "RBL BALNK",
      "RBL",
      "SBI BANK",
      "State Bank of India",
      "SBI BANK",
      "SBI",
      "SBI",
      "SBI  BANK",
      "SBI  BANK",
      "STATE BANK OF INIDA",
      "STATE BANK OF INDIA",
      "SBI BANKING",
      "SBI BANKING",
      "SBI BNK",
      "Sate Bank of India",
      "SBIBANK",
      "SBI BNK",
      "SBI BAK",
      "SBI ABNK",
      "SBIANK",
      "SBI ANK",
      "SBI BNAK",
      "SBII BANK",
      "Standard Charted Bank",
      "SCB BANK",
      "SCB",
      "STANDARD CHARTERED BANK",
      "STANDARD CHARTERED",
      "SCB ANK",
      "SCBBANK",
      "STANDARD CHARTED",
      "UNION BANK",
      "UNION BANK OF INDIA",
      "UNION",
      "UBI BANK",
      "UNION BANK",
      "UBI",
      "UBI BANK",
      "UBI",
      "Uniona Bank OF India",
      "Union Bank of India, India",
      "UBI BNK",
      "union bank of india",
      "UNION BANK OF INDIA",
      "Uni0n Bank of India",
      "UBI  BANK",
      "UNON BANK OF INDIA",
      "UNINON BANK",
      "UNION BANK OF INDIA,",
      "UNIION OF BANK INDIA",
      "UBIBANK",
      "UNION BNAK OF INDIA",
      "UNION BANK",
      "UBI BNANK",
      "UNION BANK OF INDIA.",
      "UNIO NBANK OF INDIA",
      "UB BANK",
      "Union Bank of Indian",
      "UBI ANK",
      "UBI;",
      "UBI BANKS",
      "UNION BANK OF NDIA",
      "ub",
      "UNION BANNK OF INDIA",
      "u bi",
      "United Bank of India",
      "  UNION BANK OF INDIA",
      "UNION BANK OF OF INDIA",
      "UNION BANK OF  INDIA",
      "UNION BANK OF INIDA",
      "UCO BANK",
      "VI",
      "Vodafone Idea",
      "VI",
      "VODAFONE",
      "VODAPHONE",
      "YES BANK",
      "PASSPORT",
      "AXIS BANK STATEMENT",
      "BOB BANK STATEMENT",
      "BOI BANK STATEMENT",
      "BOM BANK STATEMENT",
      "CANARA BANK STATEMENT",
      "CBI BANK STATEMENT",
      "HDFC BANK STATEMENT",
      "ICICI BANK STATEMENT",
      "IDBI BANK STATEMENT",
      "IDFC BANK STATEMENT",
      "INDIAN BANK STATEMENT",
      "INDUSIND BANK STATEMENT",
      "IOB BANK STATEMENT",
      "KARNATAKA BANK STATEMENT",
      "KOTAK BANK STATEMENT",
      "PNB BANK STATEMENT",
      "RBL BANK STATEMENT",
      "SBI BANK STATEMENT",
      "SCB BANK STATEMENT",
      "UBI BANK STATEMENT",
      "UCO BANK STATEMENT",
      "YES BANK STATEMENT",
      "GSTR 3B 2015-16",
      "GSTR 3B 2016-17",
      "GSTR 3B 2017-18",
      "GSTR 3B 2018-19",
      "GSTR 3B 2019-20",
      "GSTR 3B 2020-21",
      "GSTR 3B 2021-22",
      "GSTR 3B 2022-23",
      "GSTR 3B 2023-24",
      "GSTR 3B 2024-25",
      "GSTR 3B 2025-26",
      "GSTR 3B 2026-27",
    ];

    // Populate the hidden sheet with dropdown values
    productOptions.forEach((product, index) => {
      hiddenSheet.cell(index + 1, 1).value(product);
    });

    // Name the range for dropdown reference
    workbook.definedName(
      "ProductList",
      "DropdownValues!$A$1:$A$4" + productOptions.length
    );

    // Apply dropdowns to all rows (from row 2 onwards)
    for (let i = 2; i <= 100; i++) {
      sheet.cell(`B${i}`).dataValidation({
        type: "list",
        formula1: "=ProductList", //
        allowBlank: true,
        showDropDown: true, // Keeps dropdown inside the cell
      });
    }

    // Auto-adjust column widths
    sheet.column("A").width(20);
    sheet.column("B").width(20);
    sheet.column("C").width(25);
    sheet.column("D").width(30);

    // Generate the file path
    const filePath = path.join(__dirname, "KYC_Template.xlsx");
    await workbook.toFileAsync(filePath);

    // Send the file as response
    res.download(filePath, "KYC_Template.xlsx", (err) => {
      if (err) {
        console.error("File Download Error:", err);
        res.status(500).send("Error generating file");
      }
    });
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).send("Error generating file");
  }
};

// exports.updaterequirement = async (req, res) => {
//   let { caseId, name, product, accountNumber, requirement } = req.body;
//   console.log(caseId);

//   try {
//     const record = await KYC.findOne({ caseId });
//     console.log(record);
//     if (!record) {
//       res.status(400).json({ message: "Record not found!" });
//     }
//     // Save the recheck data to the database
   
//     record.caseId = generateCaseId(),
//     record.requirement = requirement;
//     record.dateIn = getFormattedDateTime(),
//     record.dateInDate = getFormattedDateDay(),
//     record.status = "New Data"
//     record.caseStatus = "New Pending"
//     await record.save();

//     res.status(200).json({ message: "Record rechecked successfully!" });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to recheck data." });
//   }
// };
exports.updaterequirement = async (req, res) => {
  try {
    const record = await KYC.findOne({ caseId: req.body.caseId });
    if (!record) {
      return res.status(404).json({ message: "Record not found!" });
    }

    // Create a new rechecked record (don't modify the original)
    const recheckedRecord = new KYC({
      ...record.toObject(),
      _id: undefined, // Let MongoDB create a new ID
      caseId: generateCaseId(),
      details: '',
      details1: '',
      priority: '',
      requirement: req.body.requirement,
      dateIn: getFormattedDateTime(),
      dateInDate: getFormattedDateDay(),
      status: "Pending",
      caseStatus: "New Pending",
      dateOut:"",
      dateOutInDay:"",
      sentBy:"",
      clientTAT:"",
      caseDoneBy:"",
      sentDate:"",
      sentDateInDay:"",
      vendorStatus:"",
      remarks:"",
      attachments:[],
      isRechecked: true,
      recheckedAt: new Date(),
      originalCaseId: record.caseId 
    });

    await recheckedRecord.save();
    // console.log("Rechecked record from backend:", recheckedRecord);
    
    res.status(200).json({ 
      message: "Record rechecked successfully!",
      recheckedRecord 
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to recheck data." });
  }
};
// exports.updaterequirement = async (req, res) => {
//   let { caseId, name, product, accountNumber, requirement } = req.body;
//   console.log(caseId);

//   try {
//     const record = await KYC.findOne({ caseId });
//     console.log(record);
//     if (!record) {
//       res.status(400).json({ message: "Record not found!" });
//     }
    
//     // Save the recheck data to the database
//     record.caseId = generateCaseId();
//     record.requirement = requirement;
//     record.dateIn = getFormattedDateTime();
//     record.dateInDate = getFormattedDateDay();
//     record.status = "New Data";
//     record.caseStatus = "New Pending";
//     record.isRechecked = true;  // Add recheck flag
//     record.recheckedAt = new Date();  // Add timestamp for sorting
    
//     await record.save();

//     res.status(200).json({ 
//       message: "Record rechecked successfully!",
//       recheckedRecord: record 
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to recheck data." });
//   }
// };

exports.deleteRow = async (req, res) => {
  const { caseIds } = req.body;
  // console.log("Deleting caseIds:", caseIds);

  try {
    if (!caseIds || !Array.isArray(caseIds)) {
      // console.log("caseIds array is required");
      return res
        .status(400)
        .json({ success: false, message: "caseIds array is required" });
    }

    // First find the records to be deleted
    const recordsToDelete = await KYC.find({ caseId: { $in: caseIds } });

    // Store them in a DeletedItems collection
    if (recordsToDelete.length > 0) {
      await DeletedItems.insertMany(recordsToDelete);
    }

    // Then delete from main collection
    const response = await KYC.deleteMany({ caseId: { $in: caseIds } });
    // console.log("Delete response:", response);

    if (response.deletedCount === 0) {
      // console.log("No records were deleted for caseIds:", caseIds);
      return res
        .status(400)
        .json({ success: false, message: "No records were deleted!" });
    }

    // console.log("Records deleted successfully:", response.deletedCount);
    return res.status(200).json({
      success: true,
      message: `${response.deletedCount} record(s) deleted successfully!`,
      deletedCount: response.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting records:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete records." });
  }
};
exports.deletedItems = async (req, res) => {
  try {
    const { 
      role, 
      userId, 
      name,
      page = 1,
      pageSize = 50,
      searchQuery = "",
      product,
      productType,
      status,
      caseStatus
    } = req.query;

    const skip = (page - 1) * pageSize;
    let query = {}; // Empty query for dedicated deleted items collection

    // Role-based filtering if needed
    if (role === "employee") {
      query.userId = userId;
    } else if (role === "client") {
      const user = await User.findOne({ userId });
      query.$or = [
        { userId: user.userId },
        { clientCode: user.clientCode }
      ];
    }

    // Search and other filters
    if (searchQuery) {
      query.$or = [
        { caseId: { $regex: searchQuery, $options: 'i' } },
        { accountNumber: { $regex: searchQuery, $options: 'i' } },
        { name: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    if (product) query.product = product;
    if (productType) query.productType = productType;
    if (status) query.status = status;
    if (caseStatus) query.caseStatus = caseStatus;

    const totalCount = await DeletedItems.countDocuments(query);
    const deletedItems = await DeletedItems.find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    res.status(200).json({
      deletedItems,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    console.error("Error fetching deleted items:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch deleted items.",
      error: error.message
    });
  }
};

// exports.deletedItems = async (req, res) => {
//   try {
//     const { 
//       role, 
//       userId, 
//       name,
//       page = 1,
//       pageSize = 50,
//       searchQuery = "",
//       // Add any filter parameters you need
//       product,
//       productType,
//       status,
//       caseStatus
//     } = req.query;

//     const skip = (page - 1) * pageSize;
    
//     // Build the base query
//     let query = { isDeleted: true }; // Ensure only deleted items
    
//     // Role-based filtering
//     if (role === "employee") {
//       query.userId = userId;
//     } else if (role === "client") {
//       const user = await User.findOne({ userId });
//       if (!user) {
//         return res.status(404).json({ success: false, message: "User not found" });
//       }
//       query = {
//         $or: [
//           { userId: user.userId },
//           { clientCode: user.clientCode }
//         ],
//         isDeleted: true
//       };
//     }

//     // Search functionality
//     if (searchQuery) {
//       query.$or = [
//         { caseId: { $regex: searchQuery, $options: 'i' } },
//         { accountNumber: { $regex: searchQuery, $options: 'i' } },
//         { name: { $regex: searchQuery, $options: 'i' } }
//       ];
//     }

//     // Apply filters
//     if (product) query.product = product;
//     if (productType) query.productType = productType;
//     if (status) query.status = status;
//     if (caseStatus) query.caseStatus = caseStatus;

//     // Get both the data and total count
//     const [deletedItems, totalCount] = await Promise.all([
//       DeletedItems.find(query)
//         .sort({ _id: -1 })
//         .skip(skip)
//         .limit(parseInt(pageSize)),
//       DeletedItems.countDocuments(query)
//     ]);
//     console.log("deletedItems:",deletedItems)

//     res.status(200).json({
//       deletedItems,
//       pagination: {
//         total: totalCount,
//         page: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalPages: Math.ceil(totalCount / pageSize)
//       }
//     });
//   } catch (error) {
//     console.error("Error fetching deleted items:", error);
//     res.status(500).json({ 
//       success: false, 
//       message: "Failed to fetch deleted items." 
//     });
//   }
// };
// exports.deletedItems = async (req, res) => {
//   try {
//     const { role, userId, name } = req.query;

//     // Add any filtering logic you need based on role/user
//     let query = {};
//     if (role === "employee") {
//       query.userId = userId;
//     }
//     // Add other role-based filters as needed

//     const deletedItems = await DeletedItems.find(query).sort({ _id: -1 });;
//     res.status(200).json(deletedItems);
//   } catch (error) {
//     console.error("Error fetching deleted items:", error);
//     res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch deleted items." });
//   }
// };

exports.deletePermanently = async (req, res) => {
  const { caseIds } = req.body;

  if (!caseIds || !Array.isArray(caseIds)) {
    return res
      .status(400)
      .json({ success: false, message: "caseIds array is required" });
  }

  try {
    const deleteArchivedResult = await DeletedItems.deleteMany({
      caseId: { $in: caseIds },
    });

    return res.status(200).json({
      success: true,
      message: `Archived: ${deleteArchivedResult.deletedCount})`,
      deletedFromArchive: deleteArchivedResult.deletedCount,
    });
  } catch (error) {
    console.error("Error in permanent deletion:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete records",
      error: error.message,
    });
  }
};

exports.restoreRecords = async (req, res) => {
  const { caseIds } = req.body;

  if (!caseIds || !Array.isArray(caseIds)) {
    return res
      .status(400)
      .json({ success: false, message: "caseIds array is required" });
  }

  try {
    // Find the records in DeletedItems collection
    const recordsToRestore = await DeletedItems.find({
      caseId: { $in: caseIds },
    });

    if (recordsToRestore.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No records found to restore" });
    }

    // Insert them back to main collection
    await KYC.insertMany(recordsToRestore);

    // Remove from DeletedItems
    await DeletedItems.deleteMany({ caseId: { $in: caseIds } });

    return res.status(200).json({
      success: true,
      message: `${recordsToRestore.length} record(s) restored successfully`,
      restoredCount: recordsToRestore.length,
    });
  } catch (error) {
    console.error("Error restoring records:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore records",
      error: error.message,
    });
  }
};


////////////////---Real Time Updates----//////////////////

// Add these exports to your kycController.js

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await fetchDashboardStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

// Case distribution endpoint
exports.getCaseStatusDistribution = async (req, res) => {
  try {
    const distribution = await getCaseStatusDistribution();
    res.json({ success: true, distribution });
  } catch (error) {
    console.error("Distribution error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch distribution" });
  }
};

// Recent activity endpoint
exports.getRecentActivity = async (req, res) => {
  try {
    const activity = await getRecentActivity();
    res.json({ success: true, activity });
  } catch (error) {
    console.error("Activity error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activity" });
  }
};
exports.getVerificationTrendsData = async (req,res) =>{
  try {
    const trends = await getVerificationTrendsData();
    res.json({ success: true, trends });
  } catch (error) {
    console.error("Activity error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activity" });
  }
}

// Manual update trigger
exports.sendManualUpdate = async (req, res) => {
  try {
    await sendDashboardUpdates(getIo());
    res.json({ success: true, message: "Update sent" });
  } catch (error) {
    console.error("Manual update error:", error);
    res.status(500).json({ success: false, message: "Update failed" });
  }
};


exports.getCaseDetails = async (req, res) => {
  try {
    const { type, clientType, clientCode, product, download,search } = req.query;
    
    let query = {};
    
    // Apply filters based on the hierarchy level
    if (type === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: today };
    } 
    if (type === 'New Pending') {
      query.caseStatus = 'New Pending';
    }
    if (type === 'closed') {
      query.status = 'Closed';
    }
    if (type === 'highPriority') {
      query.priority = 'High';
    }
    
    if (clientType) {
      query.clientType = clientType;
    }
    
    if (clientCode) {
      query.clientCode = clientCode;
    }
    
    if (product) {
      query.product = product;
    }
    
    if (search) {
      query.$or = [
        { caseId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { clientType: { $regex: search, $options: 'i' } },
        { clientCode: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { caseStatus: { $regex: search, $options: 'i' } },
        { priority: { $regex: search, $options: 'i' } }
      ];
    }

    // For download requests, return the raw data in Excel format
    if (download) {
      const cases = await KYC.find(query).lean();
      
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(cases);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "CaseDetails");
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for download
      res.setHeader('Content-Disposition', 'attachment; filename="CaseDetails.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    // For regular requests, return aggregated data
    if (product) {
      // Product details level - return individual cases
      const cases = await KYC.find(query);
      return res.json({ success: true, data: cases, records: cases });
    } else if (clientCode) {
      // Product level - group by product
      const products = await KYC.aggregate([
        { $match: query },
        { 
          $group: { 
            _id: '$product',
            count: { $sum: 1 },
            // Include sample document for additional fields if needed
            sampleDoc: { $first: '$$ROOT' } 
          } 
        },
        { 
          $project: { 
            name: '$_id', 
            count: 1,
            // Include other fields you want to search by
            clientType: '$sampleDoc.clientType',
            clientCode: '$sampleDoc.clientCode',
            _id: 0 
          } 
        }
      ]);
      // const products = await KYC.aggregate([
      //   { $match: query },
      //   { $group: { _id: '$product', count: { $sum: 1 } } },
      //   { $project: { name: '$_id', count: 1, _id: 0 } }
      // ]);
      const records = await KYC.find(query);
      return res.json({ success: true, data: products, records });
    } else if (clientType) {
      // Client code level - group by client code
      const clientCodes = await KYC.aggregate([
        { $match: query },
        { $group: { _id: '$clientCode', count: { $sum: 1 } } },
        { $project: { name: '$_id', count: 1, _id: 0 } }
      ]);
      const records = await KYC.find(query);
      return res.json({ success: true, data: clientCodes, records });
    } else {
      // Client type level - group by client type
      const clientTypes = await KYC.aggregate([
        { $match: query },
        { $group: { _id: '$clientType', count: { $sum: 1 } } },
        { $project: { name: '$_id', count: 1, _id: 0 } }
      ]);
      const records = await KYC.find(query);
      return res.json({ success: true, data: clientTypes, records });
    }
  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Helper function for Excel export
function exportToExcel(res, data, filters) {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cases");
    
    const filename = [
      filters.type,
      filters.clientType || '',
      filters.clientCode || '',
      filters.product || ''
    ].filter(Boolean).join('_') + '.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return res.send(buffer);
  } catch (error) {
    console.error("Export error:", error);
    throw error;
  }
}


/////////////////Attachment//////////////////////////



exports.uploadSingleAttachment = async (req, res) => {
  try {
    const { caseId } = req.body;
    const file = req.file;
    console.log("Initial file info:", file);

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!caseId) {
      return res.status(400).json({ 
        success: false, 
        message: "Case ID is required"
      });
    }

    // Verify actual file size if the reported size is 0
    let actualSize = file.size;
    if (file.size === 0) {
      actualSize = await verifyS3UploadSize(file.key);
      console.log("Verified actual size:", actualSize);
      
      if (actualSize === null) {
        console.warn("Could not verify file size in S3, using reported size (0)");
        actualSize = 0;
      }
    }

    const attachment = {
      caseId,
      filename: file.originalname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: actualSize, // Use verified size
      location: file.location,
      key: file.key,
      uploadedAt: getFormattedDateTime(),
      etag: file.etag
    };

    const result = await KYC.updateOne(
      { caseId },
      { $push: { attachments: attachment } }
    );

    res.status(201).json({ 
      success: true, 
      message: "File uploaded successfully",
      attachment: {
        ...attachment,
        size: actualSize // Ensure the response shows correct size
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ 
      success: false, 
      message: "File upload failed",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Function to verify object exists in S3

// Helper: Delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Verify S3 key exists + get size, with retries
async function verifyS3KeyExistsWithRetry(key, retries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const head = await s3.send(new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }));
      return head.ContentLength || 0; // ✅ Return size in bytes
    } catch (error) {
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        if (attempt < retries) {
          console.warn(`S3 key not found (attempt ${attempt}/${retries}) — retrying in ${delayMs}ms`);
          await delay(delayMs);
        } else {
          return null; // After retries, still not found
        }
      } else {
        throw error;
      }
    }
  }
  return null;
}

exports.uploadAttachment = async (req, res) => {
  try {
    // Parse case IDs
    let caseIds = Array.isArray(req.body.caseIds)
      ? req.body.caseIds
      : [req.body.caseIds].filter(Boolean);

    if (caseIds.length === 0 && typeof req.body.caseIds === 'string') {
      try {
        caseIds = JSON.parse(req.body.caseIds);
      } catch {
        caseIds = req.body.caseIds.split(',').map(id => id.trim());
      }
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }
    if (!caseIds.length) {
      return res.status(400).json({ success: false, message: "Invalid case IDs" });
    }

    const uploadedAttachments = [];
    const errors = [];

    for (const file of files) {
      try {
        // ✅ Get actual size from S3 (even if file.size = 0 locally)
        let actualSize = file.size;
        const s3Size = await verifyS3KeyExistsWithRetry(file.key, 3, 500);

        if (!s3Size) {
          errors.push({ filename: file.originalname, error: "File not found in S3 after upload" });
          continue;
        }
        if (file.size === 0) {
          actualSize = s3Size; // Fix 0 MB issue
        }

        // Prepare attachment metadata
        const attachment = {
          filename: file.originalname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: actualSize,
          location: file.location,
          key: file.key,
          uploadedAt: getFormattedDateTime(),
          etag: file.etag
        };

        // Save to DB
        const result = await KYC.updateMany(
          { caseId: { $in: caseIds } },
          { $push: { attachments: attachment } }
        );

        // Generate a pre-signed URL for download
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: file.key,
        });
        
        // const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour expiration

        uploadedAttachments.push({
          name: file.originalname,
          key: file.key,
          size: actualSize,
          // downloadUrl: downloadUrl,
          location: file.location
        });

      } catch (err) {
        errors.push({ filename: file.originalname, error: err.message });
      }
    }

    const response = {
      success: errors.length === 0,
      message: `Processed ${uploadedAttachments.length} file(s) successfully`,
      uploadedFiles: uploadedAttachments,
      caseIds: caseIds
    };

    if (errors.length) {
      response.errors = errors;
      response.message += `, with ${errors.length} error(s)`;
    }

    res.status(errors.length ? 207 : 201).json(response);

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message
    });
  }
};

// exports.uploadAttachment = async (req, res) => {
//   try {
//     // Parse case IDs
//     let caseIds = Array.isArray(req.body.caseIds)
//       ? req.body.caseIds
//       : [req.body.caseIds].filter(Boolean);

//     if (caseIds.length === 0 && typeof req.body.caseIds === 'string') {
//       try {
//         caseIds = JSON.parse(req.body.caseIds);
//       } catch {
//         caseIds = req.body.caseIds.split(',').map(id => id.trim());
//       }
//     }

//     const files = req.files;
//     if (!files || files.length === 0) {
//       return res.status(400).json({ success: false, message: "No files uploaded" });
//     }
//     if (!caseIds.length) {
//       return res.status(400).json({ success: false, message: "Invalid case IDs" });
//     }

//     const uploadedAttachments = [];
//     const errors = [];

//     for (const file of files) {
//       try {
//         // ✅ Get actual size from S3 (even if file.size = 0 locally)
//         let actualSize = file.size;
//         const s3Size = await verifyS3KeyExistsWithRetry(file.key, 3, 500);

//         if (!s3Size) {
//           errors.push({ filename: file.originalname, error: "File not found in S3 after upload" });
//           continue;
//         }
//         if (file.size === 0) {
//           actualSize = s3Size; // Fix 0 MB issue
//         }

//         // Prepare attachment metadata
//         const attachment = {
//           filename: file.originalname,
//           originalname: file.originalname,
//           mimetype: file.mimetype,
//           size: actualSize,
//           location: file.location,
//           key: file.key,
//           uploadedAt: getFormattedDateTime(),
//           etag: file.etag
//         };

//         // Save to DB
//         const result = await KYC.updateMany(
//           { caseId: { $in: caseIds } },
//           { $push: { attachments: attachment } }
//         );

//         uploadedAttachments.push({
//           filename: file.originalname,
//           status: 'success',
//           modifiedCount: result.modifiedCount
//         });

//       } catch (err) {
//         errors.push({ filename: file.originalname, error: err.message });
//       }
//     }

//     const response = {
//       success: errors.length === 0,
//       message: `Processed ${uploadedAttachments.length} file(s) successfully`,
//       uploaded: uploadedAttachments,
//       caseIds: caseIds
//       // uploaded: uploadedAttachments
//     };

//     if (errors.length) {
//       response.errors = errors;
//       response.message += `, with ${errors.length} error(s)`;
//     }

//     res.status(errors.length ? 207 : 201).json(response);

//   } catch (error) {
//     console.error("Upload error:", error);
//     res.status(500).json({
//       success: false,
//       message: "File upload failed",
//       error: error.message
//     });
//   }
// };


exports.downloadAttachment = async (req, res) => {
  try {
    const { caseId, filename } = req.params;
    
    // Find the document with matching caseId and filename
    const kycDoc = await KYC.findOne(
      { caseId, "attachments.originalname": filename },
      { "attachments.$": 1 }
    );

    if (!kycDoc || !kycDoc.attachments || kycDoc.attachments.length === 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const attachment = kycDoc.attachments[0];

    // If file is stored in S3 (preferred approach)
    if (attachment.key) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME || 'rvsdoc',
          Key: attachment.key
        });

        // Get the object from S3
        const response = await s3.send(command);

        // Set proper headers
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(attachment.originalname)}`);
        res.setHeader('Content-Type', attachment.mimetype);
        res.setHeader('Content-Length', attachment.size);

        // Stream the file directly from S3 to the client
        response.Body.pipe(res);
        return;
      } catch (s3Error) {
        console.error('S3 Download Error:', s3Error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to download from S3',
          error: s3Error.message 
        });
      }
    }

    // Fallback to local file system (only if not using S3)
    if (attachment.path) {
      const filePath = path.join(__dirname, '..', attachment.path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          success: false, 
          message: 'File not found on server' 
        });
      }

      res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(attachment.originalname)}`);
      res.setHeader('Content-Type', attachment.mimetype);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    return res.status(404).json({ 
      success: false, 
      message: 'Attachment location not specified' 
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Download failed',
      error: error.message 
    });
  }
};


// // Get Attachments (Simplified)
exports.getAttachments = async (req, res) => {
  try {
    const { caseId } = req.query;
    
    if (!caseId) return res.status(400).send('caseId required');

    const kycDoc = await KYC.findOne(
      { caseId },
      { attachments: 1 }
    );

    res.json(kycDoc?.attachments || []);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).send('Failed to get attachments');
  }
};

// Delete Attachment (Simplified)

exports.deleteAttachment = async (req, res) => {
  try {
    const { caseId, filename } = req.params;
    // console.log(`Attempting to delete attachment: ${filename} for case: ${caseId}`);

    // 1. Find the attachment first to get its details
    const kycDoc = await KYC.findOne(
      { caseId, "attachments.filename": filename },
      { "attachments.$": 1 }
    );

    if (!kycDoc?.attachments?.length) {
      // console.log('Attachment not found in database');
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment not found in database' 
      });
    }

    const attachment = kycDoc.attachments[0];
    // console.log('Found attachment:', attachment);

    // 2. Delete from S3 if key exists
    // if (attachment.key) {
    //   try {
    //     // console.log(`Deleting from S3 with key: ${attachment.key}`);
    //     const deleteCommand = new DeleteObjectCommand({
    //       Bucket: process.env.AWS_BUCKET_NAME || 'rvsdoc',
    //       Key: attachment.key
    //     });
    //     await s3.send(deleteCommand);
    //     // console.log('Successfully deleted from S3');
    //   } catch (s3Error) {
    //     console.error('S3 Delete Error:', s3Error);
    //     // Continue with DB deletion even if S3 deletion fails
    //   }
    // } 
    // 3. Fallback to local file deletion if path exists
     if (attachment.path) {
      try {
        const filePath = path.resolve(attachment.path);
        if (fs.existsSync(filePath)) {
          // console.log(`Deleting local file at: ${filePath}`);
          fs.unlinkSync(filePath);
          // console.log('Successfully deleted local file');
        }
      } catch (fsError) {
        console.error('File System Delete Error:', fsError);
        // Continue with DB deletion even if file deletion fails
      }
    }

    // 4. Remove from database
    const updateResult = await KYC.updateOne(
      { caseId },
      { $pull: { attachments: { filename } } }
    );

    if (updateResult.modifiedCount === 0) {
      // console.log('No document was modified - attachment may not exist');
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment not found in database' 
      });
    }

    // console.log('Successfully deleted attachment from database');
    res.json({ 
      success: true, 
      message: 'Attachment deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Delete failed',
      error: error.message 
    });
  }
};
// ****************-Verify Download-*******************

// Add to your backend controller
exports.verifyFile = async (req, res) => {
  try {
    const { key, caseIds } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: "File key is required" });
    }
    
    // Verify the file exists in S3
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      });
      
      const headResult = await s3.send(headCommand);
      
      // Verify the file is associated with the case IDs
      if (caseIds && caseIds.length > 0) {
        const casesWithFile = await KYC.countDocuments({
          caseId: { $in: caseIds },
          'attachments.key': key
        });
        
        if (casesWithFile === 0) {
          return res.status(404).json({
            error: "File uploaded but not associated with cases",
            existsInS3: true,
            associatedWithCases: false
          });
        }
      }
      
      // Generate a pre-signed URL for download
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      });
      
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour expiration
      
      res.json({
        exists: true,
        key: key,
        size: headResult.ContentLength,
        lastModified: headResult.LastModified,
        url: url,
        associatedWithCases: caseIds ? true : undefined
      });
    } catch (error) {
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        res.status(404).json({
          exists: false,
          key: key,
          error: "File not found in S3"
        });
      } else if (error.name === 'AccessDenied') {
        res.status(403).json({
          exists: false,
          key: key,
          error: "Access denied to file"
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("File verification error:", error);
    res.status(500).json({
      error: "Failed to verify file",
      message: error.message
    });
  }
};

// Add a download endpoint that handles authorization properly
exports.downloadFile = async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({ error: "File key is required" });
    }
    
    // Verify the user has access to this file
    // You might want to add additional authorization checks here
    
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });
    
    const { Body, ContentType } = await s3.send(command);
    
    // Set appropriate headers
    res.setHeader('Content-Type', ContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    
    // Stream the file
    Body.pipe(res);
  } catch (error) {
    console.error("File download error:", error);
    
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.status(500).json({ error: "Download failed", message: error.message });
  }
};
/////////////////--Deduce---///////////////////////

// exports.similarRecords = async (req,res) => {

//   console.log("hello")

//   try {
//     const { product, accountNumber, requirement, caseId } = req.body;

//     console.log(`product${product}`,`accountNumber${accountNumber}`,`requirement${requirement}`,`caseId${caseId}`)
    
//     // Find records with same product and account number, excluding current record
//     const similarRecords = await KYC.find({
//       product,
//       accountNumber,
//       requirement,
//       caseId: { $ne: caseId } // Exclude current record
//     })
//     .sort({ createdAt: -1 })
//     .limit(10);
    

//     res.json({ success: true, records: similarRecords });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// }


// exports.updateSimilarRecord = async (req,res) => {
//   console.log("hello")
//   try {
//     const { caseId, updates } = req.body;
//     console.log("updates:",updates)
    
//     // Preserve certain fields while allowing others to be updated
//     const record = await KYC.findOneAndUpdate(
//       { caseId },
//       { 
//         $set: updates,
//         $currentDate: { updatedAt: true }
//       },
//       { new: true }
//     );

//     res.json({ success: true, record });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// }


// New endpoint for batch deduce

exports.similarRecords = async (req, res) => {
  try {
    const { 
      userId,
      page = 1, 
      pageSize = 50,
      searchQuery = "",
      // Filter parameters
      product,
      productType,
      status,
      caseStatus,
      dateInStart,
      dateInEnd,
      dateOutStart,
      dateOutEnd,
      sentDate,
      vendorStatus,
      priority,
      clientType,
      ...filters
    } = req.body;

    const skip = (page - 1) * pageSize;

    // Verify user exists
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Base query for duplicates
    let query = { isDedup: true };
    
    // Role-specific filtering
    if (user.role === "employee") {
      query.listByEmployee = user.name;
    }

    // Search functionality
    if (searchQuery) {
  const regex = { $regex: searchQuery, $options: "i" };

  query.$or = [
    { caseId: regex },
    { userId: regex },
    { remarks: regex },
    { name: regex },
    { details: regex },
    { details1: regex },
    { priority: regex },
    { correctUPN: regex },
    { product: regex },
    { updatedProductName: regex },
    { accountNumber: regex },
    { requirement: regex },
    { updatedRequirement: regex },
    { accountNumberDigit: regex },
    { bankCode: regex },
    { clientCode: regex },
    { vendorName: regex },
    { dateIn: regex },
    { dateInDate: regex },
    { status: regex },
    { caseStatus: regex },
    { productType: regex },
    { listByEmployee: regex },
    { dateOut: regex },
    { dateOutInDay: regex },
    { sentBy: regex },
    { autoOrManual: regex },
    { caseDoneBy: regex },
    { clientTAT: regex },
    { customerCare: regex },
    { sentDate: regex },
    { sentDateInDay: regex },
    { clientType: regex },
    { dedupBy: regex },
    { vendorRate: regex },
    { clientRate: regex },
    { NameUploadBy: regex },
    { ReferBy: regex },
    { ipAddress: regex },
    { vendorStatus: regex },
    { year: regex },
    { month: regex },
    { role: regex },
    { "attachments.filename": regex },
    { "attachments.originalname": regex },
    { "attachments.key": regex }
  ];
}

    // Apply filters
    if (product) query.product = product;
    if (productType) query.productType = productType;
    if (status) query.status = status;
    if (caseStatus) query.caseStatus = caseStatus;
    if (vendorStatus) query.vendorStatus = vendorStatus;
    if (priority) query.priority = priority;
    if (clientType) query.clientType = clientType;

    // Date range filters
    if (dateInStart || dateInEnd) {
      if (dateInStart && dateInEnd) {
        const startDate = moment(dateInStart, "DD-MM-YYYY").format("DD-MM-YYYY");
        const endDate = moment(dateInEnd, "DD-MM-YYYY").format("DD-MM-YYYY");
        
        if (startDate === endDate) {
          query.dateIn = { $regex: `^${startDate}` };
        } else {
          query.$and = [
            { 
              dateIn: { 
                $gte: `${startDate}, 00:00:00 AM`,
                $lte: `${endDate}, 11:59:59 PM`
              }
            }
          ];
        }
      } else if (dateInStart) {
        const dateStr = moment(dateInStart, "DD-MM-YYYY").format("DD-MM-YYYY");
        query.dateIn = { $regex: `^${dateStr}` };
      } else if (dateInEnd) {
        const dateStr = moment(dateInEnd, "DD-MM-YYYY").format("DD-MM-YYYY");
        query.dateIn = { $lte: `${dateStr}, 11:59:59 PM` };
      }
    }

    // Date Out filter (same pattern as dateIn)
    if (dateOutStart || dateOutEnd) {
  // Initialize dateOut filter object
  const dateOutFilter = {};
  
  // Format dates consistently
  const startDateStr = dateOutStart ? moment(dateOutStart, "DD-MM-YYYY").format("DD-MM-YYYY") : null;
  const endDateStr = dateOutEnd ? moment(dateOutEnd, "DD-MM-YYYY").format("DD-MM-YYYY") : null;

  // Case 1: Both start and end dates provided
  if (startDateStr && endDateStr) {
    if (startDateStr === endDateStr) {
      // Single day match - use regex for exact day
      dateOutFilter.$regex = `^${startDateStr}`;
    } else {
      // Date range - use string comparison
      dateOutFilter.$gte = `${startDateStr}, 00:00:00 AM`;
      dateOutFilter.$lte = `${endDateStr}, 11:59:59 PM`;
    }
  }
  // Case 2: Only start date provided
  else if (startDateStr) {
    dateOutFilter.$regex = `^${startDateStr}`;
  }
  // Case 3: Only end date provided
  else if (endDateStr) {
    dateOutFilter.$lte = `${endDateStr}, 11:59:59 PM`;
  }

  // Only apply the filter if we have valid conditions
  if (Object.keys(dateOutFilter).length > 0) {
    // Exclude empty dateOut values and apply the filter
    query.dateOut = {
      ...dateOutFilter,
      $ne: "", // Exclude empty values
      $exists: true // Ensure field exists
    };

    // For range queries, we need to ensure we don't match invalid date strings
    if (dateOutFilter.$gte || dateOutFilter.$lte) {
      query.dateOut.$regex = /^\d{2}-\d{2}-\d{4}, \d{2}:\d{2}:\d{2} [AP]M$/;
    }
  }
}

    if (sentDate) {
      query.sentDate = {
        $regex: `^${sentDate}`,
        $options: 'i'
      };
    }

    // Additional filters from spread
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        query[key] = { $in: value };
      }
    });

    // Get column order for this role
    const config = await ColumnConfig.findOne({ role: user.role });
    let columnOrder = config?.columnOrder || Object.keys(KYC.schema.paths)
      .filter(field => !['_id', '__v', 'createdAt', 'userId', 'updatedAt'].includes(field));

    // Build projection
    const projection = {};
    columnOrder.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 0;

    // Find potential duplicates
    const records = await KYC.find(query, projection)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    // Count total records
    const totalCount = await KYC.countDocuments(query);

    // Group by product and accountNumber to identify duplicates
    const grouped = {};
    records.forEach(record => {
      const key = `${record.updatedProductName}|${record.accountNumber}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    });

    // Filter groups with duplicates and apply colors
    const duplicates = Object.values(grouped)
      .filter(group => group.length > 1)
      .map((group, groupIndex) => {
        return group.map((record, recordIndex) => ({
          ...record._doc,
          _dedupColor: (groupIndex + recordIndex) % 2 === 0 ? 'blue' : 'green'
        }));
      });

    // Flatten the duplicates array
    const flatDuplicates = duplicates.flat();

    res.json({
  success: true,
  data: flatDuplicates, // Changed from 'duplicates' to 'data'
  pagination: {
    total: totalCount,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    totalPages: Math.ceil(totalCount / pageSize),
    totalDuplicates: flatDuplicates.length,
    totalGroups: duplicates.length
  }
});

  } catch (error) {
    console.error("Error finding similar records:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// exports.similarRecords = async (req, res) => {
//   try {
//     const { 
//       userId,
//       role,
//       name,
//       page = 1, 
//       pageSize = 50,
//       searchQuery = "",
//       // Filter parameters
//       product,
//       productType,
//       status,
//       caseStatus,
//       dateInStart,
//       dateInEnd,
//       dateOutStart,
//       dateOutEnd,
//       sentDate,
//       vendorStatus,
//       priority,
//       clientType,
//       ...filters
//     } = req.query;

//     const skip = (page - 1) * pageSize;

//     // Get column order for this role
//     const config = await ColumnConfig.findOne({ role });
//     let columnOrder = config?.columnOrder;
    
//     if (!columnOrder) {
//       // Fallback to all fields if no config exists
//       columnOrder = Object.keys(KYC.schema.paths).filter(
//         field => !['_id', '__v', 'createdAt','userId', 'updatedAt'].includes(field)
//       );
//     }
    
//     // Build projection based on column order
//     const projection = {};
//     columnOrder.forEach(field => {
//       projection[field] = 1;
//     });
//     projection._id = 0;

//     let query = { isDedup: true };

//     // Verify user exists
//     const user = await User.findOne({ userId });
//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "User not found"
//       });
//     }

//     // Role-based filtering
//     if (role === "employee") {
//       query.listByEmployee = user.name;
//     }

//     // Search functionality
//     if (searchQuery) {
//       const regex = { $regex: searchQuery, $options: "i" };

//       query.$or = [
//         { caseId: regex },
//         { userId: regex },
//         { remarks: regex },
//         { name: regex },
//         { details: regex },
//         { details1: regex },
//         { priority: regex },
//         { correctUPN: regex },
//         { product: regex },
//         { updatedProductName: regex },
//         { accountNumber: regex },
//         { requirement: regex },
//         { updatedRequirement: regex },
//         { accountNumberDigit: regex },
//         { bankCode: regex },
//         { clientCode: regex },
//         { vendorName: regex },
//         { dateIn: regex },
//         { dateInDate: regex },
//         { status: regex },
//         { caseStatus: regex },
//         { productType: regex },
//         { listByEmployee: regex },
//         { dateOut: regex },
//         { dateOutInDay: regex },
//         { sentBy: regex },
//         { autoOrManual: regex },
//         { caseDoneBy: regex },
//         { clientTAT: regex },
//         { customerCare: regex },
//         { sentDate: regex },
//         { sentDateInDay: regex },
//         { clientType: regex },
//         { dedupBy: regex },
//         { vendorRate: regex },
//         { clientRate: regex },
//         { NameUploadBy: regex },
//         { ReferBy: regex },
//         { ipAddress: regex },
//         { vendorStatus: regex },
//         { year: regex },
//         { month: regex },
//         { role: regex },
//         { "attachments.filename": regex },
//         { "attachments.originalname": regex },
//         { "attachments.key": regex }
//       ];
//     }

//     // Apply filters
//     if (product) query.product = product;
//     if (productType) query.productType = productType;
//     if (status) query.status = status;
//     if (caseStatus) query.caseStatus = caseStatus;
//     if (vendorStatus) query.vendorStatus = vendorStatus;
//     if (priority) query.priority = priority;
//     if (clientType) query.clientType = clientType;

//     // Date In range filter
//     if (dateInStart || dateInEnd) {
//       if (dateInStart && dateInEnd) {
//         // RANGE QUERY - handle as string comparison
//         const startDate = moment(dateInStart, "DD-MM-YYYY").format("DD-MM-YYYY");
//         const endDate = moment(dateInEnd, "DD-MM-YYYY").format("DD-MM-YYYY");
        
//         if (startDate === endDate) {
//           // Single day
//           query.dateIn = { $regex: `^${startDate}` };
//         } else {
//           // Date range - compare as strings
//           query.$and = [
//             { 
//               dateIn: { 
//                 $gte: `${startDate}, 00:00:00 AM`,
//                 $lte: `${endDate}, 11:59:59 PM`
//               }
//             }
//           ];
//         }
//       }
//       else if (dateInStart) {
//         // Single start date
//         const dateStr = moment(dateInStart, "DD-MM-YYYY").format("DD-MM-YYYY");
//         query.dateIn = { $regex: `^${dateStr}` };
//       }
//       else if (dateInEnd) {
//         // Single end date
//         const dateStr = moment(dateInEnd, "DD-MM-YYYY").format("DD-MM-YYYY");
//         query.dateIn = { $lte: `${dateStr}, 11:59:59 PM` };
//       }
//     }

//     // Date Out range filter
//     if (dateOutStart || dateOutEnd) {
//       const dateOutFilter = {};
      
//       const startDateStr = dateOutStart ? moment(dateOutStart, "DD-MM-YYYY").format("DD-MM-YYYY") : null;
//       const endDateStr = dateOutEnd ? moment(dateOutEnd, "DD-MM-YYYY").format("DD-MM-YYYY") : null;

//       if (startDateStr && endDateStr) {
//         if (startDateStr === endDateStr) {
//           dateOutFilter.$regex = `^${startDateStr}`;
//         } else {
//           dateOutFilter.$gte = `${startDateStr}, 00:00:00 AM`;
//           dateOutFilter.$lte = `${endDateStr}, 11:59:59 PM`;
//         }
//       }
//       else if (startDateStr) {
//         dateOutFilter.$regex = `^${startDateStr}`;
//       }
//       else if (endDateStr) {
//         dateOutFilter.$lte = `${endDateStr}, 11:59:59 PM`;
//       }

//       if (Object.keys(dateOutFilter).length > 0) {
//         query.dateOut = {
//           ...dateOutFilter,
//           $ne: "",
//           $exists: true
//         };

//         if (dateOutFilter.$gte || dateOutFilter.$lte) {
//           query.dateOut.$regex = /^\d{2}-\d{2}-\d{4}, \d{2}:\d{2}:\d{2} [AP]M$/;
//         }
//       }
//     }

//     // Additional filters
//     Object.entries(filters).forEach(([key, value]) => {
//       if (Array.isArray(value) && value.length > 0) {
//         query[key] = { $in: value };
//       }
//     });

//     if (sentDate) {
//       query.sentDate = {
//         $regex: `^${sentDate}`,
//         $options: 'i'
//       };
//     }

//     // Fetch records with pagination
//     const [records, totalCount] = await Promise.all([
//       KYC.find(query, projection)
//         .sort({ _id: -1 })
//         .skip(skip)
//         .limit(parseInt(pageSize)),
//       KYC.countDocuments(query)
//     ]);

//     // Group by product and accountNumber to find duplicates
//     const grouped = {};
//     records.forEach(record => {
//       const key = `${record.updatedProductName}|${record.accountNumber}`;
//       if (!grouped[key]) {
//         grouped[key] = [];
//       }
//       grouped[key].push(record);
//     });
    
//     // Filter groups with duplicates and apply alternating colors
//     const duplicates = Object.values(grouped)
//       .filter(group => group.length > 1)
//       .map((group, groupIndex) => {
//         return group.map((record, recordIndex) => {
//           // Add color flag for frontend highlighting
//           return {
//             ...record._doc,
//             _dedupColor: (groupIndex + recordIndex) % 2 === 0 ? 'blue' : 'green'
//           };
//         });
//       });

//     const orderedData = duplicates.flat().map(doc => orderFields(doc, columnOrder));

//     res.json({
//       success: true,
//       data: orderedData,
//       duplicates: orderedData,
//       totalDuplicates: orderedData.length,
//       totalGroups: duplicates.length,
//       pagination: {
//         total: totalCount,
//         page: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalPages: Math.ceil(totalCount / pageSize)
//       }
//     });
//   } catch (error) {
//     console.error("Error in similarRecords:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };
exports.copyPasteDedup = async (req, res) => {
  try {
    const { sourceRecordToCopy, targetIds, userId, userName } = req.body;
    console.log("sourceRecordToCopy:",sourceRecordToCopy)

    const currentDate = new Date();
    const todayString = currentDate.toISOString().split('T')[0]; // yyyy-mm-dd

    const updates = {
      attachments:sourceRecordToCopy.attachments,
      details:sourceRecordToCopy.details,
      details1:sourceRecordToCopy.details1,
      status: "Closed",
      caseStatus: "Sent",
      vendorName: userName,
      sentDate: getFormattedDateTime(),
      sentDateInDay: getFormattedDateDay(),
      dateOut: getFormattedDateTime(),
      dateOutInDay: getFormattedDateDay(),
      caseDoneBy: userName,
      dedupBy: userName,
      vendorStatus: "Closed",
      sentBy:userName,
      
    };

    const updatedRecords = [];

    for (const targetId of targetIds) {
      const updated = await KYC.findOneAndUpdate(
        { caseId: targetId },
        { $set: updates },
        { new: true }
      );
      if (updated) {
        updatedRecords.push(updated);
      }
    }

    res.json({ success: true, updatedRecords });
  } catch (error) {
    console.error("Copy-paste error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// exports.copyPasteDedup = async (req, res) => {
//   try {
//     const { sourceId, targetIds, fields, userId, userName } = req.body; // changed `targetId` to `targetIds`

//     const source = await KYC.findOne({ caseId: sourceId });
//     if (!source) {
//       return res.status(404).json({ success: false, message: "Source record not found" });
//     }

//     // Validate source is dedup
//     if (!source.isDedup) {
//       return res.status(400).json({ success: false, message: "Source record must be a dedup record" });
//     }

//     const updates = {};
//     fields.forEach(field => {
//       if (source[field] !== undefined) {
//         updates[field] = source[field];
//       }
//     });

//     updates.dedupBy = userName;
//     updates.updatedAt = new Date();

//     const updatedRecords = [];

//     for (const targetId of targetIds) {
//       if (targetId === sourceId) continue; // Skip if same as source

//       const target = await KYC.findOne({ caseId: targetId });

//       if (target && target.isDedup) {
//         const updated = await KYC.findOneAndUpdate(
//           { caseId: targetId },
//           { $set: updates },
//           { new: true }
//         );
//         updatedRecords.push(updated);
//       }
//     }

//     res.json({
//       success: true,
//       updatedRecords
//     });
//   } catch (error) {
//     console.error("Copy-paste error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

function calculateTAT(sentDateStr, dateOutStr) {
  const format = "DD-MM-YYYY, h:mm:ss A";
  const sent = moment(sentDateStr, format);
  const out = moment(dateOutStr, format);

  if (!sent.isValid() || !out.isValid() || out.isBefore(sent)) {
    return "Invalid Date Range";
  }

  const duration = moment.duration(out.diff(sent));
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  const seconds = duration.seconds();

  return `${hours} hours, ${minutes} minutes and ${seconds} seconds`;
}

exports.batchUpdate = async (req, res) => {
  try {
    const { caseIds, updates } = req.body;

    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid caseIds" });
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Invalid updates" });
    }

    const uniqueCaseIds = [...new Set(caseIds.map(id => String(id).trim()).filter(Boolean))];
    const cases = await KYC.find({ caseId: { $in: uniqueCaseIds } });

    if (cases.length === 0) {
      return res.status(404).json({ success: false, message: "No cases found" });
    }

    let updatedCount = 0;
    let clientTATUpdates = 0;
    const errors = [];
    const updatedCaseIds = [];

    for (const caseDoc of cases) {
      try {
        const updateFields = {};
        let hasChanges = false;

        for (const [key, value] of Object.entries(updates)) {
          if (caseDoc[key] !== value) {
            hasChanges = true;
            updateFields[key] = value;
          }
        }

        if (!hasChanges) continue;

        updateFields.updatedAt = getFormattedDateTime();

        // Handle caseStatus = Sent
        if (updates.caseStatus === "Sent") {
          if (!updates.sentBy) updateFields.sentBy = "System";
          if (!updates.sentDate) updateFields.sentDate = getFormattedDateTime();
        }

        // ✅ Calculate clientTAT if both sentDate and dateOut are available
        const sentDate = updates.sentDate || caseDoc.sentDate;
        const dateOut = updates.dateOut || caseDoc.dateOut;

        if (sentDate && dateOut) {
          const tat = calculateTAT(sentDate, dateOut);
          if (tat !== "Invalid Date Range") {
            updateFields.clientTAT = tat;
            clientTATUpdates++;
          }
        }

        // Update in DB
        const result = await KYC.updateOne(
          { _id: caseDoc._id },
          { $set: updateFields }
        );

        if (result.modifiedCount > 0 && !updatedCaseIds.includes(caseDoc.caseId)) {
          updatedCount++;
          updatedCaseIds.push(caseDoc.caseId);
        }

      } catch (error) {
        errors.push(`Failed to update case ${caseDoc.caseId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Processed ${uniqueCaseIds.length} records`,
      updatedCount,
      updatedCaseIds,
      clientTATUpdates,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Batch update error:", error);
    res.status(500).json({
      success: false,
      message: "Batch update failed",
      error: error.message
    });
  }
};

// exports.batchUpdate = async (req, res) => {
//   try {
//     const { caseIds, updates } = req.body;
    
//     // Validate input
//     if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
//       return res.status(400).json({ success: false, message: "Invalid caseIds" });
//     }
    
//     if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
//       return res.status(400).json({ success: false, message: "Invalid updates" });
//     }

//     // Normalize and deduplicate caseIds
//     const uniqueCaseIds = [...new Set(caseIds.map(id => String(id).trim()).filter(Boolean))];
    
//     // Get all cases in a single query
//     const cases = await KYC.find({ caseId: { $in: uniqueCaseIds } });
    
//     if (cases.length === 0) {
//       return res.status(404).json({ success: false, message: "No cases found" });
//     }

//     let updatedCount = 0;
//     let clientTATUpdates = 0;
//     const errors = [];
//     const updatedCaseIds = [];

//     // Process each case
//     for (const caseDoc of cases) {
//       try {
//         // Check for actual changes
//         const updateFields = {};
//         let hasChanges = false;
        
//         for (const [key, value] of Object.entries(updates)) {
//           if (caseDoc[key] !== value) {
//             hasChanges = true;
//             updateFields[key] = value;
//           }
//         }

//         if (!hasChanges) continue;

//         // Add metadata
//         updateFields.updatedAt = getFormattedDateTime();

//         // Handle Closed status
//         if ((updates.status === "Closed" || updates.vendorStatus === "Closed")) {
//           const startDate = caseDoc.sentDate ? parseCustomDateTime(caseDoc.sentDate) : null;
//           const endDate = moment().toISOString();

//           if (startDate && endDate) {
//             const tat = calculateTAT(startDate, endDate);
//             if (tat !== 'N/A' && tat !== 'Invalid Date Range') {
//               updateFields.clientTAT = tat;
//               clientTATUpdates++;
//             }
//           }
//         }

//         // Handle Sent status
//         if (updates.caseStatus === "Sent") {
//           if (!updates.sentBy) updateFields.sentBy = "System";
//           if (!updates.sentDate) updateFields.sentDate = getFormattedDateTime();
//         }

//         // Perform update
//         const result = await KYC.updateOne(
//           { _id: caseDoc._id }, 
//           { $set: updateFields }
//         );

//         // Count only if document was actually modified
//         if (result.modifiedCount > 0 && !updatedCaseIds.includes(caseDoc.caseId)) {
//           updatedCount++;
//           updatedCaseIds.push(caseDoc.caseId);
//         }
//       } catch (error) {
//         errors.push(`Failed to update case ${caseDoc.caseId}: ${error.message}`);
//       }
//     }

//     res.json({
//       success: true,
//       message: `Processed ${uniqueCaseIds.length} records`,
//       updatedCount,
//       updatedCaseIds,
//       clientTATUpdates,
//       errors: errors.length > 0 ? errors : undefined
//     });
//   } catch (error) {
//     console.error("Batch update error:", error);
//     res.status(500).json({ 
//       success: false, 
//       message: "Batch update failed", 
//       error: error.message 
//     });
//   }
// };

