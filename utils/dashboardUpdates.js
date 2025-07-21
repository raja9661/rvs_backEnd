const KYC = require("../models/kycModel");
const moment = require('moment-timezone');

// Role-based cache with TTL
const roleBasedCache = new Map();
const CACHE_TTL = 5000;

const getFormattedDateTime = () => {
  return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
};

// async function getVerificationTrendsData(query = {}, role, user, clientCode) {
//   const days = 7;
//   const date = new Date();
//   date.setDate(date.getDate() - days);

//   // Strict validation for non-admin roles
//   if (role === 'employee' && (!user || query.listByEmployee !== user)) {
//     console.error(`Security violation: Employee ${user} attempted invalid query`);
//     return generateEmptyTrendsData(days);
//   }
//   else if (role === 'client' && (!clientCode || query.clientCode !== clientCode)) {
//     console.error(`Security violation: Client ${clientCode} attempted invalid query`);
//     return generateEmptyTrendsData(days);
//   }

//   const trends = await KYC.aggregate([
//     { 
//       $match: { 
//         ...query,
//         createdAt: { $gte: date }
//       } 
//     },
//     {
//       $group: {
//         _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
//         completed: {
//           $sum: {
//             $cond: [{ $eq: ["$status", "Closed"] }, 1, 0]
//           }
//         },
//         pending: {
//           $sum: {
//             $cond: [
//               { $and: [
//                 { $eq: ["$dateOut", ""] },
//                 { $ne: ["$caseStatus", "Sent"] }
//               ]}, 
//               1, 
//               0
//             ]
//           }
//         },
//         sent: {
//           $sum: {
//             $cond: [{ $eq: ["$caseStatus", "Sent"] }, 1, 0]
//           }
//         },
//         total: { $sum: 1 }
//       }
//     },
//     { $sort: { "_id": 1 } }
//   ]);

//   // Ensure today is included
//   const todayStr = new Date().toISOString().split('T')[0];
//   if (!trends.some(t => t._id === todayStr)) {
//     trends.push({
//       _id: todayStr,
//       completed: 0,
//       pending: 0,
//       sent: 0,
//       total: 0
//     });
//   }

//   return trends.map(t => ({
//     date: t._id,
//     completed: t.completed,
//     pending: t.pending,
//     sent: t.sent,
//     total: t.total
//   }));
// }

async function getVerificationTrendsData(query = {}, role, user, clientCode) {
  const days = 7;
  const date = new Date();
  date.setDate(date.getDate() - days);

  // Add clientCode to query if role is client
  if (role === 'client' && clientCode) {
    query.clientCode = clientCode;
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

async function getRecentActivity(query = {}, limit = 20, role, user, clientCode) {
  // Strict access control
  if (role === 'employee' && (!user || query.listByEmployee !== user)) {
    console.error(`Security violation: Employee ${user} attempted invalid query`);
    return [];
  }
  else if (role === 'client' && (!clientCode || query.clientCode !== clientCode)) {
    console.error(`Security violation: Client ${clientCode} attempted invalid query`);
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

async function fetchDashboardStats(query, useCache = true, role, user, clientCode) {
  const cacheKey = `${role}:${user || clientCode || 'admin'}`;
  
  if (useCache && roleBasedCache.has(cacheKey)) {
    const { stats, timestamp } = roleBasedCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return { ...stats, cached: true };
    }
  }

  // Strict validation
  if (role === 'employee' && (!user || query.listByEmployee !== user)) {
    console.error(`Security violation: Employee ${user} attempted invalid query`);
    return getEmptyStats();
  }
  else if (role === 'client' && (!clientCode || query.clientCode !== clientCode)) {
    console.error(`Security violation: Client ${clientCode} attempted invalid query`);
    return getEmptyStats();
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
    KYC.countDocuments({ ...query, priority: "Urgent" }),
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

function getEmptyStats() {
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

async function sendDashboardUpdates(io = null, query = {}, role, user, clientCode) {
  try {
    const [stats, trends, activity] = await Promise.all([
      fetchDashboardStats(query, false, role, user, clientCode),
      getVerificationTrendsData(query, role, user, clientCode),
      getRecentActivity(query, 5, role, user, clientCode)
    ]);

    const updateData = { stats, trends, activity };

    if (io) {
      // Send updates to appropriate rooms
      if (role === 'employee' && user) {
        io.to(`employee_${user}`).emit("dashboardUpdate", updateData);
      } 
      else if (role === 'client' && clientCode) {
        io.to(`client_${clientCode}`).emit("dashboardUpdate", updateData);
      } 
      else {
        // Default to admin room
        io.to('admins').emit("dashboardUpdate", updateData);
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








// const KYC = require("../models/kycModel");
// const moment = require('moment-timezone');


// // Role-based cache with TTL
// const roleBasedCache = new Map();
// const CACHE_TTL = 5000; // Reduced from 30s to 5s for more frequent updates


// const getFormattedDateTime = () => {
//   return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
// };

// async function getVerificationTrendsData(query = {}, role, user) {
//   const days = 7;
//   const date = new Date();
//   const d = getFormattedDateTime()
//   date.setDate(date.getDate() - days);

//   // Strict validation for employee role
//   if (role === 'employee' && (!user || query.listByEmployee !== user)) {
//     console.error(`Security violation: Employee ${user} attempted invalid query`);
//     return Array(days).fill().map((_, i) => {
//       const d = new Date();
//       d.setDate(d.getDate() - (days - 1 - i));
//       return {
//         date: d.toISOString().split('T')[0],
//         completed: 0,
//         pending: 0,
//         sent: 0,
//         total: 0
//       };
//     });
//   }

//   const trends = await KYC.aggregate([
//     { 
//       $match: { 
//         ...query,
//         createdAt: { $gte: date }
         
//       } 
//     },
//     {
//       $group: {
//         _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
//         completed: {
//           $sum: {
//             $cond: [{ $eq: ["$status", "Closed"] }, 1, 0]
//           }
//         },
//         pending: {
//           $sum: {
//             $cond: [
//               { $and: [
//                 { $eq: ["$dateOut", ""] },
//                 { $ne: ["$caseStatus", "Sent"] }
//               ]}, 
//               1, 
//               0
//             ]
//           }
//         },
//         sent: {
//           $sum: {
//             $cond: [{ $eq: ["$caseStatus", "Sent"] }, 1, 0]
//           }
//         },
//         total: { $sum: 1 }
//       }
//     },
//     { $sort: { "_id": 1 } }
//   ]);

//   // Ensure today is included
//   const todayStr = new Date().toISOString().split('T')[0];
//   if (!trends.some(t => t._id === todayStr)) {
//     trends.push({
//       _id: todayStr,
//       completed: 0,
//       pending: 0,
//       sent: 0,
//       total: 0
//     });
//   }

//   return trends.map(t => ({
//     date: t._id,
//     completed: t.completed,
//     pending: t.pending,
//     sent: t.sent,
//     total: t.total
//   }));
// }

// // Helper function to generate empty trends data
// function generateEmptyTrendsData(days) {
//   const result = [];
//   const date = new Date();
  
//   for (let i = days - 1; i >= 0; i--) {
//     const d = new Date();
//     d.setDate(d.getDate() - i);
//     result.push({
//       date: d.toISOString().split('T')[0],
//       completed: 0,
//       pending: 0,
//       sent: 0,
//       total: 0
//     });
//   }
  
//   return result;
// }
// async function getRecentActivity(query = {}, limit = 20, role, user) {
//   // Strict access control
//   if (role === 'employee' && (!user || query.listByEmployee !== user)) {
//     console.error(`Security violation: Employee ${user} attempted invalid query`);
//     return [];
//   }

//   return await KYC.find({
//     ...query,
//     $or: [
//       { caseStatus: "New Pending" },
//       { caseStatus: "Sent" },
//       { status: "Closed" }
//     ]
//   })
//     .sort({ updatedAt: -1 })
//     .limit(limit)
//     .select("caseId name caseStatus status priority updatedAt clientType clientCode product listByEmployee")
//     .lean();
// }

// async function fetchDashboardStats(query, useCache = true, role, user) {
//   const cacheKey = `${role}:${user || 'admin'}`;
  
//   if (useCache && roleBasedCache.has(cacheKey)) {
//     const { stats, timestamp } = roleBasedCache.get(cacheKey);
//     if (Date.now() - timestamp < CACHE_TTL) {
//       return { ...stats, cached: true };
//     }
//   }

//   // Strict validation
//   if (role === 'employee' && (!user || query.listByEmployee !== user)) {
//     console.error(`Security violation: Employee ${user} attempted invalid query`);
//     return {
//       totalCases: 0,
//       todayCases: 0,
//       pendingCases: 0,
//       highPriorityCases: 0,
//       closedCases: 0,
//       completionRate: 0,
//       updatedAt: new Date()
//     };
//   }

//   const todayStart = new Date();
//   todayStart.setHours(0, 0, 0, 0);
  
//   const todayEnd = new Date();
//   todayEnd.setHours(23, 59, 59, 999);

//   const [
//     totalCases,
//     todayCases,
//     pendingCases,
//     highPriorityCases,
//     closedCases,
//     completionRateAgg
//   ] = await Promise.all([
//     KYC.countDocuments(query),
//     KYC.countDocuments({ ...query, createdAt: { $gte: todayStart, $lte: todayEnd } }),
//     KYC.countDocuments({ ...query, caseStatus: "New Pending" }),
//     KYC.countDocuments({ ...query, priority: "High" }),
//     KYC.countDocuments({ ...query, status: "Closed" }),
//     KYC.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: 1 },
//           completed: { $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] } }
//       }}
//     ])
//   ]);

//   const completionRate = completionRateAgg[0]?.total > 0 
//     ? Math.round((completionRateAgg[0]?.completed / completionRateAgg[0]?.total) * 100)
//     : 0;

//   const stats = {
//     totalCases,
//     todayCases,
//     pendingCases,
//     highPriorityCases,
//     closedCases,
//     completionRate,
//     updatedAt: new Date()
//   };

//   roleBasedCache.set(cacheKey, { stats, timestamp: Date.now() });
//   return stats;
// }

// async function sendDashboardUpdates(io = null, query = {}, role, user) {
//   try {
//     const [stats, trends, activity] = await Promise.all([
//       fetchDashboardStats(query, false, role, user),
//       getVerificationTrendsData(query, role, user),
//       getRecentActivity(query, 5, role, user)
//     ]);

//     const updateData = { stats, trends, activity };

//     if (io) {
//       // Force immediate update to all relevant clients
//       if (role === 'employee' && user) {
//         io.to(`employee_${user}`).emit("dashboardUpdate", updateData);
//       } else {
//         // Update all admin clients and any other relevant rooms
//         io.to('admins').emit("dashboardUpdate", updateData);
//         if (role === 'admin') {
//           io.emit("dashboardUpdate", updateData); // Fallback broadcast
//         }
//       }
//     }
//     return updateData;
//   } catch (error) {
//     console.error("Update error:", error);
//     throw error;
//   }
// }

// module.exports = {
//   fetchDashboardStats,
//   getVerificationTrendsData,
//   getRecentActivity,
//   sendDashboardUpdates
// };