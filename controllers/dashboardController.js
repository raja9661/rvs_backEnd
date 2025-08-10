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
    const { type, year, month, clientType, clientCode, updatedProductName, download } = req.query;
    const { role, user, code } = req.body.requestBody;
    const userClientCode = code;
    
    // Base query with role enforcement
    let query = {};
    if (role === 'employee') {
      query = { listByEmployee: user };
    } 
    if (role === 'client') {
      if (!userClientCode) {
        return res.status(403).json({
          success: false,
          message: "Client code is required"
        });
      }
      query = { clientCode: userClientCode };
    }

    // Handle today cases
    if (type === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfDay };
    } 
    // Case type filters
    else if (type === 'New Pending') query.caseStatus = 'New Pending';
    else if (type === 'closed') query.status = 'Closed';
    else if (type === 'highPriority') query.priority = 'Urgent';
    
    // Date filters (excluding today cases)
    if (type !== 'today') {
      if (year) query.year = year;
      if (month) query.month = month;
    }
    
    // Hierarchy filters
    if (clientType) query.clientType = clientType;
    if (clientCode) {
      if (role === 'client' && clientCode !== userClientCode) {
        return res.status(403).json({
          success: false,
          message: "Access to other client data denied"
        });
      }
      query.clientCode = clientCode;
    }
    if (updatedProductName) query.updatedProductName = updatedProductName;

    // Get full records
    let fullRecords = await KYC.find(query).lean();

    // Determine hierarchy level
    const hierarchyLevel = updatedProductName ? 'productDetails' : 
      clientCode ? 'updatedProductName' : 
      clientType ? 'clientCode' : 
      type === 'today' || month ? 'clientType' : 
      year ? 'month' : 'year';

    // Return aggregated data for navigation
    let data = [];
    
    if (hierarchyLevel === 'productDetails') {
      data = fullRecords;
    }
    else if (hierarchyLevel === 'updatedProductName') {
      const productMap = new Map();
      fullRecords.forEach(item => {
        const productName = item.updatedProductName;
        const count = productMap.get(productName) || 0;
        productMap.set(productName, count + 1);
      });
      data = Array.from(productMap, ([name, count]) => ({ name, count }));
    }
    else if (hierarchyLevel === 'clientCode') {
      const clientMap = new Map();
      fullRecords.forEach(item => {
        const count = clientMap.get(item.clientCode) || 0;
        clientMap.set(item.clientCode, count + 1);
      });
      data = Array.from(clientMap, ([name, count]) => ({ name, count }));
    }
    else if (hierarchyLevel === 'clientType') {
      const typeMap = new Map();
      fullRecords.forEach(item => {
        const count = typeMap.get(item.clientType) || 0;
        typeMap.set(item.clientType, count + 1);
      });
      data = Array.from(typeMap, ([name, count]) => ({ name, count }));
    }
    else if (hierarchyLevel === 'month') {
      const monthMap = new Map();
      fullRecords.forEach(item => {
        const count = monthMap.get(item.month) || 0;
        monthMap.set(item.month, count + 1);
      });
      data = Array.from(monthMap, ([name, count]) => ({ name, count }));
    }
    else if (hierarchyLevel === 'year') {
      const yearMap = new Map();
      fullRecords.forEach(item => {
        const count = yearMap.get(item.year) || 0;
        yearMap.set(item.year, count + 1);
      });
      data = Array.from(yearMap, ([name, count]) => ({ name, count }));
    }

    // Handle Excel download
    if (download) {
      const allowedColumns = {
        admin: null,
        employee: null,
        client: [
          'caseId',
          'attachments',
          'remarks',
          'name',
          'details',
          'details1',
          'priority',
          'correctUPN',
          'product',
          'updatedProductName',
          'accountNumber',
          'requirement',
          'updatedRequirement',
          'clientCode',
          'dateIn',
          'status',
          'dateInDate',
          'caseStatus',
          'productType',
          'listByEmployee',
          'dateOut',
          'sentBy',
          'caseDoneBy',
          'customerCare',
          'NameUploadBy',
          'sentDate',
          'isRechecked'
        ]
      };

      if (role === 'client' && allowedColumns.client) {
        fullRecords = fullRecords.map(record => {
          const filteredRecord = {};
          allowedColumns.client.forEach(col => {
            if (record[col] !== undefined) {
              filteredRecord[col] = record[col];
            }
          });
          return filteredRecord;
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(fullRecords);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "CaseDetails");
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Disposition', `attachment; filename="${type}_cases.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    res.json({ 
      success: true,
      data,
      records: fullRecords,
      hierarchyLevel
    });

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