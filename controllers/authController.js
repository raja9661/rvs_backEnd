const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
require('dotenv').config();
const axios = require("axios");
const sendEmail = require("../config/emailService");
const mongoose = require('mongoose');
// Your static list of valid client codes

exports.createUser = async (req, res) => {
  try {
    const {
      name, email, phoneNumber, role, 
      createrId, userId, password,
      clientCode, companyName, address
    } = req.body;

    // Validate required fields
    if (!userId || !password) {
      return res.status(400).json({ message: "User ID and Password are required" });
    }
    let createrName = ''
    if(createrId){
      const creator = await User.findOne({userId:createrId});
      createrName = creator.name
    }

    // Validate client code if role is client
    // Validate client code if role is client
    if (role === 'client') {
      if (!clientCode) {
        return res.status(400).json({ 
          message: "Client code is required for client role",
          field: "clientCode"
        });
      }
      
      // Check if client code is already assigned to an active user
      const existingClient = await User.findOne({ 
        clientCode,
        role: 'client'
      });
      
      if (existingClient) {
        return res.status(400).json({ 
          message: `Client code ${clientCode} is already assigned to active user ${existingClient.name}`,
          field: "clientCode"
        });
      }
    }

    // Check for existing user
    const existingUser = await User.findOne({ 
      $and: [{ email }, { userId }, { phoneNumber }] 
    });
    
    if (existingUser) {
      const field = 
        existingUser.email === email ? "email" :
        existingUser.userId === userId ? "userId" : "phoneNumber";
      
      return res.status(400).json({ 
        message: `${field} already exists`,
        field
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      name,
      email,
      phoneNumber,
      role,
      userId,
      password: hashedPassword,
      companyName,
      address,
      createdBy: createrName,
      showPassword:password,
      ...(role === 'client' && { clientCode })
    };

    const newUser = new User(userData);
    await newUser.save();

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        userId: newUser.userId,
        ...(newUser.clientCode && { clientCode: newUser.clientCode })
      }
    });

  } catch (error) {
    console.error("Error creating user:", error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already exists`,
        field
      });
    }
    
    res.status(500).json({ 
      message: "Error creating user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// Function to get IP address from request
const getIPAddress = (req) => {
  return req.headers["x-forwarded-for"] || req.connection.remoteAddress;
};

exports.login = async (req, res) => {
  try {
    // console.log("Login request received:", req.body);
    
    const { userId, password } = req.body;
    // console.log("userId:",userId)
    
    if (!userId) {
      // console.log("No email or userId provided");
      return res.status(400).json({ message: "Email or User ID is required" });
    }

    if (!password) {
      // console.log("No password provided");
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findOne({ $or: [{ email:userId }, { userId:userId }] }).select('+password');
    
    
    if (!user) {
      // console.log("User not found with:", { email, userId });
      return res.status(404).json({ message: "User not found" });
    }
    if(user.isEnable === "disable"){
      return res.status(404).json({ message: "You Account is Disable please contact to Admin" });
    }

    // console.log("User found:", { id: user._id, email: user.email });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // console.log("Password mismatch");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing!");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const token = jwt.sign(
      { id: userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    // Capture IP Address and Login Time
        // let ipAddress = getIPAddress(req);
        // if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
        //   const ipResponse = await axios.get("https://api64.ipify.org?format=json");
        //   ipAddress = ipResponse.data.ip; // Get actual public IP
        // }
        // const response = await axios.get(`http://ip-api.com/json/${ipAddress}`);
        // console.log(response.data)
    
        // const { city, regionName, country,zip,timezone, lat, lon } = response.data;
        // const loginRecord = {
        //   country,
        //   city,
        //   regionName,
        //   zip,
        //   timezone,
        //   ipAddress,
        //   loginTime: new Date(),
        //   logoutTime: null, // Will be updated on logout
        // };
        // user.loginHistory.push(loginRecord);
        await user.save();

        const safeUser = {
  _id: user._id,
  name:user.name,
  userId: user.userId,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role
};

    // console.log("Login successful for user:", user._id);
    
    res.json({
      message: "Login successful",
      token,
      user:safeUser
    });

  } catch (error) {
    console.error("Login error:", {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      message: "Error logging in",
      error: error.message
    });
  }
};

exports.logout = async (req, res) => {
  const { userId } = req.body;
  // console.log("hello")
  // console.log(userId)
  try {
    const user = await User.findOne({userId});
    if (!user) return res.status(404).json({ message: "User not found" });
    // Find last login record without a logoutTime and update it
    // const lastLogin = user.loginHistory.find((log) => log.logoutTime === null);
    // if (lastLogin) lastLogin.logoutTime = new Date();
    res.json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getLoginHistory = async (req, res) => {
  try {
    const users = await User.find({}, "name email role userId loginHistory");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.getLogDetails = async (req, res) => {
  try {
    let {userId} = req.params
    const users = await User.findOne({userId}, " loginHistory ");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.refresh = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

exports.verify = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ valid: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) return res.status(404).json({ valid: false });
    
    res.json({ 
      valid: true,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
};

// Add this to your backend auth routes
exports.adminLoginAsUser = async (req, res) => {
  try {
    // Verify the requesting user is an admin
    const adminToken = req.headers.authorization?.replace('Bearer ', '');
    if (!adminToken) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decodedAdmin = jwt.verify(adminToken, process.env.JWT_SECRET);
    // console.log("decodedAdmin:",decodedAdmin)
    const adminUser = await User.findOne({userId:decodedAdmin.id});
    // console.log("adminUser:",)
    
    if (!adminUser || !['admin', 'root'].includes(adminUser.role)) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    // Get the target user ID
    const { userId } = req.body;
    // console.log("userId:",userId)
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find the target user
    const targetUser = await User.findOne({userId});
    // console.log("targetUser:",targetUser)
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a token for the target user
    const token = jwt.sign(
      { id: targetUser._id, role: targetUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Short expiration for security
    );

    res.json({
      message: "Login successful",
      token,
      user: targetUser
    });

  } catch (error) {
    console.error("Admin login-as error:", error);
    res.status(500).json({ 
      message: "Error processing request",
      error: error.message
    });
  }
};

///////////******-User Management-*****////////////////

// Get all users with pagination and search
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    // Build search query
    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { role: searchRegex },
          { companyName: searchRegex },
          { address: searchRegex },
          { clientCode: searchRegex }
        ]
      };
    }

    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalUsers: count
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single user
exports.getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Only update password if a new one is provided
    if (updates.password && updates.password.trim() !== '') {
      updates.showPassword = updates.password
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    } else {
      delete updates.password; // Remove password from updates if empty
    }
    
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.send(user);
  } catch (error) {
    res.status(400).send(error);
  }
  // const { id } = req.params;
  // const updateData = { ...req.body };

  // try {
  //   // If password is being updated, hash it first
  //   if (updateData.password) {
  //     const salt = await bcrypt.genSalt(10);
  //     updateData.password = await bcrypt.hash(updateData.password, salt);
  //   }

  //   const user = await User.findByIdAndUpdate(id, updateData, { new: true });

  //   if (!user) {
  //     return res.status(404).json({ success: false, error: 'User not found' });
  //   }
    
  //   res.json({ success: true, data: user });
  // } catch (error) {
  //   if (error.code === 11000) {
  //     return res.status(400).json({ 
  //       success: false, 
  //       error: 'Duplicate field value entered',
  //       fields: Object.keys(error.keyPattern)
  //     });
  //   }
  //   res.status(400).json({ success: false, error: error.message });
  // }
};
// exports.updateUser = async (req, res) => {
//   console.log("hello");
//   const {id} = req.params;
//   console.log(req.body);
//   console.log(id);
//   try {
//     const user = await User.findByIdAndUpdate(req.params.id, req.body);
//     console.log(user)
//     if (!user) {
//       return res.status(404).json({ success: false, error: 'User not found' });
//     }
//     res.json({ success: true, data: user });
//   } catch (error) {
//     if (error.code === 11000) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Duplicate field value entered',
//         fields: Object.keys(error.keyPattern)
//       });
//     }
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

// Delete user

exports.deleteUser = async (req, res) => {
  try {
    // First find the user to get their client code
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Store the client code before deletion
    const clientCode = user.clientCode;
    const userId = user.userId;

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    // If the user was a client, clean up their cases
    if (user.role === 'client' && clientCode) {
      await mongoose.model("KYCdoc").updateMany(
        { clientCode },
        { $set: { 
          clientCode: "deleted_code", 
        }}
      );
    }

    // Also clean up any cases where this user was the assigned user
    await mongoose.model("KYCdoc").updateMany(
      { userId },
      { $set: { 
        userId: "", 
        role: "",
      }}
    );

    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
// exports.deleteUser = async (req, res) => {
//   try {
//     const user = await User.findByIdAndDelete(req.params.id);
//     if (!user) {
//       return res.status(404).json({ success: false, error: 'User not found' });
//     }
//     res.json({ success: true, data: {} });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnable } = req.body;

    if (isEnable !== 'enable' && isEnable !== 'disable') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be "enable" or "disable"' 
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isEnable },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({ 
      success: true, 
      data: user,
      message: `User account ${isEnable}d successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};