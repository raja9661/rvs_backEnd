const { Server } = require("socket.io");
const { sendDashboardUpdates } = require("../utils/dashboardUpdates");

let io;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      transports: ['websocket', 'polling'],
      credentials: true
    },
    allowEIO3: true
  });

  io.on('connection', (socket) => {
    const { role, user, clientCode } = socket.handshake.auth;
    console.log(`New connection from ${role} ${user || clientCode || ''}`);

    // Join appropriate room based on role
    if (role === 'employee' && user) {
      socket.join(`employee_${user}`);
    } 
    else if (role === 'client' && clientCode) {
      socket.join(`client_${clientCode}`);
    }
    else if (role === 'admin') {
      socket.join('admins');
    }

    // Handle immediate data request
    socket.on('request-immediate-update', async () => {
      try {
        let query = {};
        if (role === 'employee') {
          query = { listByEmployee: user };
        } 
        else if (role === 'client') {
          query = { clientCode };
        }
        
        await sendDashboardUpdates(io, query, role, user, clientCode);
      } catch (error) {
        console.error('Immediate update error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  setupChangeListeners(io);
}

function setupChangeListeners(io) {
  const KYC = require('../models/kycModel');
  const changeStream = KYC.watch([], { fullDocument: 'updateLookup' });
  
  changeStream.on('change', async (change) => {
    try {
      console.log('Detected database change, triggering updates');
      const sockets = await io.fetchSockets();
      const updateGroups = new Map();
      
      sockets.forEach(socket => {
        const { role, user, clientCode } = socket.handshake.auth;
        const key = `${role}:${user || clientCode || 'admin'}`;
        if (!updateGroups.has(key)) {
          updateGroups.set(key, { role, user, clientCode });
        }
      });
      
      for (const [_, { role, user, clientCode }] of updateGroups) {
        let query = {};
        if (role === 'employee') {
          query = { listByEmployee: user };
        } 
        else if (role === 'client') {
          query = { clientCode };
        }
        
        await sendDashboardUpdates(io, query, role, user, clientCode);
      }
    } catch (error) {
      console.error('Change stream error:', error);
    }
  });
}

function getIo() {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
}

module.exports = { init, getIo };


// // config/socket.js
// const { Server } = require("socket.io");
// const { sendDashboardUpdates } = require("../utils/dashboardUpdates");

// let io;

// function init(server) {
//   io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST"],
//       transports: ['websocket', 'polling'],
//       credentials: true
//     },
//     allowEIO3: true
//   });

//   io.on('connection', (socket) => {
//     const { role, user, clientCode } = socket.handshake.auth;
//     console.log(`New connection from ${role} ${user || ''} ${clientCode || ''}`);

//     // Join appropriate room based on role
//     if (role === 'employee' && user) {
//       socket.join(`employee_${user}`);
//     } else if (role === 'admin') {
//       socket.join('admins');
//     } else if (role === 'client' && clientCode) {
//       socket.join(`client_${clientCode}`);
//     }

//     // Handle immediate data request
//     socket.on('request-immediate-update', async () => {
//       try {
//         let query = {};
//         if (role === 'employee') {
//           query = { listByEmployee: user };
//         } else if (role === 'client') {
//           query = { clientCode };
//         }
//         await sendDashboardUpdates(io, query, role, user, clientCode);
//       } catch (error) {
//         console.error('Immediate update error:', error);
//       }
//     });

//     socket.on('disconnect', () => {
//       console.log(`Client disconnected: ${socket.id}`);
//     });
//   });

//   setupChangeListeners(io);
// }

// function setupChangeListeners(io) {
//   const KYC = require('../models/kycModel');
//   const changeStream = KYC.watch([], { fullDocument: 'updateLookup' });
  
//   changeStream.on('change', async (change) => {
//     try {
//       console.log('Detected database change, triggering updates');
//       const sockets = await io.fetchSockets();
//       const updateGroups = new Map();
      
//       sockets.forEach(socket => {
//         const { role, user, clientCode } = socket.handshake.auth;
//         const key = `${role}:${user || clientCode || 'admin'}`;
//         if (!updateGroups.has(key)) {
//           updateGroups.set(key, { role, user, clientCode });
//         }
//       });
      
//       for (const [_, { role, user, clientCode }] of updateGroups) {
//         let query = {};
//         if (role === 'employee') {
//           query = { listByEmployee: user };
//         } else if (role === 'client') {
//           query = { clientCode };
//         }
//         await sendDashboardUpdates(io, query, role, user, clientCode);
//       }
//     } catch (error) {
//       console.error('Change stream error:', error);
//     }
//   });
// }

// function getIo() {
//   if (!io) throw new Error("Socket.io not initialized!");
//   return io;
// }

// module.exports = { init, getIo };






// // const { Server } = require("socket.io");
// // const { sendDashboardUpdates } = require("../utils/dashboardUpdates");

// // let io;

// // function init(server) {
// //   io = new Server(server, {
// //     cors: {
// //       origin: "*",
// //       methods: ["GET", "POST"],
// //       transports: ['websocket', 'polling'],
// //       credentials: true
// //     },
// //     allowEIO3: true
// //   });

// //   io.on('connection', (socket) => {
// //     const { role, user } = socket.handshake.auth;
// //     console.log(`New connection from ${role} ${user || ''}`);

// //     // Join appropriate room
// //     if (role === 'employee' && user) {
// //       socket.join(`employee_${user}`);
// //     } else if (role === 'admin') {
// //       socket.join('admins');
// //     }

// //     // Handle immediate data request
// //     socket.on('request-immediate-update', async () => {
// //       try {
// //         const query = role === 'admin' ? {} : { listByEmployee: user };
// //         await sendDashboardUpdates(io, query, role, user);
// //       } catch (error) {
// //         console.error('Immediate update error:', error);
// //       }
// //     });

// //     // Handle disconnection
// //     socket.on('disconnect', () => {
// //       console.log(`Client disconnected: ${socket.id}`);
// //     });
// //   });

// //   // Setup database change listeners for real-time updates
// //   setupChangeListeners(io);
// // }

// // function setupChangeListeners(io) {
// //   // This should be implemented based on your database
// //   // For MongoDB you might use Change Streams
// //   // For other databases use appropriate mechanisms
  
// //   // Example for MongoDB:
// //   const KYC = require('../models/kycModel');
  
// //   // Watch for changes in KYC collection
// //   const changeStream = KYC.watch([], { fullDocument: 'updateLookup' });
  
// //   changeStream.on('change', async (change) => {
// //     try {
// //       console.log('Detected database change, triggering updates');
      
// //       // Get all connected sockets
// //       const sockets = await io.fetchSockets();
      
// //       // Group by role/user to minimize duplicate updates
// //       const updateGroups = new Map();
      
// //       sockets.forEach(socket => {
// //         const { role, user } = socket.handshake.auth;
// //         const key = `${role}:${user || 'admin'}`;
// //         if (!updateGroups.has(key)) {
// //           updateGroups.set(key, { role, user });
// //         }
// //       });
      
// //       // Trigger updates for each unique role/user combination
// //       for (const [_, { role, user }] of updateGroups) {
// //         const query = role === 'admin' ? {} : { listByEmployee: user };
// //         await sendDashboardUpdates(io, query, role, user);
// //       }
// //     } catch (error) {
// //       console.error('Change stream error:', error);
// //     }
// //   });
// // }

// // function getIo() {
// //   if (!io) throw new Error("Socket.io not initialized!");
// //   return io;
// // }

// // module.exports = { init, getIo };