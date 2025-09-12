const {RevisedProduct,Product,ClientCode,Vendor,ManageClientCode,Allvendors} = require('../models/MappingItems');
const User = require("../models/users");
const KYCdoc = require('../models/kycModel');
const ExcelJS = require('exceljs');
////////////////////****** Client code Management*/////////////////////////////////

exports.addDefaultVendors = async (req, res) => {
  try {
    const records = req.body.records; // array of objects

    if (!Array.isArray(records)) {
      return res.status(400).json({ message: "Records must be an array" });
    }

    // convert productName into array if it's string
    const formattedRecords = records.map(r => ({
      productName: Array.isArray(r.productName) ? r.productName : [r.productName],
      vendorName: r.vendorName,
      vendorType: r.vendorType || "default"
    }));

    const inserted = await Allvendors.insertMany(formattedRecords, { ordered: false });

    return res.status(201).json({
      message: "Records inserted successfully",
      count: inserted.length,
      data: inserted
    });
  } catch (error) {
    return res.status(500).json({ message: "Error inserting records", error: error.message });
  }
};

// Add multiple unique products at once
exports.addProducts = async (req, res) => {
  try {
    const products = req.body.products; // Expecting an array of products

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "No products provided" });
    }

    // Remove duplicates from input (by productName + correctUPN + productType)
    const uniqueProducts = [];
    const seen = new Set();

    for (const p of products) {
      const key = `${p.productName}|${p.correctUPN}|${p.productType}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProducts.push(p);
      }
    }

    // Check for existing products in DB to avoid duplicates
    const bulkOps = [];
    for (const p of uniqueProducts) {
      bulkOps.push({
        updateOne: {
          filter: {
            productName: p.productName,
            correctUPN: p.correctUPN,
            productType: p.productType,
          },
          update: { $setOnInsert: p },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await RevisedProduct.bulkWrite(bulkOps);
    }

    res.status(201).json({ message: "Products inserted successfully" });
  } catch (error) {
    console.error("Error inserting products:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// Add new client code with type
exports.addClientCodeandType = async (req, res) => {
  try {
    const { clientCode, clientType } = req.body;
    
    // Check if client code already exists
    const existingCode = await ManageClientCode.findOne({ clientCode });
    if (existingCode) {
      return res.status(400).json({ message: 'Client code already exists' });
    }
    
    const newCode = new ManageClientCode({ clientCode, clientType });
    await newCode.save();
    
    res.status(201).json(newCode);
  } catch (error) {
    console.error('Error adding client code:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all client codes
exports.getAllClientCodes = async (req, res) => {
  try {
    const codes = await ManageClientCode.find().sort({ clientCode: 1 });
    res.json(codes);
  } catch (error) {
    console.error('Error fetching client codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a client code
exports.deleteClientCode = async (req, res) => {
  try {
    const { id } = req.params;
    // console.log("id:",id)
    const deletedCode = await ManageClientCode.findByIdAndDelete(id);
    
    if (!deletedCode) {
      return res.status(404).json({ message: 'Client code not found' });
    }
    
    res.json({ message: 'Client code deleted successfully' });
  } catch (error) {
    console.error('Error deleting client code:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
////////////////**** */////////////////////////////////////////////
exports.getColumns = (req, res) => {
  try {
    // Extract schema paths and filter out internal fields
    const allFields = Object.keys(KYCdoc.schema.paths)
      .filter(field => !['_id', '__v'].includes(field));

    res.json(allFields);
  } catch (err) {
    console.error('Error fetching columns:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch columns' });
  }
};



//////////////////*****Product-Managemennt*****///////////////////

// Add a single product
exports.addSingle = async (req, res) => {
  const { productName,  correctUPN, productType, clientType, clientCode } = req.body;

  try {
    // Check if the product already exists
    const existingProduct = await RevisedProduct.findOne({
      productName,
      correctUPN,
      productType,
    });
    // console.log("hello2")
    if (existingProduct) {
      return res.status(400).json({ message: 'All fields are already present. Skipping addition.' });
    }

    // Create a new product
    const newProduct = new RevisedProduct({
      productName,
      correctUPN,
      productType,
    });
    // console.log("hello3")

    // Save the product to the database
    await newProduct.save();
    res.status(201).json({ message: 'Product added successfully!', product: newProduct });
  } catch (error) {
    res.status(500).json({ message: 'Error adding product', error: error.message });
  }
};

// Add multiple products
exports.addMultiple = async (req, res) => {
  const {products} = req.body;

  try {
    const savedProducts = [];
    const skippedProducts = [];

    for (const product of products) {
      const { productName, updatedProduct, correctUPN, productType } = product;

      // Check if the product already exists
      const existingProduct = await Product.findOne({
        productName,
        updatedProduct,
        correctUPN,
        productType,
      });

      if (existingProduct) {
        skippedProducts.push(product);
        continue;
      }

      // Create a new product
      const newProduct = new Product({
        productName,
        updatedProduct,
        correctUPN,
        productType,
      });

      // Save the product to the database
      await newProduct.save();
      savedProducts.push(newProduct);
    }

    res.status(201).json({
      message: 'Products processed successfully!',
      savedProducts,
      skippedProducts,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding products', error: error.message });
  }
};

exports.getProducts = async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;

    try {
      const query = {
        $or: [
          { productName: { $regex: search, $options: 'i' } },
          { correctUPN: { $regex: search, $options: 'i' } },
          { productType: { $regex: search, $options: 'i' } },
          { clientType: { $regex: search, $options: 'i' } },
          { clientCode: { $regex: search, $options: 'i' } },
        ],
      };
  
      const products = await RevisedProduct.find(query).sort({ _id: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();
  
      const count = await RevisedProduct.countDocuments(query);
  
      res.status(200).json({
        products,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
};

// Edit a product
exports.editProduct =  async (req, res) => {
    const { id } = req.params;
    const { productName,  correctUPN, productType, clientType, clientCode } = req.body;
  
    try {
      const updatedProductData = await RevisedProduct.findByIdAndUpdate(
        id,
        { productName,  correctUPN, productType, clientType, clientCode },
        { new: true } // Return the updated product
      );
  
      if (!updatedProductData) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      res.status(200).json({ message: 'Product updated successfully!', product: updatedProductData });
    } catch (error) {
      res.status(500).json({ message: 'Error updating product', error: error.message });
    }
  };
  
  // Delete a product
  exports.deleteProducts =  async (req, res) => {
    const { id } = req.params;
    // console.log(id);
  
    try {
      const deletedProduct = await RevisedProduct.findByIdAndDelete(id);
  
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      res.status(200).json({ message: 'Product deleted successfully!', product: deletedProduct });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
  };

////////////////////****Employee-Management******//////////////////  

  // exports.addClientCode = async(req,res) =>{
  //   try {
  //     const { employeeName, clientCodes } = req.body;
  
  //     if (!employeeName || !clientCodes || clientCodes.length === 0) {
  //       return res.status(400).json({ message: "Employee name and at least one client code are required" });
  //     }
  
  //     // Find existing record or create new one
  //     const existingRecord = await ClientCode.findOne({ EmployeeName: employeeName });
  
  //     if (existingRecord) {
  //       // Add new codes and avoid duplicates
  //       const uniqueNewCodes = clientCodes.filter(code => 
  //         !existingRecord.clientCode.includes(code)
  //       );
  //       existingRecord.clientCode = [...existingRecord.clientCode, ...uniqueNewCodes];
  //       await existingRecord.save();
  //       return res.status(200).json({ message: "Client codes updated successfully", data: existingRecord });
  //     } else {
  //       // Create new record
  //       const newClientCode = new ClientCode({
  //         EmployeeName: employeeName,
  //         clientCode: clientCodes
  //       });
  //       await newClientCode.save();
  //       return res.status(201).json({ message: "Client codes assigned successfully", data: newClientCode });
  //     }
  //   } catch (error) {
  //     console.error("Error in addClientCode:", error);
  //     res.status(500).json({ message: "Server error while assigning client codes" });
  //   }
  // }
  exports.addClientCode = async(req,res) => {
    try {
        const { employeeName, clientCodes } = req.body;

        if (!employeeName || !clientCodes || clientCodes.length === 0) {
            return res.status(400).json({ message: "Employee name and at least one client code are required" });
        }

        // Check if any of the client codes are already assigned to other employees
        const existingAssignments = await ClientCode.find({
            clientCode: { $in: clientCodes },
            EmployeeName: { $ne: employeeName } // Exclude current employee if updating
        });

        if (existingAssignments.length > 0) {
            // Collect all conflicting codes and their current assignees
            const conflicts = [];
            existingAssignments.forEach(record => {
                record.clientCode.forEach(code => {
                    if (clientCodes.includes(code)) {
                        conflicts.push({
                            code,
                            assignedTo: record.EmployeeName
                        });
                    }
                });
            });

            return res.status(409).json({ 
                message: "Same client codes are already assigned to other employees",
                conflicts
            });
        }

        // Find existing record or create new one
        const existingRecord = await ClientCode.findOne({ EmployeeName: employeeName });

        if (existingRecord) {
            // Add new codes and avoid duplicates (within the same employee)
            const uniqueNewCodes = clientCodes.filter(code => 
                !existingRecord.clientCode.includes(code)
            );
            existingRecord.clientCode = [...existingRecord.clientCode, ...uniqueNewCodes];
            await existingRecord.save();
            return res.status(200).json({ message: "Client codes updated successfully", data: existingRecord });
        } else {
            // Create new record
            const newClientCode = new ClientCode({
                EmployeeName: employeeName,
                clientCode: clientCodes
            });
            await newClientCode.save();
            return res.status(201).json({ message: "Client codes assigned successfully", data: newClientCode });
        }
    } catch (error) {
        console.error("Error in addClientCode:", error);
        res.status(500).json({ message: "Server error while assigning client codes" });
    }
}
  exports.removeClientCode = async(req,res) =>{
    try {
      const { employeeName, clientCode } = req.body;
  
      if (!employeeName || !clientCode) {
        return res.status(400).json({ message: "Employee name and client code are required" });
      }
  
      const employeeRecord = await ClientCode.findOne({ EmployeeName: employeeName });
  
      if (!employeeRecord) {
        return res.status(404).json({ message: "Employee record not found" });
      }
  
      // Filter out the client code to remove
      employeeRecord.clientCode = employeeRecord.clientCode.filter(
        code => code !== clientCode
      );
  
      await employeeRecord.save();
  
      // If no more client codes, delete the record
      if (employeeRecord.clientCode.length === 0) {
        await ClientCode.deleteOne({ _id: employeeRecord._id });
        return res.status(200).json({ message: "Client code removed and employee record deleted" });
      }
  
      res.status(200).json({ message: "Client code removed successfully", data: employeeRecord });
    } catch (error) {
      console.error("Error in removeClientCode:", error);
      res.status(500).json({ message: "Server error while removing client code" });
    }
  }

  exports.getAllemployeeNandCcode = async (req, res) => {
    try {
      const mappings = await ClientCode.find({});
      res.status(200).json(mappings);
    } catch (error) {
      console.error("Error in getAllMappings:", error);
      res.status(500).json({ message: "Server error while fetching mappings" });
    }
  };

  exports.getEmpName = async (req,res) =>{
    try {
      const empName = await User.find({role:"employee"})
      res.status(200).json(empName);
    } catch (error) {
      res.status(500).json({ message: "Server error while fetching Employee-Name" });
    }
  }
  // Controller

  exports.getClientCodes = async (req, res) => {
  try {
    // Since clientCode is now a single string, we can use distinct directly
    const codes = await ManageClientCode.distinct("clientCode"); 
    res.json({ success: true, data: codes });
  } catch (error) {
    console.error("Error fetching client codes:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch client codes",
      error: error.message 
    });
  }
};
// exports.getClientCodes = async (req, res) => {
//   try {
//     const codes = await ClientCode.distinct("clientCode"); // Gets all unique codes
//     const flattenedCodes = codes.flat(); // Flatten nested arrays (since clientCode is [String])
//     res.json({ success: true, data: flattenedCodes });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Failed to fetch client codes" });
//   }
// };

///////////////////****Vendor-Management *****////////////////  

// exports.getVendorsByType = async (req, res) => {
//   const { type } = req.params;
//   try {
//     const vendors = await Vendor.find({ vendorType: type });
//     res.json(vendors);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };
exports.getVendorsByType = async (req, res) => {
     
    const { type } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;

    try {
        const query = {
            vendorType: type,
            vendorName: { $regex: search, $options: 'i' } // case-insensitive search
        };

        const vendors = await Allvendors.find(query).sort({ _id: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Allvendors.countDocuments(query);

        res.json({
            vendors,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAllVendors = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  
  try {
    const query = {
      $or: [
        { vendorName: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } }
      ]
    };
    
    const vendors = await Allvendors.find(query).sort({ _id: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Allvendors.countDocuments(query);

    res.json({
      vendors,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getVendors = async (req, res) => {
    try {
        const vendors = await User.find({role:"vendor"});
        res.json(vendors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getProductsforvandor = async (req, res) => {
    try {
        const product = await Allvendors.distinct("productName");
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// exports.addVendorProducts = async (req, res) => {
//   const { vendorName, products, vendorType = 'other' } = req.body;

//   try {
//     const existingVendor = await Vendor.findOne({ vendorName, vendorType });

//     if (existingVendor) {
//       const existingProducts = existingVendor.productName;
//       const newProducts = products.filter(
//         product => !existingProducts.includes(product)
//       );

//       if (newProducts.length > 0) {
//         existingVendor.productName = [...existingProducts, ...newProducts];
//         await existingVendor.save();
//         res.status(200).json(existingVendor);
//       } else {
//         res.status(200).json({ message: "All products already assigned to the vendor." });
//       }
//     } else {
//       const vendorProduct = new Vendor({ vendorName, productName: products, vendorType });
//       await vendorProduct.save();
//       res.status(201).json(vendorProduct);
//     }
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// };
exports.addVendorProducts = async (req, res) => {
  const { vendorName, products, vendorType = 'other' } = req.body;

  try {
    // Validate input
    if (!vendorName || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'vendorName and products array are required' });
    }

    // Only check product conflicts when vendorType is 'default'
    if (vendorType === 'default') {
      const existingProducts = await Allvendors.find({
        productName: { $in: products } , vendorType:"default"
      });

      const duplicateProducts = [];
      const newProducts = products.filter(product => {
        const isDuplicate = existingProducts.some(vendor => 
          vendor.productName.includes(product)
        );
        if (isDuplicate) {
          duplicateProducts.push({
            product,
            existingVendors: existingProducts
              .filter(v => v.productName.includes(product))
              .map(v => v.vendorName)
          });
          return false;
        }
        return true;
      });

      if (duplicateProducts.length > 0) {
        return res.status(400).json({
          message: `Products cannot be assigned to multiple default vendors`,
          duplicates: duplicateProducts
        });
      }
    }

    // Always check if vendor with same name+type exists (regardless of vendorType)
    const existingVendor = await Allvendors.findOne({ 
      vendorName, 
      vendorType 
    });

    if (existingVendor) {
      // Add only products that aren't already assigned to this vendor
      const existingProducts = existingVendor.productName;
      const productsToAdd = vendorType === 'default' 
        ? products // For default, we already validated no conflicts
        : products.filter(p => !existingProducts.includes(p));

      if (productsToAdd.length > 0) {
        existingVendor.productName = [...existingProducts, ...productsToAdd];
        await existingVendor.save();
        return res.status(200).json({
          message: "Added products to existing vendor",
          vendor: existingVendor,
          addedProducts: productsToAdd
        });
      }
      return res.status(200).json({ 
        message: "All products already assigned to this vendor",
        vendor: existingVendor
      });
    }

    // Create new vendor
    const newVendor = new Allvendors({ 
      vendorName, 
      productName: products, // All products are new (for default) or unchecked (for others)
      vendorType 
    });
    await newVendor.save();
    return res.status(201).json({
      message: "Created new vendor with products",
      vendor: newVendor
    });

  } catch (err) {
    console.error('Error in addVendorProducts:', err);
    return res.status(500).json({ 
      message: 'Server error processing vendor products',
      error: err.message 
    });
  }
};
// exports.addVendorProducts = async (req, res) => {
//   const { vendorName, products, vendorType = 'other' } = req.body;

//   try {
//     // Check if any vendor already has any of these products with the same vendorType
//     const existingCombinations = await Vendor.find({
//       vendorType,
//       productName: { $in: products }
//     });

//     // Filter out products that already exist with this vendorType (regardless of vendorName)
//     const duplicateProducts = [];
//     const newProducts = products.filter(product => {
//       const isDuplicate = existingCombinations.some(vendor => 
//         vendor.productName.includes(product)
//       );
//       if (isDuplicate) {
//         duplicateProducts.push(product);
//         return false;
//       }
//       return true;
//     });

//     if (duplicateProducts.length > 0) {
//       return res.status(400).json({
//         message: `Some products already exist with vendorType '${vendorType}'`,
//         duplicates: duplicateProducts,
//         existingVendors: existingCombinations.map(v => v.vendorName)
//       });
//     }

//     // Check if vendor with this name and type already exists
//     const existingVendor = await Vendor.findOne({ vendorName, vendorType });

//     if (existingVendor) {
//       // Add only new products that aren't already assigned to this vendor
//       const existingProducts = existingVendor.productName;
//       const vendorNewProducts = newProducts.filter(
//         product => !existingProducts.includes(product)
//       );

//       if (vendorNewProducts.length > 0) {
//         existingVendor.productName = [...existingProducts, ...vendorNewProducts];
//         await existingVendor.save();
//         return res.status(200).json({
//           message: "Added new products to existing vendor",
//           vendor: existingVendor
//         });
//       } else {
//         return res.status(200).json({ 
//           message: "All products already assigned to this vendor" 
//         });
//       }
//     } else {
//       // Create new vendor with these products
//       const vendorProduct = new Vendor({ 
//         vendorName, 
//         productName: newProducts, 
//         vendorType 
//       });
//       await vendorProduct.save();
//       return res.status(201).json(vendorProduct);
//     }
//   } catch (err) {
//     return res.status(400).json({ message: err.message });
//   }
// };

exports.getVendorProducts = async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    try {
        const vendorProducts = await Allvendors.find({ vendorName: { $regex: search, $options: 'i' } })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Allvendors.countDocuments({ vendorName: { $regex: search, $options: 'i' } });

        res.json({
            vendorProducts,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getVendorName = async (req, res) => {
   
    try {
        const vendorName = await Allvendors.distinct("vendorName");
        res.json({
            vendorName
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


exports.updateVendorProducts = async (req, res) => {
    const { id } = req.params;
    const { vendorName, products,vendorType } = req.body;
    try {
        const updatedVendorProduct = await Allvendors.findByIdAndUpdate(
            id,
            { vendorName, productName:products,vendorType },
            { new: true }
        );
        res.json(updatedVendorProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.removeProductFromVendor = async (req, res) => {
    const { vendorId, productName } = req.params;
    // console.log(vendorId)
    // console.log("hello")

    try {
        // Find the vendor by ID
        const vendor = await Allvendors.findById(vendorId);

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found." });
        }

        // Remove the product from the vendor's productName array
        vendor.productName = vendor.productName.filter(
            (product) => product !== productName
        );

        // Save the updated vendor
        await vendor.save();

        res.status(200).json({ message: "Product removed successfully.", vendor });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};
exports.deleteVendorProducts = async (req, res) => {
    const { id } = req.params;
    try {
        await Allvendors.findByIdAndDelete(id);
        res.json({ message: 'Vendor-Product combination deleted successfully' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// ************ Client-Management **********************

// helper to build match object from query
function buildMatch(query) {
  const match = {};
  const { year, month, clientCode, userId, product, status } = query;
  if (year) match.year = String(year);
  if (month) match.month = String(month);
  if (clientCode) match.clientCode = String(clientCode);
  if (userId) match.userId = String(userId);
  if (product) match.product = String(product);
  if (status) match.status = String(status);
  return match;
}

// GET /api/client-tracker/summary
// Group by userId + clientCode, compute totals & completionRate (rounded to 3 decimals)
exports.getClientTrackerSummary = async (req, res) => {
  try {
    const match = buildMatch(req.query);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 500);
    const skip = (page - 1) * limit;

    // Helper function to create case-insensitive regex
    const createCaseInsensitiveFilter = (value) => {
      if (!value) return null;
      return { $regex: value, $options: 'i' };
    };

    // Add search functionality to match stage
    if (req.query.search) {
      const searchRegex = createCaseInsensitiveFilter(req.query.search);
      match.$or = [
        { userId: searchRegex },
        { clientCode: searchRegex }
      ];
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { userId: '$userId', clientCode: '$clientCode' },
          total: { $sum: 1 },
          totalClosed: {
            $sum: {
              $cond: [
                {
                  $in: [
                    { $toLower: { $ifNull: ['$status', ''] } },
                    ['closed', 'complete', 'completed', 'done']
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          userId: '$_id.userId',
          clientCode: '$_id.clientCode',
          total: 1,
          totalClosed: 1,
          completionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $round: [{ $multiply: [{ $divide: ['$totalClosed', '$total'] }, 100] }, 3] },
              0
            ]
          }
        }
      },
      { $sort: { userId: 1, clientCode: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: 'totalGroups' }]
        }
      }
    ];

    const result = await KYCdoc.aggregate(pipeline);
    const data = result[0]?.data || [];
    const totalGroups = result[0]?.meta?.[0]?.totalGroups || 0;

    return res.json({ page, limit, totalGroups, data });
  } catch (err) {
    console.error('getClientTrackerSummary error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// exports.getClientTrackerSummary = async (req, res) => {
//   try {
//     const match = buildMatch(req.query);
//     const page = Math.max(parseInt(req.query.page || '1', 10), 1);
//     const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 500);
//     const skip = (page - 1) * limit;

//     const pipeline = [
//       { $match: match },
//       {
//         $group: {
//           _id: { userId: '$userId', clientCode: '$clientCode' },
//           total: { $sum: 1 },
//           totalClosed: {
//             $sum: {
//               $cond: [
//                 {
//                   $in: [
//                     { $toLower: { $ifNull: ['$status', ''] } },
//                     ['closed', 'complete', 'completed', 'done']
//                   ]
//                 },
//                 1,
//                 0
//               ]
//             }
//           }
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           userId: '$_id.userId',
//           clientCode: '$_id.clientCode',
//           total: 1,
//           totalClosed: 1,
//           completionRate: {
//             $cond: [
//               { $gt: ['$total', 0] },
//               { $round: [{ $multiply: [{ $divide: ['$totalClosed', '$total'] }, 100] }, 3] },
//               0
//             ]
//           }
//         }
//       },
//       { $sort: { userId: 1, clientCode: 1 } },
//       {
//         $facet: {
//           data: [{ $skip: skip }, { $limit: limit }],
//           meta: [{ $count: 'totalGroups' }]
//         }
//       }
//     ];

//     const result = await KYCdoc.aggregate(pipeline);
//     const data = result[0]?.data || [];
//     const totalGroups = result[0]?.meta?.[0]?.totalGroups || 0;

//     return res.json({ page, limit, totalGroups, data });
//   } catch (err) {
//     console.error('getClientTrackerSummary error:', err);
//     return res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };

// GET /api/client-tracker/cases?userId=...&clientCode=...&page=1&limit=50
exports.getUserCases = async (req, res) => {
  try {
   
    const { userId, clientCode } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 1000);
    const skip = (page - 1) * limit;

    const find = { userId: String(userId) };
    if (clientCode) find.clientCode = String(clientCode);

    const [items, count] = await Promise.all([
      KYCdoc.find(find)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          caseId: 1,
          product: 1,
          correctUPN: 1,
          updatedProductName: 1,
          status: 1,
          caseStatus: 1,
          listByEmployee: 1,
          vendorStatus: 1,
          clientCode: 1,
          userId: 1,
          accountNumber: 1,
          requirement: 1,
          dateIn: 1,
          vendorName: 1,
          dateOut: 1,
          sentBy: 1,
          vendorName: 1,
          attachments: 1,
          createdAt: 1
        })
        .lean(),
      KYCdoc.countDocuments(find)
    ]);

    return res.json({ page, limit, total: count, items });
  } catch (err) {
    console.error('getUserCases error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// GET /api/client-tracker/download?userId=...&clientCode=...
exports.downloadUserCasesExcel = async (req, res) => {
  try {
  const { userId, clientCode } = req.query;
  if (!userId) return res.status(400).json({ message: 'userId is required' });

  const find = { userId: String(userId) };
  if (clientCode) find.clientCode = String(clientCode);

  const cursor = KYCdoc.find(find).sort({ createdAt: -1 }).lean().cursor();

  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: true
  });

  const worksheet = workbook.addWorksheet('Cases');

  worksheet.columns = [
    { header: 'User ID', key: 'userId', width: 18 },
    { header: 'Case ID', key: 'caseId', width: 18 },
    { header: 'Attachments', key: 'attachments', width: 24 }, // added
    { header: 'Remarks', key: 'remarks', width: 22 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Details', key: 'details', width: 22 },
    { header: 'Details 1', key: 'details1', width: 22 },
    { header: 'Priority', key: 'priority', width: 16 },
    { header: 'Correct UPN', key: 'correctUPN', width: 20 },
    { header: 'Product', key: 'product', width: 20 },
    { header: 'Updated Product', key: 'updatedProductName', width: 24 },
    { header: 'Product Type', key: 'productType', width: 18 },
    { header: 'Account Number', key: 'accountNumber', width: 20 },
    { header: 'Account Number Digit', key: 'accountNumberDigit', width: 22 },
    { header: 'Requirement', key: 'requirement', width: 24 },
    { header: 'Updated Requirement', key: 'updatedRequirement', width: 26 },
    { header: 'Bank Code', key: 'bankCode', width: 16 },
    { header: 'Client Code', key: 'clientCode', width: 18 },
    { header: 'Client Type', key: 'clientType', width: 18 },
    { header: 'Client TAT', key: 'clientTAT', width: 18 },
    { header: 'Vendor Name', key: 'vendorName', width: 20 },
    { header: 'Vendor Rate', key: 'vendorRate', width: 18 },
    { header: 'Client Rate', key: 'clientRate', width: 18 },
    { header: 'Vendor Status', key: 'vendorStatus', width: 20 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Case Status', key: 'caseStatus', width: 20 },
    { header: 'List Of Employee', key: 'listByEmployee', width: 22 },
    { header: 'Date In', key: 'dateIn', width: 18 },
    { header: 'Date In (Day)', key: 'dateInDate', width: 20 },
    { header: 'Date Out', key: 'dateOut', width: 18 },
    { header: 'Date Out (Day)', key: 'dateOutInDay', width: 20 },
    { header: 'Sent By', key: 'sentBy', width: 18 },
    { header: 'Auto/Manual', key: 'autoOrManual', width: 18 },
    { header: 'Case Done By', key: 'caseDoneBy', width: 22 },
    { header: 'Customer Care', key: 'customerCare', width: 22 },
    { header: 'Sent Date', key: 'sentDate', width: 20 },
    { header: 'Sent Date (Day)', key: 'sentDateInDay', width: 22 },
    { header: 'Dedup By', key: 'dedupBy', width: 20 },
    { header: 'Name Upload By', key: 'NameUploadBy', width: 22 },
    { header: 'Refer By', key: 'ReferBy', width: 20 },
    { header: 'Is Rechecked', key: 'isRechecked', width: 16 },
    { header: 'Is Dedup', key: 'isDedup', width: 16 },
    { header: 'Rechecked At', key: 'recheckedAt', width: 22 },
    { header: 'IP Address', key: 'ipAddress', width: 20 },
    { header: 'Year', key: 'year', width: 12 },
    { header: 'Month', key: 'month', width: 12 },
    { header: 'Modifyed At', key: 'ModifyedAt', width: 22 }
  ];

  const fileName = `cases_${userId}${clientCode ? `_${clientCode}` : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  for await (const r of cursor) {
    let row = worksheet.addRow({
      userId: r.userId || '',
      caseId: r.caseId || '',
      remarks: r.remarks || '',
      name: r.name || '',
      details: r.details || '',
      details1: r.details1 || '',
      priority: r.priority || '',
      correctUPN: r.correctUPN || '',
      product: r.product || '',
      updatedProductName: r.updatedProductName || '',
      productType: r.productType || '',
      accountNumber: r.accountNumber || '',
      accountNumberDigit: r.accountNumberDigit || '',
      requirement: r.requirement || '',
      updatedRequirement: r.updatedRequirement || '',
      bankCode: r.bankCode || '',
      clientCode: r.clientCode || '',
      clientType: r.clientType || '',
      clientTAT: r.clientTAT || '',
      vendorName: r.vendorName || '',
      vendorRate: r.vendorRate || '',
      clientRate: r.clientRate || '',
      vendorStatus: r.vendorStatus || '',
      status: r.status || '',
      caseStatus: r.caseStatus || '',
      listByEmployee: r.listByEmployee || '',
      dateIn: r.dateIn || '',
      dateInDate: r.dateInDate || '',
      dateOut: r.dateOut || '',
      dateOutInDay: r.dateOutInDay || '',
      sentBy: r.sentBy || '',
      autoOrManual: r.autoOrManual || '',
      caseDoneBy: r.caseDoneBy || '',
      customerCare: r.customerCare || '',
      sentDate: r.sentDate || '',
      sentDateInDay: r.sentDateInDay || '',
      dedupBy: r.dedupBy || '',
      NameUploadBy: r.NameUploadBy || '',
      ReferBy: r.ReferBy || '',
      isRechecked: r.isRechecked || '',
      isDedup: r.isDedup || '',
      recheckedAt: r.recheckedAt ? new Date(r.recheckedAt).toISOString() : '',
      ipAddress: r.ipAddress || '',
      year: r.year || '',
      month: r.month || '',
      role: r.role || '',
      ModifyedAt:r.ModifyedAt || '',
    });

    // 🔗 Add hyperlink for first attachment
    if (r.attachments && Array.isArray(r.attachments)) {
      let firstAttachment = r.attachments[0];
      if (firstAttachment && firstAttachment.location) {
        let cell = row.getCell("attachments");
        cell.value = { text: "Open Attachment", hyperlink: firstAttachment.location };
        cell.font = { color: { argb: 'FF0000FF' }, underline: true };
      }
    }

    row.commit();
  }

  worksheet.commit();
  await workbook.commit();
}

//   try {
//     const { userId, clientCode } = req.query;
//     if (!userId) return res.status(400).json({ message: 'userId is required' });

//     const find = { userId: String(userId) };
//     if (clientCode) find.clientCode = String(clientCode);

//     const cursor = KYCdoc.find(find).sort({ createdAt: -1 }).lean().cursor();

//     const ExcelJS = require('exceljs');
//     const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
//       stream: res,
//       useStyles: true,
//       useSharedStrings: true
//     });

//     const worksheet = workbook.addWorksheet('Cases');

//     worksheet.columns = [
//   { header: 'User ID', key: 'userId', width: 18 },
//   { header: 'Case ID', key: 'caseId', width: 18 },
//   { header: 'Remarks', key: 'remarks', width: 22 },
//   { header: 'Name', key: 'name', width: 20 },
//   { header: 'Details', key: 'details', width: 22 },
//   { header: 'Details 1', key: 'details1', width: 22 },
//   { header: 'Priority', key: 'priority', width: 16 },
//   { header: 'Correct UPN', key: 'correctUPN', width: 20 },
//   { header: 'Product', key: 'product', width: 20 },
//   { header: 'Updated Product', key: 'updatedProductName', width: 24 },
//   { header: 'Product Type', key: 'productType', width: 18 },
//   { header: 'Account Number', key: 'accountNumber', width: 20 },
//   { header: 'Account Number Digit', key: 'accountNumberDigit', width: 22 },
//   { header: 'Requirement', key: 'requirement', width: 24 },
//   { header: 'Updated Requirement', key: 'updatedRequirement', width: 26 },
//   { header: 'Bank Code', key: 'bankCode', width: 16 },
//   { header: 'Client Code', key: 'clientCode', width: 18 },
//   { header: 'Client Type', key: 'clientType', width: 18 },
//   { header: 'Client TAT', key: 'clientTAT', width: 18 },
//   { header: 'Vendor Name', key: 'vendorName', width: 20 },
//   { header: 'Vendor Rate', key: 'vendorRate', width: 18 },
//   { header: 'Client Rate', key: 'clientRate', width: 18 },
//   { header: 'Vendor Status', key: 'vendorStatus', width: 20 },
//   { header: 'Status', key: 'status', width: 16 },
//   { header: 'Case Status', key: 'caseStatus', width: 20 },
//   { header: 'List Of Employee', key: 'listByEmployee', width: 22 },
//   { header: 'Date In', key: 'dateIn', width: 18 },
//   { header: 'Date In (Day)', key: 'dateInDate', width: 20 },
//   { header: 'Date Out', key: 'dateOut', width: 18 },
//   { header: 'Date Out (Day)', key: 'dateOutInDay', width: 20 },
//   { header: 'Sent By', key: 'sentBy', width: 18 },
//   { header: 'Auto/Manual', key: 'autoOrManual', width: 18 },
//   { header: 'Case Done By', key: 'caseDoneBy', width: 22 },
//   { header: 'Customer Care', key: 'customerCare', width: 22 },
//   { header: 'Sent Date', key: 'sentDate', width: 20 },
//   { header: 'Sent Date (Day)', key: 'sentDateInDay', width: 22 },
//   { header: 'Dedup By', key: 'dedupBy', width: 20 },
//   { header: 'Name Upload By', key: 'NameUploadBy', width: 22 },
//   { header: 'Refer By', key: 'ReferBy', width: 20 },
//   { header: 'Is Rechecked', key: 'isRechecked', width: 16 },
//   { header: 'Is Dedup', key: 'isDedup', width: 16 },
//   { header: 'Rechecked At', key: 'recheckedAt', width: 22 },
//   { header: 'IP Address', key: 'ipAddress', width: 20 },
//   { header: 'Year', key: 'year', width: 12 },
//   { header: 'Month', key: 'month', width: 12 },
//   { header: 'Role', key: 'role', width: 14 },
//   { header: 'Created At', key: 'createdAt', width: 22 },
//   { header: 'Updated At', key: 'updatedAt', width: 22 }
// ];


//     // worksheet.columns = [
//     //   { header: 'User ID', key: 'userId', width: 18 },
//     //   { header: 'Client Code', key: 'clientCode', width: 16 },
//     //   { header: 'Case ID', key: 'caseId', width: 18 },
//     //   { header: 'Product', key: 'product', width: 20 },
//     //   { header: 'Updated Product', key: 'updatedProductName', width: 22 },
//     //   { header: 'Correct UPN', key: 'correctUPN', width: 18 },
//     //   { header: 'Status', key: 'status', width: 14 },
//     //   { header: 'Case Status', key: 'caseStatus', width: 18 },
//     //   { header: 'List Of Employee', key: 'listByEmployee', width: 20 },
//     //   { header: 'Vendor Status', key: 'vendorStatus', width: 18 },
//     //   { header: 'Vendor Name', key: 'vendorName', width: 18 },
//     //   { header: 'Requirement', key: 'requirement', width: 24 },
//     //   { header: 'Account Number', key: 'accountNumber', width: 20 },
//     //   { header: 'Date In', key: 'dateIn', width: 16 },
//     //   { header: 'Date Out', key: 'dateOut', width: 16 },
//     //   { header: 'Sent By', key: 'sentBy', width: 16 },
//     //   { header: 'Created At', key: 'createdAt', width: 22 }
//     // ];

//     const fileName = `cases_${userId}${clientCode ? `_${clientCode}` : ''}.xlsx`;
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//     for await (const r of cursor) {
//       worksheet.addRow({
//         userId: r.userId || '',
//         clientCode: r.clientCode || '',
//         caseId: r.caseId || '',
//         product: r.product || '',
//         updatedProductName: r.updatedProductName || '',
//         correctUPN: r.correctUPN || '',
//         status: r.status || '',
//         caseStatus: r.caseStatus || '',
//         listByEmployee: r.listByEmployee || '',
//         vendorStatus: r.vendorStatus || '',
//         vendorName: r.vendorName || '',
//         requirement: r.requirement || '',
//         accountNumber: r.accountNumber || '',
//         dateIn: r.dateIn || '',
//         dateOut: r.dateOut || '',
//         sentBy: r.sentBy || '',
//         createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : ''
//       }).commit(); 
//     }

//     worksheet.commit();
//     await workbook.commit(); // closes the stream
//   } 
  catch (err) {
    console.error('downloadUserCasesExcel error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
};

