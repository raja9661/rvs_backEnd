const mongoose = require('mongoose');

// Product Schema
const productSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  updatedProduct: { type: String, required: true },
  correctUPN: { type: String, required: true },
  productType: { type: String, required: true },
}, { timestamps: true });

// Client Code Schema
const clientCodeSchema = new mongoose.Schema({
  EmployeeName: { type: String, required: true },
  clientCode: { type: [String], default: [],required: true },
  clientType: { type: String},
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ManageclientCode = new mongoose.Schema({
  clientCode: { type: String,required: true },
  clientType: { type: String,required: true },
}, { timestamps: true });

// Vendor Product Schema
// const defaultVendorSchema = new mongoose.Schema({
//   productName: [{ type: String, required: true }], // Array of product names
//   vendorName: { type: String, required: true }
// }, { timestamps: true });

const defaultVendorSchema = new mongoose.Schema({
  productName: [{ type: String, required: true }],
  vendorName: { type: String, required: true },
  vendorType: { 
    type: String, 
    required: true,
    enum: ['default', 'other'],
    default: 'other'
  }
}, { timestamps: true });

// Export all models
module.exports = {
  Product: mongoose.model('Product', productSchema),
  ClientCode: mongoose.model('ClientCode', clientCodeSchema),
  Vendor: mongoose.model('VendorProduct', defaultVendorSchema),
  ManageClientCode:mongoose.model('ManageClientCode', ManageclientCode),
};