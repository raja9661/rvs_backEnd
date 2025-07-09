const mongoose = require('mongoose');
const moment = require('moment-timezone');

const getFormattedDateTime = () => {
  return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
};

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, required: true, unique: true },

  phoneNumber: { type: String, required: true, index: true }, 

  role: { 
    type: String, 
    required: true, 
    enum: ['admin', 'client', 'employee', 'vendor'] 
  },

  userId: { type: String, required: true, unique: true },

  password: { type: String, required: true },

  companyName: { type: String, required: true },

  address: { type: String, required: true },

  clientCode: { type: String, index: true }, 

  isEnable: { 
    type: String, 
    enum: ['enable', 'disable'],
    default: 'enable' 
  },

  showPassword: { type: String },

  createdBy: { type: String, required: true },

  loginHistory: [
    {
      country: String,
      city: String,
      regionName: String,
      zip: Number,
      timezone: String,
      ipAddress: String,
      loginTime: Date,
      logoutTime: Date,
    },
  ],

  createdAt: { type: String, default: getFormattedDateTime() }
});



module.exports = mongoose.model('User', userSchema);







// const mongoose = require('mongoose');
// const moment = require('moment-timezone');

// const getFormattedDateTime = () => {
//   return moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm:ss A");
// };


// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   phoneNumber: { type: String, required: true},
//   role: { type: String, required: true, enum: ['admin', 'client', 'employee', 'vendor'] },
//   userId: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   companyName: { type: String, required: true },
//   address: { type: String, required: true },
//   clientCode: { type: String },
//   isEnable: { type: String, enum: ['enable', 'disable'] , default:'enable'},
//   showPassword: { type: String },
//   createdBy: { 
//     type: String, // Change from ObjectId to String
//     required: true 
//   },
//   loginHistory: [
//     {
//       country:String,
//       city:String,
//       regionName:String,
//       zip:Number,
//       timezone:String,
//       ipAddress: String,
//       loginTime: Date,
//       logoutTime: Date,
//     },
//   ],
//   createdAt: { type: String, default: getFormattedDateTime() }
// });

// // Add indexes for better query performance
// userSchema.index({ email: 1 });
// userSchema.index({ userId: 1 });
// userSchema.index({ phoneNumber: 1 });
// userSchema.index({ clientCode: 1 });

// module.exports = mongoose.model('User', userSchema);