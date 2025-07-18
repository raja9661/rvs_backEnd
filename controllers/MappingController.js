const {Product,ClientCode,Vendor,ManageClientCode} = require('../models/MappingItems');
const User = require("../models/users");
const KYCdoc = require('../models/kycModel');
////////////////////****** Client code Management*/////////////////////////////////

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
  const { productName, updatedProduct, correctUPN, productType, clientType, clientCode } = req.body;
  // console.log("hello")

  try {
    // Check if the product already exists
    const existingProduct = await Product.findOne({
      productName,
      updatedProduct,
      correctUPN,
      productType,
    });
    // console.log("hello2")
    if (existingProduct) {
      return res.status(400).json({ message: 'All fields are already present. Skipping addition.' });
    }

    // Create a new product
    const newProduct = new Product({
      productName,
      updatedProduct,
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
          { updatedProduct: { $regex: search, $options: 'i' } },
          { correctUPN: { $regex: search, $options: 'i' } },
          { productType: { $regex: search, $options: 'i' } },
          { clientType: { $regex: search, $options: 'i' } },
          { clientCode: { $regex: search, $options: 'i' } },
        ],
      };
  
      const products = await Product.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();
  
      const count = await Product.countDocuments(query);
  
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
    const { productName, updatedProduct, correctUPN, productType, clientType, clientCode } = req.body;
  
    try {
      const updatedProductData = await Product.findByIdAndUpdate(
        id,
        { productName, updatedProduct, correctUPN, productType, clientType, clientCode },
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
      const deletedProduct = await Product.findByIdAndDelete(id);
  
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

        const vendors = await Vendor.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Vendor.countDocuments(query);

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
    
    const vendors = await Vendor.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Vendor.countDocuments(query);

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
        const product = await Product.distinct("productName");
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
      const existingProducts = await Vendor.find({
        productName: { $in: products }
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
    const existingVendor = await Vendor.findOne({ 
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
    const newVendor = new Vendor({ 
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
        const vendorProducts = await Vendor.find({ vendorName: { $regex: search, $options: 'i' } })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Vendor.countDocuments({ vendorName: { $regex: search, $options: 'i' } });

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
        const vendorName = await Vendor.find({});
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
        const updatedVendorProduct = await Vendor.findByIdAndUpdate(
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
        const vendor = await Vendor.findById(vendorId);

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
        await Vendor.findByIdAndDelete(id);
        res.json({ message: 'Vendor-Product combination deleted successfully' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};