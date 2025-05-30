const KYC = require("../models/kycModel");
const moment = require("moment");


// Role-based cache with TTL
const roleBasedCache = new Map();
const CACHE_TTL = 5000; // Reduced from 30s to 5s for more frequent updates


const getFormattedDateTime = () => {
  return moment().format("DD-MM-YYYY, hh:mm:ss A");
};

async function getVerificationTrendsData(query = {}, role, user) {
  const days = 7;
  const date = new Date();
  const d = getFormattedDateTime()
  date.setDate(date.getDate() - days);

  // Strict validation for employee role
  if (role === 'employee' && (!user || query.listByEmployee !== user)) {
    console.error(`Security violation: Employee ${user} attempted invalid query`);
    return Array(days).fill().map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return {
        date: d.toISOString().split('T')[0],
        completed: 0,
        pending: 0,
        sent: 0,
        total: 0
      };
    });
  }

  const trends = await KYC.aggregate([
    { 
      $match: { 
        ...query,
        createdAt: { $gte: date }
         
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        completed: {
          $sum: {
            $cond: [{ $eq: ["$status", "Closed"] }, 1, 0]
          }
        },
        pending: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ["$dateOut", ""] },
                { $ne: ["$caseStatus", "Sent"] }
              ]}, 
              1, 
              0
            ]
          }
        },
        sent: {
          $sum: {
            $cond: [{ $eq: ["$caseStatus", "Sent"] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // Ensure today is included
  const todayStr = new Date().toISOString().split('T')[0];
  if (!trends.some(t => t._id === todayStr)) {
    trends.push({
      _id: todayStr,
      completed: 0,
      pending: 0,
      sent: 0,
      total: 0
    });
  }

  return trends.map(t => ({
    date: t._id,
    completed: t.completed,
    pending: t.pending,
    sent: t.sent,
    total: t.total
  }));
}
// async function getVerificationTrendsData(query = {}, role, user) {
//   try {
//     // Validate user for employee role
//     if (role === 'employee' && !user) {
//       console.error('Employee role requires user information');
//       return generateEmptyTrendsData(7); // Return empty data for 7 days
//     }

//     // Set date range - last 7 days including today
//     const days = 7;
//     const endDate = new Date();
//     const startDate = new Date();
//     startDate.setDate(startDate.getDate() - days + 1);
    
//     // Normalize times (start at 00:00:00, end at 23:59:59)
//     startDate.setHours(0, 0, 0, 0);
//     endDate.setHours(23, 59, 59, 999);

//     // Apply role-based filtering
//     const baseQuery = {
//       ...query,
//       createdAt: { 
//         $gte: startDate,
//         $lte: endDate
//       }
//     };

//     // For employees, ensure they only see their own cases
//     if (role === 'employee') {
//       baseQuery.listByEmployee = user;
//     }

//     // Main aggregation pipeline
//     const trends = await KYC.aggregate([
//       { 
//         $match: baseQuery
//       },
//       {
//         $group: {
//           _id: { 
//             $dateToString: { 
//               format: "%Y-%m-%d", 
//               date: "$createdAt" 
//             } 
//           },
//           completed: {
//             $sum: {
//               $cond: [
//                 { $eq: ["$status", "Closed"] }, 
//                 1, 
//                 0
//               ]
//             }
//           },
//           pending: {
//             $sum: {
//               $cond: [
//                 { 
//                   $and: [
//                     { $eq: ["$dateOut", ""] },
//                     { $ne: ["$caseStatus", "Sent"] }
//                   ]
//                 }, 
//                 1, 
//                 0
//               ]
//             }
//           },
//           sent: {
//             $sum: {
//               $cond: [
//                 { $eq: ["$caseStatus", "Sent"] }, 
//                 1, 
//                 0
//               ]
//             }
//           },
//           total: { $sum: 1 }
//         }
//       },
//       { $sort: { "_id": 1 } }
//     ]);

//     // Generate complete date range to fill any missing days
//     const dateMap = {};
//     const currentDate = new Date(startDate);
    
//     while (currentDate <= endDate) {
//       const dateStr = currentDate.toISOString().split('T')[0];
//       dateMap[dateStr] = {
//         _id: dateStr,
//         completed: 0,
//         pending: 0,
//         sent: 0,
//         total: 0
//       };
//       currentDate.setDate(currentDate.getDate() + 1);
//     }

//     // Merge actual data with the complete date range
//     trends.forEach(day => {
//       dateMap[day._id] = day;
//     });

//     // Convert to array and format the output
//     const result = Object.values(dateMap).map(t => ({
//       date: t._id,
//       completed: t.completed,
//       pending: t.pending,
//       sent: t.sent,
//       total: t.total
//     }));

//     // Ensure today's date is included with proper counts
//     const todayStr = new Date().toISOString().split('T')[0];
//     const todayData = result.find(d => d.date === todayStr) || {
//       date: todayStr,
//       completed: 0,
//       pending: 0,
//       sent: 0,
//       total: 0
//     };

//     // Update today's counts with real-time data if needed
//     if (todayData.total === 0) {
//       const todayCounts = await KYC.aggregate([
//   {
//     $match: {
//       ...baseQuery,
//       createdAt: {
//         $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//         $lte: new Date()
//       }
//     }
//   },
//   {
//     $group: {
//       _id: null,
//       completed: { 
//         $sum: { 
//           $cond: [
//             { $eq: ["$status", "Closed"] }, 
//             1, 
//             0
//           ] 
//         } 
//       },
//       pending: { 
//         $sum: { 
//           $cond: [
//             { 
//               $and: [
//                 { $eq: ["$dateOut", ""] },
//                 { $ne: ["$caseStatus", "Sent"] }
//               ]
//             }, 
//             1, 
//             0
//           ] 
//         } 
//       },
//       sent: { 
//         $sum: { 
//           $cond: [
//             { $eq: ["$caseStatus", "Sent"] }, 
//             1, 
//             0
//           ] 
//         } 
//       },
//       total: { $sum: 1 }
//     }
//   }
// ]);  // Removed the extra closing bracket here

//       if (todayCounts.length > 0) {
//         todayData.completed = todayCounts[0].completed;
//         todayData.pending = todayCounts[0].pending;
//         todayData.sent = todayCounts[0].sent;
//         todayData.total = todayCounts[0].total;
//       }
//     }

//     return result;
//   } catch (error) {
//     console.error('Error in getVerificationTrendsData:', error);
//     // Return empty data structure on error
//     return generateEmptyTrendsData(7);
//   }
// }

// Helper function to generate empty trends data
function generateEmptyTrendsData(days) {
  const result = [];
  const date = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      date: d.toISOString().split('T')[0],
      completed: 0,
      pending: 0,
      sent: 0,
      total: 0
    });
  }
  
  return result;
}
async function getRecentActivity(query = {}, limit = 20, role, user) {
  // Strict access control
  if (role === 'employee' && (!user || query.listByEmployee !== user)) {
    console.error(`Security violation: Employee ${user} attempted invalid query`);
    return [];
  }

  return await KYC.find({
    ...query,
    $or: [
      { caseStatus: "New Pending" },
      { caseStatus: "Sent" },
      { status: "Closed" }
    ]
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("caseId name caseStatus status priority updatedAt clientType clientCode product listByEmployee")
    .lean();
}

async function fetchDashboardStats(query, useCache = true, role, user) {
  const cacheKey = `${role}:${user || 'admin'}`;
  
  if (useCache && roleBasedCache.has(cacheKey)) {
    const { stats, timestamp } = roleBasedCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return { ...stats, cached: true };
    }
  }

  // Strict validation
  if (role === 'employee' && (!user || query.listByEmployee !== user)) {
    console.error(`Security violation: Employee ${user} attempted invalid query`);
    return {
      totalCases: 0,
      todayCases: 0,
      pendingCases: 0,
      highPriorityCases: 0,
      closedCases: 0,
      completionRate: 0,
      updatedAt: new Date()
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    totalCases,
    todayCases,
    pendingCases,
    highPriorityCases,
    closedCases,
    completionRateAgg
  ] = await Promise.all([
    KYC.countDocuments(query),
    KYC.countDocuments({ ...query, createdAt: { $gte: todayStart, $lte: todayEnd } }),
    KYC.countDocuments({ ...query, caseStatus: "New Pending" }),
    KYC.countDocuments({ ...query, priority: "High" }),
    KYC.countDocuments({ ...query, status: "Closed" }),
    KYC.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] } }
      }}
    ])
  ]);

  const completionRate = completionRateAgg[0]?.total > 0 
    ? Math.round((completionRateAgg[0]?.completed / completionRateAgg[0]?.total) * 100)
    : 0;

  const stats = {
    totalCases,
    todayCases,
    pendingCases,
    highPriorityCases,
    closedCases,
    completionRate,
    updatedAt: new Date()
  };

  roleBasedCache.set(cacheKey, { stats, timestamp: Date.now() });
  return stats;
}

async function sendDashboardUpdates(io = null, query = {}, role, user) {
  try {
    const [stats, trends, activity] = await Promise.all([
      fetchDashboardStats(query, false, role, user),
      getVerificationTrendsData(query, role, user),
      getRecentActivity(query, 5, role, user)
    ]);

    const updateData = { stats, trends, activity };

    if (io) {
      // Force immediate update to all relevant clients
      if (role === 'employee' && user) {
        io.to(`employee_${user}`).emit("dashboardUpdate", updateData);
      } else {
        // Update all admin clients and any other relevant rooms
        io.to('admins').emit("dashboardUpdate", updateData);
        if (role === 'admin') {
          io.emit("dashboardUpdate", updateData); // Fallback broadcast
        }
      }
    }
    return updateData;
  } catch (error) {
    console.error("Update error:", error);
    throw error;
  }
}

module.exports = {
  fetchDashboardStats,
  getVerificationTrendsData,
  getRecentActivity,
  sendDashboardUpdates
};