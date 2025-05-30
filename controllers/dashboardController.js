const KYC = require('../models/kycModel');
const XLSX = require('xlsx');
const { getIo } = require('../config/socket');
const {
  fetchDashboardStats,
  getVerificationTrendsData,
  getRecentActivity,
  sendDashboardUpdates
} = require('../utils/dashboardUpdates');

// Consolidated dashboard data endpoint with strict role filtering
exports.getDashboardData = async (req, res) => {
  try {
    const { role, user } = req.body;
    
    if (!role) {
      return res.status(400).json({ 
        success: false, 
        message: "Role is required" 
      });
    }

    // Strict filtering with validation
    const baseQuery = role === 'admin' ? {} : { 
      listByEmployee: user || null 
    };

    // Additional validation for employee role
    if (role === 'employee' && !user) {
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

    const [stats, trends, activity] = await Promise.all([
      fetchDashboardStats(baseQuery, false, role, user),
      getVerificationTrendsData(baseQuery, role, user),
      getRecentActivity(baseQuery, 20, role, user)
    ]);

    // Final verification of data
    if (role === 'employee') {
      const invalidItems = activity.filter(item => item.listByEmployee !== user);
      if (invalidItems.length > 0) {
        console.error(`Data leak detected: ${invalidItems.length} invalid items for employee ${user}`);
        activity = activity.filter(item => item.listByEmployee === user);
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

// Enhanced case details with better search
// exports.getCaseDetails = async (req, res) => {
//   try {
//     const { type, year, month, clientType, clientCode, product, download } = req.query;
//     const { role, user } = req.body;
    
//     let query = role === 'admin' ? {} : { listByEmployee: user };
    
//     // Handle today cases
//     if (type === 'today') {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       query.createdAt = { $gte: today };
//     } 
//     // Handle other types
//     else if (type === 'New Pending') {
//       query.caseStatus = 'New Pending';
//     } else if (type === 'closed') {
//       query.status = 'Closed';
//     } else if (type === 'highPriority') {
//       query.priority = 'High';
//     }
    
//     // Apply hierarchy filters
//     if (type !== 'today') {
//       if (year) query.year = year;
//       if (month) query.month = month;
//     }
//     if (clientType) query.clientType = clientType;
//     if (clientCode) query.clientCode = clientCode;
//     if (product) query.product = product;

//     // For downloads, return all matching records
//     if (download) {
//       const cases = await KYC.find(query).lean();
//       const worksheet = XLSX.utils.json_to_sheet(cases);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "CaseDetails");
//       const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
//       res.setHeader('Content-Disposition', 'attachment; filename="CaseDetails.xlsx"');
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       return res.send(buffer);
//     }

//     // Always return full records for client-side filtering
//     const fullRecords = await KYC.find(query).lean();

//     // Handle aggregation based on hierarchy level
//     if (product) {
//       return res.json({ 
//         success: true, 
//         data: fullRecords, 
//         records: fullRecords 
//       });
//     } 
//     else if (clientCode) {
//       const products = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$product', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ 
//         success: true, 
//         data: products, 
//         records: fullRecords 
//       });
//     } 
//     else if (clientType) {
//       const clientCodes = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$clientCode', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ 
//         success: true, 
//         data: clientCodes, 
//         records: fullRecords 
//       });
//     } 
//     else if (type === 'today') {
//       const clientTypes = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$clientType', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ 
//         success: true, 
//         data: clientTypes, 
//         records: fullRecords 
//       });
//     }
//     else if (month) {
//       const clientTypes = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$clientType', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ 
//         success: true, 
//         data: clientTypes, 
//         records: fullRecords 
//       });
//     }
//     else if (year) {
//       const months = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$month', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ 
//         success: true, 
//         data: months, 
//         records: fullRecords 
//       });
//     }
//     else {
//       const years = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$year', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ 
//         success: true, 
//         data: years, 
//         records: fullRecords 
//       });
//     }
//   } catch (error) {
//     console.error('Error fetching case details:', error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };
exports.getCaseDetails = async (req, res) => {
  try {
    const { type, year, month, clientType, clientCode, product, download } = req.query;
    const { role, user } = req.body;
    
    let query = role === 'admin' ? {} : { listByEmployee: user };
    
    // Handle today cases
    if (type === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: today };
    } 
    // Handle other types
    else if (type === 'New Pending') {
      query.caseStatus = 'New Pending';
    } else if (type === 'closed') {
      query.status = 'Closed';
    } else if (type === 'highPriority') {
      query.priority = 'High';
    }
    
    // Apply hierarchy filters
    if (type !== 'today') {
      if (year) query.year = year;
      if (month) query.month = month;
    }
    if (clientType) query.clientType = clientType;
    if (clientCode) query.clientCode = clientCode;
    if (product) query.product = product;

    // Get full records for client-side processing
    const fullRecords = await KYC.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    // For downloads
    if (download) {
      const worksheet = XLSX.utils.json_to_sheet(fullRecords);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "CaseDetails");
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Disposition', `attachment; filename="${type}_cases.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    // Return appropriate aggregation based on level
    let aggregatedData = [];
    const hierarchyLevel = product ? 'productDetails' : 
      clientCode ? 'product' : 
      clientType ? 'clientCode' : 
      type === 'today' || month ? 'clientType' : 
      year ? 'month' : 'year';

    switch(hierarchyLevel) {
      case 'productDetails':
        aggregatedData = fullRecords;
        break;
      case 'product':
        aggregatedData = await KYC.aggregate([
          { $match: query },
          { $group: { 
            _id: '$product',
            count: { $sum: 1 },
            clientCode: { $first: '$clientCode' }
          }}
        ]);
        break;
      case 'clientCode':
        aggregatedData = await KYC.aggregate([
          { $match: query },
          { $group: { 
            _id: '$clientCode',
            count: { $sum: 1 },
            clientType: { $first: '$clientType' }
          }}
        ]);
        break;
      case 'clientType':
        aggregatedData = await KYC.aggregate([
          { $match: query },
          { $group: { 
            _id: '$clientType',
            count: { $sum: 1 }
          }}
        ]);
        break;
      case 'month':
        aggregatedData = await KYC.aggregate([
          { $match: query },
          { $group: { 
            _id: '$month',
            count: { $sum: 1 },
            year: { $first: '$year' }
          }}
        ]);
        break;
      case 'year':
        aggregatedData = await KYC.aggregate([
          { $match: query },
          { $group: { 
            _id: '$year',
            count: { $sum: 1 }
          }}
        ]);
        break;
    }

    // Format aggregated data
    const formattedData = aggregatedData.map(item => ({
      ...item,
      name: item._id || item.name,
      _id: undefined
    }));

    return res.json({ 
      success: true,
      data: formattedData,
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
// exports.getCaseDetails = async (req, res) => {
//   try {
//     const { type, year, month, clientType, clientCode, product, download } = req.query;
//     const { role, user } = req.body;
    
//     let query = role === 'admin' ? {} : { listByEmployee: user };
    
//     // Handle today cases
//     if (type === 'today') {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       query.createdAt = { $gte: today };
//     } 
//     // Handle other types
//     else if (type === 'New Pending') {
//       query.caseStatus = 'New Pending';
//     } else if (type === 'closed') {
//       query.status = 'Closed';
//     } else if (type === 'highPriority') {
//       query.priority = 'High';
//     }
    
//     // Apply hierarchy filters
//     if (type !== 'today') {
//       if (year) query.year = year;
//       if (month) query.month = month;
//     }
//     if (clientType) query.clientType = clientType;
//     if (clientCode) query.clientCode = clientCode;
//     if (product) query.product = product;

//     // For downloads, return all matching records
//     if (download) {
//       const cases = await KYC.find(query).lean();
//       const worksheet = XLSX.utils.json_to_sheet(cases);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "CaseDetails");
//       const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
//       res.setHeader('Content-Disposition', 'attachment; filename="CaseDetails.xlsx"');
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       return res.send(buffer);
//     }

//     // Handle aggregation based on hierarchy level
//     if (product) {
//       const cases = await KYC.find(query);
//       return res.json({ success: true, data: cases, records: cases });
//     } 
//     else if (clientCode) {
//       const products = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$product', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ success: true, data: products, records: await KYC.find(query) });
//     } 
//     else if (clientType) {
//       const clientCodes = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$clientCode', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ success: true, data: clientCodes, records: await KYC.find(query) });
//     } 
//     else if (type === 'today') {
//       const clientTypes = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$clientType', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ success: true, data: clientTypes, records: await KYC.find(query) });
//     }
//     else if (month) {
//       const clientTypes = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$clientType', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ success: true, data: clientTypes, records: await KYC.find(query) });
//     }
//     else if (year) {
//       const months = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$month', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ success: true, data: months, records: await KYC.find(query) });
//     }
//     else {
//       const years = await KYC.aggregate([
//         { $match: query },
//         { $group: { _id: '$year', count: { $sum: 1 } } },
//         { $project: { name: '$_id', count: 1, _id: 0 } }
//       ]);
//       return res.json({ success: true, data: years, records: await KYC.find(query) });
//     }
//   } catch (error) {
//     console.error('Error fetching case details:', error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };
// Manual update trigger with role enforcement
exports.sendManualUpdate = async (req, res) => {
  try {
    const { role, user } = req.body;
    const baseQuery = role === 'employee' ? { listByEmployee: user } : {};
    
    await sendDashboardUpdates(getIo(), baseQuery, role, user);
    res.json({ success: true, message: "Update sent" });
  } catch (error) {
    console.error("Manual update error:", error);
    res.status(500).json({ success: false, message: "Update failed" });
  }
};