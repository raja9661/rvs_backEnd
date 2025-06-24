const express = require("express");

const { 
    addSingle,
    addMultiple,
    getProducts,
    editProduct,
    deleteProducts,
    addClientCode,
    removeClientCode,
    getAllemployeeNandCcode,
    getEmpName,
    addVendorProducts,
    getVendorProducts,
    updateVendorProducts,
    deleteVendorProducts,
    getVendorName,
    removeProductFromVendor,
    getVendors,
    getProductsforvandor,
    getClientCodes,
    getVendorsByType,
    getAllVendors,
    getColumns
} = require("../controllers/MappingController")


const router = express.Router();
router.get('/columns', getColumns);
router.post("/add", addSingle);
router.post("/add-multiple", addMultiple);
router.post("/edit/:id", editProduct);
router.delete("/delete/:id", deleteProducts);
router.get("/getall", getProducts);
router.get("/getEmpName", getEmpName);
router.get("/clientCodes", getClientCodes);
router.get("/Empcode", getAllemployeeNandCcode);
router.post("/addClientCode",addClientCode);
router.delete("/removeClientCode",removeClientCode);

router.get("/getVendors",getVendors)
router.get("/getAllVendors",getAllVendors)
router.get("/getProducts",getProductsforvandor)
router.get("/getVendorName",getVendorName)
router.get("/getVendorProducts",getVendorProducts)
router.post("/addVendor",addVendorProducts)
router.put('/updateVendorProducts/:id', updateVendorProducts);
router.delete('/deleteVendorProducts/:id', deleteVendorProducts);
router.delete("/:vendorId/product/:productName", removeProductFromVendor);
router.get('/type/:type', getVendorsByType);


module.exports = router;
