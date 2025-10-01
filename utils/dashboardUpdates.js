// const KYC = require("../models/kycModel");
// const moment = require('moment-timezone');

// // Role-based cache with TTL
// const roleBasedCache = new Map();
// const CACHE_TTL = 5000;

// const getFormattedDateTime = () => {
//   return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
// };

// async function getVerificationTrendsData(query = {}, role, user, clientCode) {
//   const days = 7;
//   const date = new Date();
//   date.setDate(date.getDate() - days);

//   // Add clientCode to query if role is client
//   if (role === 'client' && clientCode) {
//     query.clientCode = clientCode;
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

// async function getRecentActivity(query = {}, limit = 20, role, user, clientCode) {
//   // Strict access control
//   if (role === 'employee' && (!user || query.listByEmployee !== user)) {
//     console.error(`Security violation: Employee ${user} attempted invalid query`);
//     return [];
//   }
//   else if (role === 'client' && (!clientCode || query.clientCode !== clientCode)) {
//     console.error(`Security violation: Client ${clientCode} attempted invalid query`);
//     return [];
//   }

//   const data = await KYC.find({
//     ...query,
//     $or: [
//       { caseStatus: "New Pending" },
//       { caseStatus: "Sent" },
//       { status: "Closed" }
//     ]
//   })
//     .sort({ updatedAt: -1 })
//     .limit(limit)
//     .select("caseId name caseStatus status priority updatedAt clientType clientCode updatedProductName  accountNumber ")
//     .lean();
//     // console.log("data:",data)

//   return data
// }

// async function fetchDashboardStats(query, useCache = true, role, user, clientCode) {
//   const cacheKey = `${role}:${user || clientCode || 'admin'}`;

//   if (useCache && roleBasedCache.has(cacheKey)) {
//     const { stats, timestamp } = roleBasedCache.get(cacheKey);
//     if (Date.now() - timestamp < CACHE_TTL) {
//       return { ...stats, cached: true };
//     }
//   }

//   const todayStart = new Date();
//   todayStart.setHours(0, 0, 0, 0);

//   const todayEnd = new Date();
//   todayEnd.setHours(23, 59, 59, 999);

//   const currentMonthStart = new Date();
//   currentMonthStart.setDate(1);
//   currentMonthStart.setHours(0, 0, 0, 0);

//   const currentDate = new Date();
//      year = currentDate.getFullYear().toString();
//      month = (currentDate.getMonth() + 1).toString().padStart(2, '0');

//   const [
//     totalCases,
//     monthlyCases,
//     totalSentPending,
//     totalNewPending,
//     totalHighPriority,
//     totalClosed,
//     todayCases,
//     todaySentPending,
//     todayNewPending,
//     todayHighPriority,
//     todayClosed,
//     completionRateAgg,
//     todayCompletionRateAgg
//   ] = await Promise.all([
//     KYC.countDocuments(query),
//     KYC.countDocuments({ ...query, month,year }),
//     KYC.countDocuments({ ...query, caseStatus: "New Pending" }),
//     KYC.countDocuments({ ...query, status: "Pending",caseStatus: "Sent", }),
//     KYC.countDocuments({ ...query, priority: "Urgent" }),
//     KYC.countDocuments({ ...query, status: { $in: ["Invalid", "CNV", "Closed"] } }),
//     KYC.countDocuments({ ...query, createdAt: { $gte: todayStart, $lte: todayEnd } }),
//     KYC.countDocuments({ ...query, caseStatus: "New Pending", createdAt: { $gte: todayStart, $lte: todayEnd } }),
//     KYC.countDocuments({ ...query,caseStatus: "Sent", status: "Pending", createdAt: { $gte: todayStart, $lte: todayEnd } }),
//     KYC.countDocuments({ ...query, priority: "Urgent", createdAt: { $gte: todayStart, $lte: todayEnd } }),
//     KYC.countDocuments({ ...query, status: { $in: ["Invalid", "CNV", "Closed"] }, createdAt: { $gte: todayStart, $lte: todayEnd } }),
//     KYC.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: 1 },
//           completed: { $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] } }
//       }}
//     ]),
//     KYC.aggregate([
//       {
//         $match: {
//           ...query,
//           createdAt: { $gte: todayStart, $lte: todayEnd }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: 1 },
//           completed: { $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] } }
//       }}
//     ])
//   ]);

//   const totalCompletionRate = completionRateAgg[0]?.total > 0
//     ? Math.round((completionRateAgg[0]?.completed / completionRateAgg[0]?.total) * 100)
//     : 0;

//   const todayCompletionRate = todayCompletionRateAgg[0]?.total > 0
//     ? Math.round((todayCompletionRateAgg[0]?.completed / todayCompletionRateAgg[0]?.total) * 100)
//     : 0;

//   const stats = {
//     // Total section
//     totalCases,
//     monthlyCases,
//     totalSentPending,
//     totalNewPending,
//     totalHighPriority,
//     totalClosed,
//     totalCompletionRate,

//     // Today section
//     todayCases,
//     todaySentPending,
//     todayNewPending,
//     todayHighPriority,
//     todayClosed,
//     todayCompletionRate,

//     updatedAt: new Date()
//   };

//   roleBasedCache.set(cacheKey, { stats, timestamp: Date.now() });
//   return stats;
// }

// function getEmptyStats() {
//   return {
//     totalCases: 0,
//     todayCases: 0,
//     pendingCases: 0,
//     highPriorityCases: 0,
//     closedCases: 0,
//     completionRate: 0,
//     updatedAt: new Date()
//   };
// }

// async function sendDashboardUpdates(io = null, query = {}, role, user, clientCode) {
//   try {
//     const [stats, trends, activity] = await Promise.all([
//       fetchDashboardStats(query, false, role, user, clientCode),
//       getVerificationTrendsData(query, role, user, clientCode),
//       getRecentActivity(query, 5, role, user, clientCode)
//     ]);

//     const updateData = { stats, trends, activity };

//     if (io) {
//       // Send updates to appropriate rooms
//       if (role === 'employee' && user) {
//         io.to(`employee_${user}`).emit("dashboardUpdate", updateData);
//       }
//       else if (role === 'client' && clientCode) {
//         io.to(`client_${clientCode}`).emit("dashboardUpdate", updateData);
//       }
//       else {
//         // Default to admin room
//         io.to('admins').emit("dashboardUpdate", updateData);
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

const KYC = require("../models/kycModel");
const moment = require("moment-timezone");

// Role-based cache with TTL
const roleBasedCache = new Map();
const CACHE_TTL = 5000;

const getFormattedDateTime = () => {
  return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
};

// Helper function to parse dateIn field (DD-MM-YYYY, hh:mm:ss A)
const parseDateInField = (dateString) => {
  if (!dateString) return null;
  return moment(dateString, "DD-MM-YYYY, hh:mm:ss A")
    .tz("Asia/Kolkata")
    .toDate();
};

// Helper function to get IST date boundaries
const getISTDateBoundaries = () => {
  const now = moment().tz("Asia/Kolkata");
  const todayStart = now.clone().startOf("day").toDate();
  const todayEnd = now.clone().endOf("day").toDate();
  return { todayStart, todayEnd };
};

async function getVerificationTrendsData(query = {}, role, user, clientCode) {
  const days = 7;

  // Add clientCode to query if role is client
  if (role === "client" && clientCode) {
    query.clientCode = clientCode;
  }

  // Generate date strings for the last 7 days
  const dateStrings = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = moment().tz("Asia/Kolkata").subtract(i, "days");
    dateStrings.push(date.format("DD-MM-YYYY"));
  }

  // Use aggregation with $substr to extract date part
  const trends = await KYC.aggregate([
    {
      $match: {
        ...query,
        dateIn: {
          $exists: true,
          $ne: "",
          $regex: `^(${dateStrings.join("|")})`,
        },
      },
    },
    {
      $addFields: {
        // Extract just the date part (DD-MM-YYYY) from dateIn
        datePart: { $substr: ["$dateIn", 0, 10] },
      },
    },
    {
      $group: {
        _id: "$datePart",
        completed: {
          $sum: {
            $cond: [{ $eq: ["$status", "Closed"] }, 1, 0],
          },
        },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $or: [
                      { $eq: ["$dateOut", ""] },
                      { $eq: ["$dateOut", null] },
                    ],
                  },
                  { $ne: ["$caseStatus", "Sent"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        sent: {
          $sum: {
            $cond: [{ $eq: ["$caseStatus", "Sent"] }, 1, 0],
          },
        },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Ensure all 7 days are represented (fill missing days with zeros)
  const result = [];
  dateStrings.forEach((dateStr) => {
    const trendData = trends.find((t) => t._id === dateStr);
    if (trendData) {
      // Convert DD-MM-YYYY to YYYY-MM-DD for consistent format
      const [day, month, year] = dateStr.split("-");
      const formattedDate = `${year}-${month}-${day}`;

      result.push({
        date: formattedDate,
        completed: trendData.completed,
        pending: trendData.pending,
        sent: trendData.sent,
        total: trendData.total,
      });
    } else {
      // Add empty entry for missing date
      const [day, month, year] = dateStr.split("-");
      const formattedDate = `${year}-${month}-${day}`;

      result.push({
        date: formattedDate,
        completed: 0,
        pending: 0,
        sent: 0,
        total: 0,
      });
    }
  });

  return result;
}

function generateEmptyTrendsData(days) {
  const result = [];
  const now = moment().tz("Asia/Kolkata");

  for (let i = days - 1; i >= 0; i--) {
    const date = now.clone().subtract(i, "days").format("YYYY-MM-DD");
    result.push({
      date: date,
      completed: 0,
      pending: 0,
      sent: 0,
      total: 0,
    });
  }

  return result;
}

async function getRecentActivity(
  query = {},
  limit = 20,
  role,
  user,
  clientCode
) {
  // Strict access control
  if (role === "employee" && (!user || query.listByEmployee !== user)) {
    console.error(
      `Security violation: Employee ${user} attempted invalid query`
    );
    return [];
  } else if (
    role === "client" &&
    (!clientCode || query.clientCode !== clientCode)
  ) {
    console.error(
      `Security violation: Client ${clientCode} attempted invalid query`
    );
    return [];
  }

  const data = await KYC.find({
    ...query,
    $or: [
      { caseStatus: "New Pending" },
      { caseStatus: "Sent" },
      { status: "Closed" },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select(
      "caseId name caseStatus status priority updatedAt clientType clientCode product accountNumber"
    )
    .lean();

  return data;
}

async function fetchDashboardStats(
  query,
  useCache = true,
  role,
  user,
  clientCode
) {
  const cacheKey = `${role}:${user || clientCode || "admin"}`;

  if (useCache && roleBasedCache.has(cacheKey)) {
    const { stats, timestamp } = roleBasedCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return { ...stats, cached: true };
    }
  }

  // Get IST date boundaries
  const { todayStart, todayEnd } = getISTDateBoundaries();

  const currentDate = moment().tz("Asia/Kolkata");
  const year = currentDate.year().toString();
  const month = (currentDate.month() + 1).toString().padStart(2, "0");

  // Use dateIn field instead of createdAt for all queries
  const [
    totalCases,
    monthlyCases,
    totalSentPending,
    totalNewPending,
    totalHighPriority,
    totalClosed,
    todayCases,
    todaySentPending,
    todayNewPending,
    todayHighPriority,
    todayClosed,
    completionRateAgg,
    todayCompletionRateAgg,
  ] = await Promise.all([
    KYC.countDocuments(query),
    KYC.countDocuments({ ...query, month, year }),
    KYC.countDocuments({ ...query, caseStatus: "New Pending" }),
    KYC.countDocuments({ ...query, status: "Pending", caseStatus: "Sent" }),
    KYC.countDocuments({ ...query, priority: "Urgent" }),
    KYC.countDocuments({
      ...query,
      status: { $in: ["Invalid", "CNV", "Closed"] },
    }),
    // Use dateIn field for today's cases with proper date parsing
    KYC.countDocuments({
      ...query,
      dateIn: {
        $regex: currentDate.format("DD-MM-YYYY"),
      },
    }),
    KYC.countDocuments({
      ...query,
      caseStatus: "New Pending",
      dateIn: {
        $regex: currentDate.format("DD-MM-YYYY"),
      },
    }),
    KYC.countDocuments({
      ...query,
      caseStatus: "Sent",
      status: "Pending",
      dateIn: {
        $regex: currentDate.format("DD-MM-YYYY"),
      },
    }),
    KYC.countDocuments({
      ...query,
      priority: "Urgent",
      dateIn: {
        $regex: currentDate.format("DD-MM-YYYY"),
      },
    }),
    KYC.countDocuments({
      ...query,
      status: { $in: ["Invalid", "CNV", "Closed"] },
      dateIn: {
        $regex: currentDate.format("DD-MM-YYYY"),
      },
    }),
    KYC.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $in: ["$status", ["Invalid", "CNV", "Closed"]] }, 1, 0],
            },
          },
        },
      },
    ]),
    KYC.aggregate([
      {
        $match: {
          ...query,
          dateIn: {
            $regex: currentDate.format("DD-MM-YYYY"),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $in: ["$status", ["Invalid", "CNV", "Closed"]] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const totalCompletionRate =
    completionRateAgg[0]?.total > 0
      ? (
          (completionRateAgg[0]?.completed / completionRateAgg[0]?.total) *
          100
        ).toFixed(2)
      : "0.00";

  const todayCompletionRate =
    todayCompletionRateAgg[0]?.total > 0
      ? (
          (todayCompletionRateAgg[0]?.completed /
            todayCompletionRateAgg[0]?.total) *
          100
        ).toFixed(2)
      : "0.00";

  const stats = {
    // Total section
    totalCases,
    monthlyCases,
    totalSentPending,
    totalNewPending,
    totalHighPriority,
    totalClosed,
    totalCompletionRate,

    // Today section
    todayCases,
    todaySentPending,
    todayNewPending,
    todayHighPriority,
    todayClosed,
    todayCompletionRate,

    updatedAt: new Date(),
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
    updatedAt: new Date(),
  };
}

async function sendDashboardUpdates(
  io = null,
  query = {},
  role,
  user,
  clientCode
) {
  try {
    const [stats, trends, activity] = await Promise.all([
      fetchDashboardStats(query, false, role, user, clientCode),
      getVerificationTrendsData(query, role, user, clientCode),
      getRecentActivity(query, 5, role, user, clientCode),
    ]);

    const updateData = { stats, trends, activity };

    if (io) {
      // Send updates to appropriate rooms
      if (role === "employee" && user) {
        io.to(`employee_${user}`).emit("dashboardUpdate", updateData);
      } else if (role === "client" && clientCode) {
        io.to(`client_${clientCode}`).emit("dashboardUpdate", updateData);
      } else {
        // Default to admin room
        io.to("admins").emit("dashboardUpdate", updateData);
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
  sendDashboardUpdates,
  getISTDateBoundaries,
  parseDateInField,
};
