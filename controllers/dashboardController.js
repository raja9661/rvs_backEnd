const KYC = require('../models/kycModel');
const XLSX = require('xlsx');
const { getIo } = require('../config/socket');
const {
  fetchDashboardStats,
  getVerificationTrendsData,
  getRecentActivity,
  sendDashboardUpdates
} = require('../utils/dashboardUpdates');
const { ClientCode } = require('../models/MappingItems');
const ExcelJS = require('exceljs');


// Consolidated dashboard data endpoint with client role support
exports.getDashboardData = async (req, res) => {
  try {
    const { role, user, clientCode } = req.body;
    // console.log("clientCode",clientCode)
    
    if (!role) {
      return res.status(400).json({ 
        success: false, 
        message: "Role is required" 
      });
    }

    // Base query with role enforcement
    let baseQuery = {};
    
    if (role === 'employee') {
      if (!user) {
        return res.json({
          success: true,
          stats: {
            totalCases: 0,
            todayCases: 0,
            pendingCases: 0,
            highPriorityCases: 0,
            closedCases: 0,
            completionRate: 0
          },
          trends: [],
          activity: []
        });
      }
      baseQuery = { listByEmployee: user };
    } 
    else if (role === 'client') {
      if (!clientCode) {
        return res.status(400).json({
          success: false,
          message: "Client code is required for client role"
        });
      }
      baseQuery = { clientCode };
    }

    const [stats, trends, activity] = await Promise.all([
      fetchDashboardStats(baseQuery, false, role, user, clientCode),
      getVerificationTrendsData(baseQuery, role, user, clientCode),
      getRecentActivity(baseQuery, 20, role, user, clientCode)
    ]);

    // Additional client-side data validation
    if (role === 'client') {
      const invalidItems = activity.filter(item => item.clientCode !== clientCode);
      if (invalidItems.length > 0) {
        console.error(`Data leak detected: ${invalidItems.length} invalid items for client ${clientCode}`);
        activity = activity.filter(item => item.clientCode === clientCode);
      }
    }

    res.json({ 
      success: true, 
      stats, 
      trends, 
      activity 
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch dashboard data" 
    });
  }
};

exports.getCaseDetails = async (req, res) => {
  try {
    const { type, year, month, clientType, clientCode, updatedProductName, vendorName, today, download } = req.query;
    const { role, user, code } = req.body.requestBody;
    const userClientCode = code;
    
    // Base query with role enforcement
    let query = {};
    if (role === 'employee') {
      query.listByEmployee = user;
    } 
    if (role === 'client') {
      if (!userClientCode) {
        return res.status(403).json({
          success: false,
          message: "Client code is required"
        });
      }
      query.clientCode = userClientCode;
    }

    // Handle today cases
    if (today) {
      const todayDate = new Date(today);
      todayDate.setHours(0, 0, 0, 0);
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      query.createdAt = { $gte: todayDate, $lt: tomorrow };
    }
    
    // Apply type-specific filters
    switch(type) {
      case 'totalPending':
        query.status = 'Pending';
        break;
      case 'totalNewPending':
        query.caseStatus = 'New Pending';
        break;
      case 'totalHighPriority':
        query.priority = 'Urgent';
        break;
      case 'totalClosed':
        query.status = 'Closed';
        break;
      case 'todayNewPending':
        query.caseStatus = 'New Pending';
        break;
      case 'todayPending':
        query.status = 'Pending';
        break;
      case 'todayClosed':
        query.status = 'Closed';
        break;
      case 'todayHighPriority':
        query.priority = 'Urgent';
        break;
    }
    
    // For monthly cases, filter current month
    if (type === 'monthly') {
      const currentDate = new Date();
      query.year = currentDate.getFullYear().toString();
      query.month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    } else if (!today) {
      // For non-today cases, apply year/month filters
      if (year) query.year = year;
      if (month) query.month = month;
    }
    
    // Apply hierarchy filters
    if (clientType) query.clientType = clientType;
    if (clientCode) query.clientCode = clientCode;
    if (updatedProductName) query.updatedProductName = updatedProductName;
    if (vendorName) query.vendorName = vendorName;

    // Determine grouping field based on type and hierarchy level
    let groupByField;
    switch(type) {
      // case 'todayNewPending':
      //   groupByField = vendorName ? '$updatedProductName' : '$vendorName';
      //   break;
      // case 'todayPending':
      //   groupByField = clientCode ? '$updatedProductName' : '$clientCode';
      //   break;
      case 'todayNewPending':
    groupByField = updatedProductName ? null : 
                  vendorName ? '$updatedProductName' : 
                  '$vendorName';
    break;
  case 'todayPending':
    groupByField = updatedProductName ? null : 
                  clientCode ? '$updatedProductName' : 
                  '$clientCode';
    break;
      case 'todayClosed':
      case 'todayHighPriority':
        groupByField = updatedProductName ? null : 
                      clientCode ? '$updatedProductName' : 
                      clientType ? '$clientCode' : 
                      '$clientType';
        break;
      case 'monthly':
      case 'today':
        groupByField = updatedProductName ? null : 
                      clientCode ? '$updatedProductName' : 
                      clientType ? '$clientCode' : 
                      '$clientType';
        break;
      default: // total cases and other totals
        groupByField = updatedProductName ? null : 
                      clientCode ? '$updatedProductName' : 
                      clientType ? '$clientCode' : 
                      month ? '$clientType' :
                      year ? '$month' :
                      '$year';
    }

    // For non-download requests, use aggregation for counts
    if (!download) {
      if (!groupByField) {
        // For product details level, return the actual records
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Select only necessary fields for client role
        let projection = {};
        if (role === 'client') {
          projection = {
            caseId: 1,
            attachments: 1,
            remarks: 1,
            name: 1,
            details: 1,
            details1: 1,
            priority: 1,
            correctUPN: 1,
            product: 1,
            updatedProductName: 1,
            accountNumber: 1,
            requirement: 1,
            updatedRequirement: 1,
            clientCode: 1,
            dateIn: 1,
            status: 1,
            dateInDate: 1,
            caseStatus: 1,
            productType: 1,
            listByEmployee: 1,
            dateOut: 1,
            sentBy: 1,
            caseDoneBy: 1,
            customerCare: 1,
            NameUploadBy: 1,
            sentDate: 1,
            isRechecked: 1
          };
        }

        const [records, total] = await Promise.all([
          KYC.find(query, projection).skip(skip).limit(limit).lean(),
          KYC.countDocuments(query)
        ]);

        return res.json({
          success: true,
          data: records,
          total,
          page,
          pages: Math.ceil(total / limit),
          hierarchyLevel: 'productDetails'
        });
      } else {
        // Use aggregation for counting grouped data
        const aggregationPipeline = [
          { $match: query },
          { $group: { 
            _id: groupByField, 
            count: { $sum: 1 }
          }},
          { $project: {
            name: '$_id',
            count: 1,
            _id: 0
          }},
          { $sort: { name: 1 } }
        ];

        // For vendorName grouping, include vendor details
        if (groupByField === '$vendorName') {
          aggregationPipeline.unshift({
            $lookup: {
              from: 'vendors',
              localField: 'vendorName',
              foreignField: 'name',
              as: 'vendorDetails'
            }
          });
          aggregationPipeline.push({
            $addFields: {
              vendorCode: { $arrayElemAt: ['$vendorDetails.code', 0] }
            }
          });
        }

        const data = await KYC.aggregate(aggregationPipeline);
        
        return res.json({ 
          success: true,
          data,
          hierarchyLevel: groupByField === '$vendorName' ? 'vendorName' : 
                         groupByField === '$updatedProductName' ? 'updatedProductName' :
                         groupByField === '$clientCode' ? 'clientCode' :
                         groupByField === '$clientType' ? 'clientType' :
                         groupByField === '$month' ? 'month' : 'year'
        });
      }
    }

    // Handle Excel download - stream data directly without loading all into memory
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${type}_cases.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // Create streaming workbook
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const sheet = workbook.addWorksheet('CaseDetails');

      // Define columns based on role
      const columns = {
        admin: [
    
    { header: 'Case ID', key: 'caseId' },
    { header: 'Attachments', key: 'attachments' },
    { header: 'Remarks', key: 'remarks' },
    { header: 'Name', key: 'name' },
    { header: 'Details', key: 'details' },
    { header: 'Details 1', key: 'details1' },
    { header: 'Priority', key: 'priority' },
    { header: 'Correct UPN', key: 'correctUPN' },
    { header: 'Product', key: 'product' },
    { header: 'Updated Product Name', key: 'updatedProductName' },
    { header: 'Account Number', key: 'accountNumber' },
    { header: 'Requirement', key: 'requirement' },
    { header: 'Updated Requirement', key: 'updatedRequirement' },
    { header: 'Account Number Digit', key: 'accountNumberDigit' },
    { header: 'Bank Code', key: 'bankCode' },
    { header: 'Client Code', key: 'clientCode' },
    { header: 'Vendor Name', key: 'vendorName' },
    { header: 'Vendor Status', key: 'vendorStatus' },
    { header: 'Date In', key: 'dateIn' },
    { header: 'Date In Day', key: 'dateInDate' },
    { header: 'Status', key: 'status' },
    { header: 'Case Status', key: 'caseStatus' },
    { header: 'Product Type', key: 'productType' },
    { header: 'List By Employee', key: 'listByEmployee' },
    { header: 'Date Out', key: 'dateOut' },
    { header: 'Date Out Day', key: 'dateOutInDay' },
    { header: 'Sent By', key: 'sentBy' },
    { header: 'Auto Or Manual', key: 'autoOrManual' },
    { header: 'Case Done By', key: 'caseDoneBy' },
    { header: 'Client TAT', key: 'clientTAT' },
    { header: 'Customer Care', key: 'customerCare' },
    { header: 'Name Upload By', key: 'NameUploadBy' },
    { header: 'Sent Date', key: 'sentDate' },
    { header: 'Sent Date Day', key: 'sentDateInDay' },
    { header: 'Client Type', key: 'clientType' },
    { header: 'Dedup By', key: 'dedupBy' },
    { header: 'IP Address', key: 'ipAddress' },
    { header: 'Is Rechecked', key: 'isRechecked' },
    
  ],
  employee: [
    { header: 'Case ID', key: 'caseId' },
    { header: 'Attachments', key: 'attachments' },
    { header: 'Remarks', key: 'remarks' },
    { header: 'Name', key: 'name' },
    { header: 'Details', key: 'details' },
    { header: 'Details 1', key: 'details1' },
    { header: 'Priority', key: 'priority' },
    { header: 'Correct UPN', key: 'correctUPN' },
    { header: 'Product', key: 'product' },
    { header: 'Updated Product Name', key: 'updatedProductName' },
    { header: 'Account Number', key: 'accountNumber' },
    { header: 'Requirement', key: 'requirement' },
    { header: 'Updated Requirement', key: 'updatedRequirement' },
    { header: 'Account Number Digit', key: 'accountNumberDigit' },
    { header: 'Bank Code', key: 'bankCode' },
    { header: 'Client Code', key: 'clientCode' },
    { header: 'Vendor Name', key: 'vendorName' },
    { header: 'Date In', key: 'dateIn' },
    { header: 'Date In Day', key: 'dateInDate' },
    { header: 'Case Status', key: 'caseStatus' },
    { header: 'Product Type', key: 'productType' },
    { header: 'List By Employee', key: 'listByEmployee' },
    { header: 'Date Out', key: 'dateOut' },
    { header: 'Date Out Day', key: 'dateOutInDay' },
    { header: 'Sent By', key: 'sentBy' },
    { header: 'Auto Or Manual', key: 'autoOrManual' },
    { header: 'Case Done By', key: 'caseDoneBy' },
    { header: 'Client TAT', key: 'clientTAT' },
    { header: 'Customer Care', key: 'customerCare' },
    { header: 'Sent Date', key: 'sentDate' },
    { header: 'Sent Date Day', key: 'sentDateInDay' },
    { header: 'Client Type', key: 'clientType' },
    { header: 'Dedup By', key: 'dedupBy' },
    { header: 'IP Address', key: 'ipAddress' },
    { header: 'Is Rechecked', key: 'isRechecked' },
    { header: 'Created At', key: 'createdAt' },
    { header: 'Updated At', key: 'updatedAt' }
  ],
  client: [
    { header: 'Case ID', key: 'caseId' },
    { header: 'Attachments', key: 'attachments' },
    { header: 'Remarks', key: 'remarks' },
    { header: 'Name', key: 'name' },
    { header: 'Details', key: 'details' },
    { header: 'Details 1', key: 'details1' },
    { header: 'Priority', key: 'priority' },
    { header: 'Correct UPN', key: 'correctUPN' },
    { header: 'Product', key: 'product' },
    { header: 'Updated Product Name', key: 'updatedProductName' }, // Note: original list had typo
    { header: 'Account Number', key: 'accountNumber' },
    { header: 'Requirement', key: 'requirement' },
    { header: 'Updated Requirement', key: 'updatedRequirement' },
    { header: 'Client Code', key: 'clientCode' },
    { header: 'Date In', key: 'dateIn' },
    { header: 'Date In Day', key: 'dateInDate' },
    { header: 'Case Status', key: 'caseStatus' },
    { header: 'Product Type', key: 'productType' },
    { header: 'List By Employee', key: 'listByEmployee' },
    { header: 'Date Out', key: 'dateOut' },
    { header: 'Date Out Day', key: 'dateOutInDay' },
    { header: 'Sent By', key: 'sentBy' },
    { header: 'Case Done By', key: 'caseDoneBy' },
    { header: 'Customer Care', key: 'customerCare' },
    { header: 'IP Address', key: 'ipAddress' },
    { header: 'Is Rechecked', key: 'isRechecked' },
  
  ]
        // admin: [
        //   { header: 'Case ID', key: 'caseId' },
        //   { header: 'Client Type', key: 'clientType' },
        //   { header: 'Client Code', key: 'clientCode' },
        //   { header: 'Vendor Name', key: 'vendorName' },
        //   { header: 'Product', key: 'product' },
        //   { header: 'Updated Product Name', key: 'updatedProductName' },
        //   { header: 'Account Number', key: 'accountNumber' },
        //   { header: 'Status', key: 'status' },
        //   { header: 'Case Status', key: 'caseStatus' },
        //   { header: 'Priority', key: 'priority' },
        //   { header: 'Created At', key: 'createdAt' },
        //   { header: 'Updated At', key: 'updatedAt' }
        // ],
        // employee: [
        //   { header: 'Case ID', key: 'caseId' },
        //   { header: 'Client Code', key: 'clientCode' },
        //   { header: 'Product', key: 'product' },
        //   { header: 'Updated Product Name', key: 'updatedProductName' },
        //   { header: 'Status', key: 'status' },
        //   { header: 'Case Status', key: 'caseStatus' },
        //   { header: 'Priority', key: 'priority' },
        //   { header: 'Created At', key: 'createdAt' }
        // ],
        // client: [
        //   { header: 'Case ID', key: 'caseId' },
        //   { header: 'Product', key: 'product' },
        //   { header: 'Updated Product Name', key: 'updatedProductName' },
        //   { header: 'Status', key: 'status' },
        //   { header: 'Case Status', key: 'caseStatus' },
        //   { header: 'Priority', key: 'priority' },
        //   { header: 'Created At', key: 'createdAt' },
        //   { header: 'Remarks', key: 'remarks' }
        // ]
      };

      // Add columns to sheet
      sheet.columns = columns[role] || columns.client;

      // MongoDB cursor for streaming
      const cursor = KYC.find(query).lean().cursor();

      for await (const doc of cursor) {
        let record = doc;
        
        // Format dates for Excel
        if (record.createdAt) {
          record.createdAt = new Date(record.createdAt).toLocaleString();
        }
        if (record.updatedAt) {
          record.updatedAt = new Date(record.updatedAt).toLocaleString();
        }

        // Add row to sheet
        sheet.addRow(record).commit();
      }

      // Finalize the workbook
      await workbook.commit();
    }
  } catch (error) {
    console.error('Error in getCaseDetails:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch case details',
      error: error.message
    });
  }
};

exports.sendManualUpdate = async (req, res) => {
  try {
    const { role, user, clientCode } = req.body;
    
    let query = {};
    if (role === 'employee') {
      query = { listByEmployee: user };
    } 
    else if (role === 'client') {
      query = { clientCode };
    }
    
    await sendDashboardUpdates(getIo(), query, role, user, clientCode);
    res.json({ success: true, message: "Update sent" });
  } catch (error) {
    console.error("Manual update error:", error);
    res.status(500).json({ success: false, message: "Update failed" });
  }
};



// const KYC = require('../models/kycModel');
// const XLSX = require('xlsx');
// const { getIo } = require('../config/socket');
// const {
//   fetchDashboardStats,
//   getVerificationTrendsData,
//   getRecentActivity,
//   sendDashboardUpdates
// } = require('../utils/dashboardUpdates');

// // Consolidated dashboard data endpoint with strict role filtering
// exports.getDashboardData = async (req, res) => {
//   try {
//     const { role, user } = req.body;
    
//     if (!role) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Role is required" 
//       });
//     }

//     // Strict filtering with validation
//     const baseQuery = role === 'admin' ? {} : { 
//       listByEmployee: user || null 
//     };

//     // Additional validation for employee role
//     if (role === 'employee' && !user) {
//       return res.json({
//         success: true,
//         stats: {
//           totalCases: 0,
//           todayCases: 0,
//           pendingCases: 0,
//           highPriorityCases: 0,
//           closedCases: 0,
//           completionRate: 0
//         },
//         trends: [],
//         activity: []
//       });
//     }

//     const [stats, trends, activity] = await Promise.all([
//       fetchDashboardStats(baseQuery, false, role, user),
//       getVerificationTrendsData(baseQuery, role, user),
//       getRecentActivity(baseQuery, 20, role, user)
//     ]);

//     // Final verification of data
//     if (role === 'employee') {
//       const invalidItems = activity.filter(item => item.listByEmployee !== user);
//       if (invalidItems.length > 0) {
//         console.error(`Data leak detected: ${invalidItems.length} invalid items for employee ${user}`);
//         activity = activity.filter(item => item.listByEmployee === user);
//       }
//     }

//     res.json({ 
//       success: true, 
//       stats, 
//       trends, 
//       activity 
//     });
//   } catch (error) {
//     console.error("Dashboard data error:", error);
//     res.status(500).json({ 
//       success: false, 
//       message: "Failed to fetch dashboard data" 
//     });
//   }
// };

// exports.getCaseDetails = async (req, res) => {
//   try {
//     const { type, year, month, clientType, clientCode,productType, product, download } = req.query;
//     const { role, user } = req.body;
    
//     // 1. Base query with role enforcement and debug logging
//     let query = role === 'admin' ? {} : { listByEmployee: user };
//     // console.log('Initial query:', JSON.stringify(query));

//     // 2. Handle today cases with proper date range
//     if (type === 'today') {
//       const startOfDay = new Date();
//       startOfDay.setHours(0, 0, 0, 0);
      
//       const endOfDay = new Date();
//       endOfDay.setHours(23, 59, 59, 999);
      
//       query.createdAt = { 
//         $gte: startOfDay,
//         $lte: endOfDay
//       };
//       console.log('Today query:', JSON.stringify(query.createdAt));
//     } 
//     // 3. Case type filters
//     else if (type === 'New Pending') query.caseStatus = 'New Pending';
//     else if (type === 'closed') query.status = 'Closed';
//     else if (type === 'highPriority') query.priority = 'High';
    
//     // 4. Date filters (excluding today cases)
//     if (type !== 'today') {
//       if (year) query.year = year;
//       if (month) query.month = month;
//     }
    
//     // 5. Hierarchy filters
//     if (clientType) query.clientType = clientType;
//     if (productType) query.productType = productType;
//     if (clientCode) query.clientCode = clientCode;
//     if (product) query.product = product;

//     // console.log('Final query:', JSON.stringify(query));

//     // 6. Get full records with debug
//     const fullRecords = await KYC.find(query).lean();
//     // console.log(`Found ${fullRecords.length} records`);

//         if (download) {
//       const worksheet = XLSX.utils.json_to_sheet(fullRecords);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "CaseDetails");
//       const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
//       res.setHeader('Content-Disposition', `attachment; filename="${type}_cases.xlsx"`);
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       return res.send(buffer);
//     }

//     // 7. Determine hierarchy level
//     // const hierarchyLevel = product ? 'productDetails' : 
//     //   clientCode ? 'product' : 
//     //   clientType ? 'clientCode' : 
//     //   type === 'today' || month ? 'clientType' : 
//     //   year ? 'month' : 'year';
//     const hierarchyLevel = product ? 'productDetails' : 
//   clientCode ? 'product' : 
//   productType ? 'clientCode' : 
//   clientType ? 'productType' : 
//   type === 'today' || month ? 'clientType' : 
//   year ? 'month' : 'year';


//     // console.log('Hierarchy level:', hierarchyLevel);

//     // 8. Return aggregated data for navigation
//     let data = [];
    
//     if (hierarchyLevel === 'productDetails') {
//       data = fullRecords;
//     }
//     else if (hierarchyLevel === 'product') {
//       const productMap = new Map();
//       fullRecords.forEach(item => {
//         const count = productMap.get(item.product) || 0;
//         productMap.set(item.product, count + 1);
//       });
//       data = Array.from(productMap, ([name, count]) => ({ name, count }));
//     }
//     else if (hierarchyLevel === 'clientCode') {
//       const clientMap = new Map();
//       fullRecords.forEach(item => {
//         const count = clientMap.get(item.clientCode) || 0;
//         clientMap.set(item.clientCode, count + 1);
//       });
//       data = Array.from(clientMap, ([name, count]) => ({ name, count }));
//     }else if (hierarchyLevel === 'productType') {
//   const productTypeMap = new Map();
//   fullRecords.forEach(item => {
//     const count = productTypeMap.get(item.productType) || 0;
//     productTypeMap.set(item.productType, count + 1);
//   });
//   data = Array.from(productTypeMap, ([name, count]) => ({ name, count }));
// }
//     else if (hierarchyLevel === 'clientType') {
//       const typeMap = new Map();
//       fullRecords.forEach(item => {
//         const count = typeMap.get(item.clientType) || 0;
//         typeMap.set(item.clientType, count + 1);
//       });
//       data = Array.from(typeMap, ([name, count]) => ({ name, count }));
//     }
//     else if (hierarchyLevel === 'month') {
//       const monthMap = new Map();
//       fullRecords.forEach(item => {
//         const count = monthMap.get(item.month) || 0;
//         monthMap.set(item.month, count + 1);
//       });
//       data = Array.from(monthMap, ([name, count]) => ({ name, count }));
//     }
//     else if (hierarchyLevel === 'year') {
//       const yearMap = new Map();
//       fullRecords.forEach(item => {
//         const count = yearMap.get(item.year) || 0;
//         yearMap.set(item.year, count + 1);
//       });
//       data = Array.from(yearMap, ([name, count]) => ({ name, count }));
//     }

//     // console.log('Aggregated data:', data);

//     return res.json({ 
//       success: true,
//       data,
//       records: fullRecords,
//       hierarchyLevel
//     });

//   } catch (error) {
//     console.error('Error in getCaseDetails:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to fetch case details',
//       error: error.message,
//       query: req.query
//     });
//   }
// };
// // Manual update trigger with role enforcement
// exports.sendManualUpdate = async (req, res) => {
//   try {
//     const { role, user } = req.body;
//     const baseQuery = role === 'employee' ? { listByEmployee: user } : {};
    
//     await sendDashboardUpdates(getIo(), baseQuery, role, user);
//     res.json({ success: true, message: "Update sent" });
//   } catch (error) {
//     console.error("Manual update error:", error);
//     res.status(500).json({ success: false, message: "Update failed" });
//   }
// };