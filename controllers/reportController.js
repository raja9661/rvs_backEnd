const KYC = require("../models/kycModel");
const ExcelJS = require("exceljs");
const moment = require("moment");

const buildDateRangeQuery = (filters) => {
  const dateConditions = [];
  const queryParams = [];

  // Date In range
  if (filters.dateInStart) {
    dateConditions.push('dateIn >= ?');
    queryParams.push(filters.dateInStart);
  }
  if (filters.dateInEnd) {
    dateConditions.push('dateIn <= ?');
    queryParams.push(filters.dateInEnd);
  }

  // Date Out range
  if (filters.dateOutStart) {
    dateConditions.push('dateOut >= ?');
    queryParams.push(filters.dateOutStart);
  }
  if (filters.dateOutEnd) {
    dateConditions.push('dateOut <= ?');
    queryParams.push(filters.dateOutEnd);
  }

  // Sent Date
  if (filters.sentDate) {
    dateConditions.push('sentDate = ?');
    queryParams.push(filters.sentDate);
  }

  return {
    conditions: dateConditions.length > 0 ? dateConditions.join(' AND ') : '1=1',
    params: queryParams
  };
};


// function buildDateRangeQuery(startDate, endDate, fieldName = 'dateIn') {
//   if (!startDate && !endDate) return {};
  
//   const dateFilter = {};
  
//   if (startDate && endDate) {
//     if (startDate === endDate) {
//       dateFilter[fieldName] = { $regex: `^${moment(startDate).format("DD-MM-YYYY")}` };
//     } else {
//       const start = moment(startDate).format("DD-MM-YYYY");
//       const end = moment(endDate).format("DD-MM-YYYY");
//       dateFilter[fieldName] = { 
//         $gte: start,
//         $lte: end
//       };
//     }
//   } else if (startDate) {
//     dateFilter[fieldName] = { $gte: moment(startDate).format("DD-MM-YYYY") };
//   } else if (endDate) {
//     dateFilter[fieldName] = { $lte: moment(endDate).format("DD-MM-YYYY") };
//   }

//   return dateFilter;
// }

// Get Report Data with Proper Pagination
exports.getReportData = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 50, // Default page size
      searchQuery = "",
      product,
      productType,
      status,
      caseStatus,
      dateInStart,
      dateInEnd,
      dateOutStart,
      dateOutEnd,
      sentDate,
      vendorStatus,
      priority,
      clientType,
      clientCode,
      year,
      month,
    } = req.query;

    console.log('Received filters:', req.query);

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    let query = {};

    // Search functionality
    if (searchQuery && searchQuery.trim() !== '') {
      const regex = { $regex: searchQuery, $options: "i" };
      query.$or = [
        { caseId: regex },
        { userId: regex },
        { remarks: regex },
        { name: regex },
        { details: regex },
        { details1: regex },
        { clientCode: regex },
        { product: regex },
      ];
    }

    // Apply filters
    if (product && product.trim() !== '') query.product = product;
    if (productType && productType.trim() !== '') query.productType = productType;
    if (status && status.trim() !== '') query.status = status;
    if (caseStatus && caseStatus.trim() !== '') query.caseStatus = caseStatus;
    if (vendorStatus && vendorStatus.trim() !== '') query.vendorStatus = vendorStatus;
    if (priority && priority.trim() !== '') query.priority = priority;
    if (clientCode && clientCode.trim() !== '') query.clientCode = clientCode;
    if (clientType && clientType.trim() !== '') query.clientType = clientType;
    
    // Fix month filter
    if (month && month.trim() !== '') {
      query.month = month.toString();
    }
    
    if (year && year.trim() !== '') {
      query.year = year.toString();
    }

    // Date range filtering
    // Replace just the date range filtering section in your existing getReportData function:

// DATE RANGE FILTERING - SIMPLE REGEX APPROACH
if (dateInStart || dateInEnd) {
  const dateInConditions = {};
  
  if (dateInStart) {
    const startFormatted = moment(dateInStart).format("DD-MM-YYYY");
    dateInConditions.$regex = `^${startFormatted}`;
  }
  
  if (dateInEnd) {
    const endFormatted = moment(dateInEnd).format("DD-MM-YYYY");
    if (dateInConditions.$regex) {
      // If both start and end dates, create range pattern
      const startMoment = moment(dateInStart);
      const endMoment = moment(dateInEnd);
      const dates = [];
      let current = startMoment.clone();
      
      while (current <= endMoment) {
        dates.push(current.format("DD-MM-YYYY"));
        current.add(1, 'day');
      }
      
      if (dates.length > 0) {
        dateInConditions.$regex = `^(${dates.join('|')})`;
      }
    } else {
      dateInConditions.$regex = `^${endFormatted}`;
    }
  }
  
  if (Object.keys(dateInConditions).length > 0) {
    query.dateIn = dateInConditions;
  }
}

// Do the same for dateOut...
if (dateOutStart || dateOutEnd) {
  const dateOutConditions = {};
  
  if (dateOutStart) {
    const startFormatted = moment(dateOutStart).format("DD-MM-YYYY");
    dateOutConditions.$regex = `^${startFormatted}`;
  }
  
  if (dateOutEnd) {
    const endFormatted = moment(dateOutEnd).format("DD-MM-YYYY");
    if (dateOutConditions.$regex) {
      const startMoment = moment(dateOutStart);
      const endMoment = moment(dateOutEnd);
      const dates = [];
      let current = startMoment.clone();
      
      while (current <= endMoment) {
        dates.push(current.format("DD-MM-YYYY"));
        current.add(1, 'day');
      }
      
      if (dates.length > 0) {
        dateOutConditions.$regex = `^(${dates.join('|')})`;
      }
    } else {
      dateOutConditions.$regex = `^${endFormatted}`;
    }
  }
  
  if (Object.keys(dateOutConditions).length > 0) {
    query.dateOut = dateOutConditions;
  }
}

    if (sentDate && sentDate.trim() !== '') {
      query.sentDate = { $regex: `^${moment(sentDate).format("DD-MM-YYYY")}` };
    }

    console.log('Final query:', query);

    const [reportData, totalCount] = await Promise.all([
      KYC.find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KYC.countDocuments(query),
    ]);

    console.log(`Found ${reportData.length} records out of ${totalCount} total`);

    const result = {
      success: true,
      data: reportData,
      total: totalCount,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching report data:", error);
    res.status(500).json({ success: false, message: "Failed to fetch data", error: error.message });
  }
};

// Download Excel Report - Fixed Date Issues
exports.downloadReportExcel = async (req, res) => {
  try {
    const { selectedCaseIds, ...filters } = req.query;
    
    // Set longer timeout for large exports
    req.setTimeout(600000); // 10 minutes
    res.setTimeout(600000);

    let query = {};

    // If specific case IDs are provided, use only those
    if (selectedCaseIds && selectedCaseIds.length > 0) {
      const caseIdArray = Array.isArray(selectedCaseIds) ? selectedCaseIds : [selectedCaseIds];
      query.caseId = { $in: caseIdArray };
    } else {
      // Build complete query
      const { searchQuery, product, productType, status, caseStatus, dateInStart, dateInEnd, dateOutStart, dateOutEnd, sentDate, vendorStatus, priority, clientType, clientCode, year, month } = filters;

      if (searchQuery && searchQuery.trim() !== '') {
        const regex = { $regex: searchQuery, $options: "i" };
        query.$or = [
          { caseId: regex },
          { userId: regex },
          { name: regex },
          { clientCode: regex },
          { product: regex },
        ];
      }

      if (product && product.trim() !== '') query.product = product;
      if (productType && productType.trim() !== '') query.productType = productType;
      if (status && status.trim() !== '') query.status = status;
      if (caseStatus && caseStatus.trim() !== '') query.caseStatus = caseStatus;
      if (vendorStatus && vendorStatus.trim() !== '') query.vendorStatus = vendorStatus;
      if (priority && priority.trim() !== '') query.priority = priority;
      if (clientCode && clientCode.trim() !== '') query.clientCode = clientCode;
      if (clientType && clientType.trim() !== '') query.clientType = clientType;
      
      if (month && month.trim() !== '') query.month = month.toString();
      if (year && year.trim() !== '') query.year = year.toString();

      // Optimized date queries

             if (dateInStart || dateInEnd) {
      const dateInConditions = {};
      
      if (dateInStart) {
        const startFormatted = moment(dateInStart).format("DD-MM-YYYY");
        dateInConditions.$regex = `^${startFormatted}`;
      }
      
      if (dateInEnd) {
        const endFormatted = moment(dateInEnd).format("DD-MM-YYYY");
        if (dateInConditions.$regex) {
          // If both start and end dates, create range pattern
          const startMoment = moment(dateInStart);
          const endMoment = moment(dateInEnd);
          const dates = [];
          let current = startMoment.clone();
          
          while (current <= endMoment) {
            dates.push(current.format("DD-MM-YYYY"));
            current.add(1, 'day');
          }
          
          if (dates.length > 0) {
            dateInConditions.$regex = `^(${dates.join('|')})`;
          }
        } else {
          dateInConditions.$regex = `^${endFormatted}`;
        }
      }
      
      if (Object.keys(dateInConditions).length > 0) {
        query.dateIn = dateInConditions;
      }
    }

    // Date Out range - EXACTLY LIKE getReportData
    if (dateOutStart || dateOutEnd) {
      const dateOutConditions = {};
      
      if (dateOutStart) {
        const startFormatted = moment(dateOutStart).format("DD-MM-YYYY");
        dateOutConditions.$regex = `^${startFormatted}`;
      }
      
      if (dateOutEnd) {
        const endFormatted = moment(dateOutEnd).format("DD-MM-YYYY");
        if (dateOutConditions.$regex) {
          const startMoment = moment(dateOutStart);
          const endMoment = moment(dateOutEnd);
          const dates = [];
          let current = startMoment.clone();
          
          while (current <= endMoment) {
            dates.push(current.format("DD-MM-YYYY"));
            current.add(1, 'day');
          }
          
          if (dates.length > 0) {
            dateOutConditions.$regex = `^(${dates.join('|')})`;
          }
        } else {
          dateOutConditions.$regex = `^${endFormatted}`;
        }
      }
      
      if (Object.keys(dateOutConditions).length > 0) {
        query.dateOut = dateOutConditions;
      }
    }

      
    }

    console.log(`Starting streaming export for query...`);

    // SET HEADERS BEFORE CREATING THE STREAM
    const fileName = `kyc_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Create streaming workbook AFTER setting headers
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ 
      stream: res,
      useStyles: true,
      useSharedStrings: true
    });
    
    const worksheet = workbook.addWorksheet('KYC Reports');

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'serialNumber', width: 8 },
      { header: 'Case ID', key: 'caseId', width: 18 },
      { header: 'Attachments', key: 'attachments', width: 25 },
      { header: 'Remarks', key: 'remarks', width: 22 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Details', key: 'details', width: 22 },
      { header: 'Details 1', key: 'details1', width: 22 },
      { header: 'Updated Requirement', key: 'updatedRequirement', width: 26 },
      { header: 'Vendor Rate', key: 'vendorRate', width: 18 },
      { header: 'Priority', key: 'priority', width: 16 },
      { header: 'Correct UPN', key: 'correctUPN', width: 20 },
      { header: 'Product', key: 'product', width: 20 },
      { header: 'Account Number', key: 'accountNumber', width: 20 },
      { header: 'Requirement', key: 'requirement', width: 24 },
      { header: 'Account Number Digit', key: 'accountNumberDigit', width: 22 },
      { header: 'Bank Code', key: 'bankCode', width: 16 },
      { header: 'Client Code', key: 'clientCode', width: 18 },
      { header: 'Vendor Name', key: 'vendorName', width: 20 },
      { header: 'Vendor Status', key: 'vendorStatus', width: 20 },
      { header: 'Date In', key: 'dateIn', width: 18 },
      { header: 'Date In Day', key: 'dateInDate', width: 20 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Case Status', key: 'caseStatus', width: 20 },
      { header: 'Product Type', key: 'productType', width: 18 },
      { header: 'List By Employee', key: 'listByEmployee', width: 22 },
      { header: 'Date Out', key: 'dateOut', width: 18 },
      { header: 'Date Out Day', key: 'dateOutInDay', width: 20 },
      { header: 'Sent By', key: 'sentBy', width: 18 },
      { header: 'Auto Or Manual', key: 'autoOrManual', width: 18 },
      { header: 'Case Done By', key: 'caseDoneBy', width: 22 },
      { header: 'Client TAT', key: 'clientTAT', width: 18 },
      { header: 'Customer Care', key: 'customerCare', width: 22 },
      { header: 'Name Upload By', key: 'NameUploadBy', width: 22 },
      { header: 'Sent Date', key: 'sentDate', width: 20 },
      { header: 'Sent Date Day', key: 'sentDateInDay', width: 22 },
      { header: 'Client Type', key: 'clientType', width: 18 },
      { header: 'Dedup By', key: 'dedupBy', width: 20 },
      { header: 'IP Address', key: 'ipAddress', width: 20 },
      { header: 'Is Rechecked', key: 'isRechecked', width: 16 },
      { header: 'Refer By', key: 'ReferBy', width: 20 },
      { header: 'User ID', key: 'userId', width: 18 },
      { header: 'Client Rate', key: 'clientRate', width: 18 },
      { header: 'Is Dedup', key: 'isDedup', width: 16 },
      { header: 'Rechecked At', key: 'recheckedAt', width: 22 },
      { header: 'Year', key: 'year', width: 12 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Modifyed At', key: 'ModifyedAt', width: 22 }
    ];

    // Add and style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };
    headerRow.commit();

    // Use cursor for memory-efficient streaming
    let serialNumber = 1;
    const cursor = KYC.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .cursor({ batchSize: 1000 });

    console.log('Starting data streaming...');

    // Process records in batches
    for await (const record of cursor) {
      const rowData = {
        serialNumber: serialNumber++,
        caseId: record.caseId || '',
        attachments: record.attachments?.length > 0 ? 'View Attachment' : 'No File',
        remarks: record.remarks || '',
        name: record.name || '',
        details: record.details || '',
        details1: record.details1 || '',
        updatedRequirement: record.updatedRequirement || '',
        vendorRate: record.vendorRate || '',
        priority: record.priority || '',
        correctUPN: record.correctUPN || '',
        product: record.product || '',
        accountNumber: record.accountNumber || '',
        requirement: record.requirement || '',
        accountNumberDigit: record.accountNumberDigit || '',
        bankCode: record.bankCode || '',
        clientCode: record.clientCode || '',
        vendorName: record.vendorName || '',
        vendorStatus: record.vendorStatus || '',
        dateIn: record.dateIn || '',
        dateInDate: record.dateInDate || '',
        status: record.status || '',
        caseStatus: record.caseStatus || '',
        productType: record.productType || '',
        listByEmployee: record.listByEmployee || '',
        dateOut: record.dateOut || '',
        dateOutInDay: record.dateOutInDay || '',
        sentBy: record.sentBy || '',
        autoOrManual: record.autoOrManual || '',
        caseDoneBy: record.caseDoneBy || '',
        clientTAT: record.clientTAT || '',
        customerCare: record.customerCare || '',
        NameUploadBy: record.NameUploadBy || '',
        sentDate: record.sentDate || '',
        sentDateInDay: record.sentDateInDay || '',
        clientType: record.clientType || '',
        dedupBy: record.dedupBy || '',
        ipAddress: record.ipAddress || '',
        isRechecked: record.isRechecked ? 'Yes' : 'No',
        ReferBy: record.ReferBy || '',
        userId: record.userId || '',
        clientRate: record.clientRate || '',
        isDedup: record.isDedup ? 'Yes' : 'No',
        recheckedAt: record.recheckedAt || '',
        year: record.year || '',
        month: record.month || '',
        ModifyedAt: record.ModifyedAt || ''
      };

      const row = worksheet.addRow(rowData);

      // Add hyperlink for attachments
      if (record.attachments && Array.isArray(record.attachments) && record.attachments[0]?.location) {
        const attachmentCell = row.getCell('attachments');
        attachmentCell.value = {
          text: 'View Attachment',
          hyperlink: record.attachments[0].location
        };
        attachmentCell.font = {
          color: { argb: 'FF0000FF' },
          underline: true
        };
      }

      // Style serial number
      const serialNumberCell = row.getCell('serialNumber');
      serialNumberCell.alignment = { horizontal: 'center' };

      row.commit();

      // Yield to event loop periodically
      if (serialNumber % 1000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        console.log(`Processed ${serialNumber} records...`);
      }
    }

    console.log(`Completed processing ${serialNumber - 1} records`);

    // FINALIZE - Don't set headers again, just commit the workbook
    await workbook.commit();
    console.log('Excel file streaming completed');

  } catch (err) {
    console.error('Download report error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    } else {
      // If headers already sent, we can't send JSON response
      console.error('Headers already sent, cannot send error response');
      // Optionally, you can destroy the response to prevent hanging
      res.destroy();
    }
  }
};
// exports.downloadReportExcel = async (req, res) => {
//   try {
//     const { selectedCaseIds, ...filters } = req.query;
    
//     let query = {};

//     // If specific case IDs are provided, use only those
//     if (selectedCaseIds && selectedCaseIds.length > 0) {
//       const caseIdArray = Array.isArray(selectedCaseIds) ? selectedCaseIds : [selectedCaseIds];
//       query.caseId = { $in: caseIdArray };
//     } else {
//       // Build complete query
//       const { searchQuery, product, productType, status, caseStatus, dateInStart, dateInEnd, dateOutStart, dateOutEnd, sentDate, vendorStatus, priority, clientType, clientCode, year, month } = filters;

//       console.log("month:",month)

//       if (searchQuery && searchQuery.trim() !== '') {
//         const regex = { $regex: searchQuery, $options: "i" };
//         query.$or = [
//           { caseId: regex },
//           { userId: regex },
//           { name: regex },
//           { clientCode: regex },
//           { product: regex },
//         ];
//       }

//       if (product && product.trim() !== '') query.product = product;
//       if (productType && productType.trim() !== '') query.productType = productType;
//       if (status && status.trim() !== '') query.status = status;
//       if (caseStatus && caseStatus.trim() !== '') query.caseStatus = caseStatus;
//       if (vendorStatus && vendorStatus.trim() !== '') query.vendorStatus = vendorStatus;
//       if (priority && priority.trim() !== '') query.priority = priority;
//       if (clientCode && clientCode.trim() !== '') query.clientCode = clientCode;
//       if (clientType && clientType.trim() !== '') query.clientType = clientType;
      
//       if (month && month.trim() !== '') query.month = month.toString();
//       if (year && year.trim() !== '') query.year = year.toString();


//        if (dateInStart || dateInEnd) {
//       const dateInConditions = {};
      
//       if (dateInStart) {
//         const startFormatted = moment(dateInStart).format("DD-MM-YYYY");
//         dateInConditions.$regex = `^${startFormatted}`;
//       }
      
//       if (dateInEnd) {
//         const endFormatted = moment(dateInEnd).format("DD-MM-YYYY");
//         if (dateInConditions.$regex) {
//           // If both start and end dates, create range pattern
//           const startMoment = moment(dateInStart);
//           const endMoment = moment(dateInEnd);
//           const dates = [];
//           let current = startMoment.clone();
          
//           while (current <= endMoment) {
//             dates.push(current.format("DD-MM-YYYY"));
//             current.add(1, 'day');
//           }
          
//           if (dates.length > 0) {
//             dateInConditions.$regex = `^(${dates.join('|')})`;
//           }
//         } else {
//           dateInConditions.$regex = `^${endFormatted}`;
//         }
//       }
      
//       if (Object.keys(dateInConditions).length > 0) {
//         query.dateIn = dateInConditions;
//       }
//     }

//     // Date Out range - EXACTLY LIKE getReportData
//     if (dateOutStart || dateOutEnd) {
//       const dateOutConditions = {};
      
//       if (dateOutStart) {
//         const startFormatted = moment(dateOutStart).format("DD-MM-YYYY");
//         dateOutConditions.$regex = `^${startFormatted}`;
//       }
      
//       if (dateOutEnd) {
//         const endFormatted = moment(dateOutEnd).format("DD-MM-YYYY");
//         if (dateOutConditions.$regex) {
//           const startMoment = moment(dateOutStart);
//           const endMoment = moment(dateOutEnd);
//           const dates = [];
//           let current = startMoment.clone();
          
//           while (current <= endMoment) {
//             dates.push(current.format("DD-MM-YYYY"));
//             current.add(1, 'day');
//           }
          
//           if (dates.length > 0) {
//             dateOutConditions.$regex = `^(${dates.join('|')})`;
//           }
//         } else {
//           dateOutConditions.$regex = `^${endFormatted}`;
//         }
//       }
      
//       if (Object.keys(dateOutConditions).length > 0) {
//         query.dateOut = dateOutConditions;
//       }
//     }

//       // if (dateInStart || dateInEnd) {
//       //   Object.assign(query, buildDateRangeQuery(dateInStart, dateInEnd, 'dateIn'));
//       // }

//       // if (dateOutStart || dateOutEnd) {
//       //   Object.assign(query, buildDateRangeQuery(dateOutStart, dateOutEnd, 'dateOut'));
//       // }
//     }

//     const data = await KYC.find(query).sort({ createdAt: -1 }).lean();

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('KYC Reports');

//     // Define columns in EXACT order as you specified
//     worksheet.columns = [
//       { header: 'S.No', key: 'serialNumber', width: 8 },
//       { header: 'Case ID', key: 'caseId', width: 18 },
//       { header: 'Attachments', key: 'attachments', width: 25 },
//       { header: 'Remarks', key: 'remarks', width: 22 },
//       { header: 'Name', key: 'name', width: 20 },
//       { header: 'Details', key: 'details', width: 22 },
//       { header: 'Details 1', key: 'details1', width: 22 },
//       { header: 'Updated Requirement', key: 'updatedRequirement', width: 26 },
//       { header: 'Vendor Rate', key: 'vendorRate', width: 18 },
//       { header: 'Priority', key: 'priority', width: 16 },
//       { header: 'Correct UPN', key: 'correctUPN', width: 20 },
//       { header: 'Product', key: 'product', width: 20 },
//       // { header: 'Updated Product Name', key: 'updatedProductName', width: 24 },
//       { header: 'Account Number', key: 'accountNumber', width: 20 },
//       { header: 'Requirement', key: 'requirement', width: 24 },
//       { header: 'Account Number Digit', key: 'accountNumberDigit', width: 22 },
//       { header: 'Bank Code', key: 'bankCode', width: 16 },
//       { header: 'Client Code', key: 'clientCode', width: 18 },
//       { header: 'Vendor Name', key: 'vendorName', width: 20 },
//       { header: 'Vendor Status', key: 'vendorStatus', width: 20 },
//       { header: 'Date In', key: 'dateIn', width: 18 },
//       { header: 'Date In Day', key: 'dateInDate', width: 20 },
//       { header: 'Status', key: 'status', width: 16 },
//       { header: 'Case Status', key: 'caseStatus', width: 20 },
//       { header: 'Product Type', key: 'productType', width: 18 },
//       { header: 'List By Employee', key: 'listByEmployee', width: 22 },
//       { header: 'Date Out', key: 'dateOut', width: 18 },
//       { header: 'Date Out Day', key: 'dateOutInDay', width: 20 },
//       { header: 'Sent By', key: 'sentBy', width: 18 },
//       { header: 'Auto Or Manual', key: 'autoOrManual', width: 18 },
//       { header: 'Case Done By', key: 'caseDoneBy', width: 22 },
//       { header: 'Client TAT', key: 'clientTAT', width: 18 },
//       { header: 'Customer Care', key: 'customerCare', width: 22 },
//       { header: 'Name Upload By', key: 'NameUploadBy', width: 22 },
//       { header: 'Sent Date', key: 'sentDate', width: 20 },
//       { header: 'Sent Date Day', key: 'sentDateInDay', width: 22 },
//       { header: 'Client Type', key: 'clientType', width: 18 },
//       { header: 'Dedup By', key: 'dedupBy', width: 20 },
//       { header: 'IP Address', key: 'ipAddress', width: 20 },
//       { header: 'Is Rechecked', key: 'isRechecked', width: 16 },
//       { header: 'Refer By', key: 'ReferBy', width: 20 },
//       { header: 'User ID', key: 'userId', width: 18 },
//       { header: 'Client Rate', key: 'clientRate', width: 18 },
//       { header: 'Is Dedup', key: 'isDedup', width: 16 },
//       { header: 'Rechecked At', key: 'recheckedAt', width: 22 },
//       { header: 'Year', key: 'year', width: 12 },
//       { header: 'Month', key: 'month', width: 12 },
//       { header: 'Modifyed At', key: 'ModifyedAt', width: 22 }
//     ];

//     // Add header row
//     const headerRow = worksheet.getRow(1);
//     headerRow.font = { bold: true };
//     headerRow.fill = {
//       type: 'pattern',
//       pattern: 'solid',
//       fgColor: { argb: 'FFE6E6FA' }
//     };

//     // Add data rows with serial numbers and hyperlinks
//     data.forEach((record, index) => {
//       const row = worksheet.addRow({
//         serialNumber: index + 1, // Add serial number starting from 1
//         caseId: record.caseId || '',
//         attachments: record.attachments?.length > 0 ? 'View Attachment' : 'No File',
//         remarks: record.remarks || '',
//         name: record.name || '',
//         details: record.details || '',
//         details1: record.details1 || '',
//         updatedRequirement: record.updatedRequirement || '',
//         vendorRate: record.vendorRate || '',
//         priority: record.priority || '',
//         correctUPN: record.correctUPN || '',
//         product: record.product || '',
//         updatedProductName: record.updatedProductName || '',
//         accountNumber: record.accountNumber || '',
//         requirement: record.requirement || '',
//         accountNumberDigit: record.accountNumberDigit || '',
//         bankCode: record.bankCode || '',
//         clientCode: record.clientCode || '',
//         vendorName: record.vendorName || '',
//         vendorStatus: record.vendorStatus || '',
//         dateIn: record.dateIn || '',
//         dateInDate: record.dateInDate || '',
//         status: record.status || '',
//         caseStatus: record.caseStatus || '',
//         productType: record.productType || '',
//         listByEmployee: record.listByEmployee || '',
//         dateOut: record.dateOut || '',
//         dateOutInDay: record.dateOutInDay || '',
//         sentBy: record.sentBy || '',
//         autoOrManual: record.autoOrManual || '',
//         caseDoneBy: record.caseDoneBy || '',
//         clientTAT: record.clientTAT || '',
//         customerCare: record.customerCare || '',
//         NameUploadBy: record.NameUploadBy || '',
//         sentDate: record.sentDate || '',
//         sentDateInDay: record.sentDateInDay || '',
//         clientType: record.clientType || '',
//         dedupBy: record.dedupBy || '',
//         ipAddress: record.ipAddress || '',
//         isRechecked: record.isRechecked ? 'Yes' : 'No',
//         ReferBy: record.ReferBy || '',
//         userId: record.userId || '',
//         clientRate: record.clientRate || '',
//         isDedup: record.isDedup ? 'Yes' : 'No',
//         recheckedAt: record.recheckedAt || '',
//         year: record.year || '',
//         month: record.month || '',
//         ModifyedAt: record.ModifyedAt || ''
//       });

//       // Add hyperlink for first attachment
//       if (record.attachments && Array.isArray(record.attachments) && record.attachments[0]?.location) {
//         const attachmentCell = row.getCell('attachments');
//         attachmentCell.value = {
//           text: 'View Attachment',
//           hyperlink: record.attachments[0].location
//         };
//         attachmentCell.font = {
//           color: { argb: 'FF0000FF' },
//           underline: true
//         };
//       }

//       // Style the serial number column to be centered
//       const serialNumberCell = row.getCell('serialNumber');
//       serialNumberCell.alignment = { horizontal: 'center' };
//     });

//     const fileName = `kyc_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//     await workbook.xlsx.write(res);
//     res.end();

//   } catch (err) {
//     console.error('Download report error:', err);
//     if (!res.headersSent) {
//       return res.status(500).json({ message: 'Server error', error: err.message });
//     }
//   }
// };


exports.updateCellData = async (req, res) => {
  try {
    const { caseId, field, value } = req.body;

    if (!caseId || !field) {
      return res.status(400).json({ 
        success: false, 
        message: "Case ID and field are required" 
      });
    }

    const updateData = { 
      [field]: value,
      ModifyedAt: moment().format('DD-MM-YYYY, hh:mm:ss A') // Fixed format to match your data
    };

    const result = await KYC.findOneAndUpdate(
      { caseId: caseId },
      { $set: updateData },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: "Record not found" 
      });
    }

    res.json({
      success: true,
      message: "Cell updated successfully",
      data: result
    });
  } catch (error) {
    console.error("Error updating cell data:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update cell data",
      error: error.message 
    });
  }
};




// const KYC = require("../models/kycModel");
// const ExcelJS = require("exceljs");
// const moment = require("moment");

// // Helper function to generate date range regex
// function generateDateRangeRegex(startDate, endDate) {
//   const start = moment(startDate, "DD-MM-YYYY");
//   const end = moment(endDate, "DD-MM-YYYY");
//   const dates = [];

//   let current = start.clone();
//   while (current <= end) {
//     dates.push(current.format("DD-MM-YYYY"));
//     current.add(1, "day");
//   }

//   return dates.join("|");
// }

// // Helper function to build date range query
// function buildDateRangeQuery(startDate, endDate, fieldName = 'dateIn') {
//   if (!startDate && !endDate) return {};
  
//   const dateFilter = {};
  
//   // Handle date format conversion (YYYY-MM-DD to DD-MM-YYYY if needed)
//   const startDateStr = startDate ? moment(startDate).format("DD-MM-YYYY") : null;
//   const endDateStr = endDate ? moment(endDate).format("DD-MM-YYYY") : null;

//   if (startDateStr && endDateStr) {
//     if (startDateStr === endDateStr) {
//       dateFilter[fieldName] = { $regex: `^${startDateStr}` };
//     } else {
//       const dateRangeRegex = new RegExp(`^(${generateDateRangeRegex(startDateStr, endDateStr)})`);
//       dateFilter[fieldName] = { $regex: dateRangeRegex };
//     }
//   } else if (startDateStr) {
//     dateFilter[fieldName] = { $regex: `^${startDateStr}` };
//   } else if (endDateStr) {
//     const dateRangeRegex = new RegExp(`^(${generateDateRangeRegex("01-01-2000", endDateStr)})`);
//     dateFilter[fieldName] = { $regex: dateRangeRegex };
//   }

//   return dateFilter;
// }

// // Get Report Data (Admin Only) - SHOW ALL DATA INITIALLY
// exports.getReportData = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       pageSize = 10000, // Large page size to get all data for AG Grid
//       searchQuery = "",
//       // All filter parameters
//       product,
//       productType,
//       status,
//       caseStatus,
//       dateInStart,
//       dateInEnd,
//       dateOutStart,
//       dateOutEnd,
//       sentDate,
//       vendorStatus,
//       priority,
//       clientType,
//       clientCode,
//       year,
//       month,
//       day,
//       ...otherFilters
//     } = req.query;

//     console.log('Received filters:', req.query); // Debug log

//     const skip = (page - 1) * pageSize;
//     let query = {};

//     // Search functionality - ALL fields (only if searchQuery is provided)
//     if (searchQuery && searchQuery.trim() !== '') {
//       const regex = { $regex: searchQuery, $options: "i" };
//       query.$or = [
//         { caseId: regex },
//         { userId: regex },
//         { remarks: regex },
//         { name: regex },
//         { details: regex },
//         { details1: regex },
//         { priority: regex },
//         { correctUPN: regex },
//         { product: regex },
//         { updatedProductName: regex },
//         { accountNumber: regex },
//         { requirement: regex },
//         { updatedRequirement: regex },
//         { accountNumberDigit: regex },
//         { bankCode: regex },
//         { clientCode: regex },
//         { vendorName: regex },
//         { dateIn: regex },
//         { dateInDate: regex },
//         { status: regex },
//         { caseStatus: regex },
//         { productType: regex },
//         { listByEmployee: regex },
//         { dateOut: regex },
//         { dateOutInDay: regex },
//         { sentBy: regex },
//         { autoOrManual: regex },
//         { caseDoneBy: regex },
//         { clientTAT: regex },
//         { customerCare: regex },
//         { sentDate: regex },
//         { sentDateInDay: regex },
//         { clientType: regex },
//         { dedupBy: regex },
//         { vendorRate: regex },
//         { clientRate: regex },
//         { NameUploadBy: regex },
//         { ReferBy: regex },
//         { ipAddress: regex },
//         { vendorStatus: regex },
//         { year: regex },
//         { month: regex },
//         { "attachments.filename": regex },
//         { "attachments.originalname": regex },
//         { "attachments.key": regex },
//       ];
//     }

//     // Apply filters only if they have values
//     if (product && product.trim() !== '') query.product = product;
//     if (productType && productType.trim() !== '') query.productType = productType;
//     if (status && status.trim() !== '') query.status = status;
//     if (caseStatus && caseStatus.trim() !== '') query.caseStatus = caseStatus;
//     if (vendorStatus && vendorStatus.trim() !== '') query.vendorStatus = vendorStatus;
//     if (priority && priority.trim() !== '') query.priority = priority;
//     if (clientCode && clientCode.trim() !== '') query.clientCode = clientCode;
//     if (clientType && clientType.trim() !== '') query.clientType = clientType;
//     if (year && year.trim() !== '') query.year = year;
//     if (month && month.trim() !== '') query.month = month;

//     // Date range filtering (only if dates are provided)
//     if (dateInStart || dateInEnd) {
//   Object.assign(query, buildDateRangeQuery(dateInStart, dateInEnd, 'dateIn'));
// }

// if (dateOutStart || dateOutEnd) {
//   const dateOutQuery = buildDateRangeQuery(dateOutStart, dateOutEnd, 'dateOut');
//   if (Object.keys(dateOutQuery).length > 0) {
//     dateOutQuery.dateOut.$ne = "";
//     dateOutQuery.dateOut.$exists = true;
//     Object.assign(query, dateOutQuery);
//   }
// }
//     if (sentDate && sentDate.trim() !== '') {
//       query.sentDate = { $regex: `^${sentDate}`, $options: "i" };
//     }

//     // Other array filters
//     Object.entries(otherFilters).forEach(([key, value]) => {
//       if (Array.isArray(value) && value.length > 0) {
//         query[key] = { $in: value };
//       }
//     });

//     console.log('Final query:', query); // Debug log

//     const [reportData, totalCount] = await Promise.all([
//       KYC.find(query)
//         .sort({ _id: -1 })
//         .skip(skip)
//         .limit(parseInt(pageSize)),
//       KYC.countDocuments(query),
//     ]);

//     console.log(`Found ${reportData.length} records`); // Debug log

//     res.json({
//       success: true,
//       data: reportData,
//       pagination: {
//         total: totalCount,
//         page: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalPages: Math.ceil(totalCount / pageSize),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching report data:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch data", error: error.message });
//   }
// };

// // Download Excel Report (Admin Only) - ALL columns
// exports.downloadReportExcel = async (req, res) => {
//   try {
//     const {
//       searchQuery,
//       product,
//       productType,
//       status,
//       caseStatus,
//       dateInStart,
//       dateInEnd,
//       dateOutStart,
//       dateOutEnd,
//       sentDate,
//       vendorStatus,
//       priority,
//       clientType,
//       clientCode,
//       year,
//       month,
//     } = req.query;

//     let query = {};

//     // Build complete query (same logic as getReportData)
//     if (searchQuery && searchQuery.trim() !== '') {
//       const regex = { $regex: searchQuery, $options: "i" };
//       query.$or = [
//         { caseId: regex },
//         { userId: regex },
//         { remarks: regex },
//         { name: regex },
//         { details: regex },
//         { details1: regex },
//         { priority: regex },
//         { correctUPN: regex },
//         { product: regex },
//         { updatedProductName: regex },
//         { accountNumber: regex },
//         { requirement: regex },
//         { updatedRequirement: regex },
//         { accountNumberDigit: regex },
//         { bankCode: regex },
//         { clientCode: regex },
//         { vendorName: regex },
//         { dateIn: regex },
//         { dateInDate: regex },
//         { status: regex },
//         { caseStatus: regex },
//         { productType: regex },
//         { listByEmployee: regex },
//         { dateOut: regex },
//         { dateOutInDay: regex },
//         { sentBy: regex },
//         { autoOrManual: regex },
//         { caseDoneBy: regex },
//         { clientTAT: regex },
//         { customerCare: regex },
//         { sentDate: regex },
//         { sentDateInDay: regex },
//         { clientType: regex },
//         { dedupBy: regex },
//         { vendorRate: regex },
//         { clientRate: regex },
//         { NameUploadBy: regex },
//         { ReferBy: regex },
//         { ipAddress: regex },
//         { vendorStatus: regex },
//         { year: regex },
//         { month: regex },
//       ];
//     }

//     // Apply all filters only if they have values
//     if (product && product.trim() !== '') query.product = product;
//     if (productType && productType.trim() !== '') query.productType = productType;
//     if (status && status.trim() !== '') query.status = status;
//     if (caseStatus && caseStatus.trim() !== '') query.caseStatus = caseStatus;
//     if (vendorStatus && vendorStatus.trim() !== '') query.vendorStatus = vendorStatus;
//     if (priority && priority.trim() !== '') query.priority = priority;
//     if (clientCode && clientCode.trim() !== '') query.clientCode = clientCode;
//     if (clientType && clientType.trim() !== '') query.clientType = clientType;
//     if (year && year.trim() !== '') query.year = year;
//     if (month && month.trim() !== '') query.month = month;

//     if (dateInStart || dateInEnd) {
//       query.dateIn = buildDateRangeQuery(dateInStart, dateInEnd);
//     }

//     if (dateOutStart || dateOutEnd) {
//       query.dateOut = buildDateRangeQuery(dateOutStart, dateOutEnd);
//     }

//     if (sentDate && sentDate.trim() !== '') {
//       query.sentDate = { $regex: `^${sentDate}`, $options: "i" };
//     }

//     const cursor = KYC.find(query).sort({ createdAt: -1 }).lean().cursor();

//     const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
//       stream: res,
//       useStyles: true,
//       useSharedStrings: true
//     });

//     const worksheet = workbook.addWorksheet('KYC Reports');

//     // ALL columns from your model
//     worksheet.columns = [
//       { header: 'User ID', key: 'userId', width: 18 },
//       { header: 'Case ID', key: 'caseId', width: 18 },
//       { header: 'Attachments', key: 'attachments', width: 24 },
//       { header: 'Remarks', key: 'remarks', width: 22 },
//       { header: 'Name', key: 'name', width: 20 },
//       { header: 'Details', key: 'details', width: 22 },
//       { header: 'Details 1', key: 'details1', width: 22 },
//       { header: 'Priority', key: 'priority', width: 16 },
//       { header: 'Correct UPN', key: 'correctUPN', width: 20 },
//       { header: 'Product', key: 'product', width: 20 },
//       { header: 'Updated Product', key: 'updatedProductName', width: 24 },
//       { header: 'Product Type', key: 'productType', width: 18 },
//       { header: 'Account Number', key: 'accountNumber', width: 20 },
//       { header: 'Account Number Digit', key: 'accountNumberDigit', width: 22 },
//       { header: 'Requirement', key: 'requirement', width: 24 },
//       { header: 'Updated Requirement', key: 'updatedRequirement', width: 26 },
//       { header: 'Bank Code', key: 'bankCode', width: 16 },
//       { header: 'Client Code', key: 'clientCode', width: 18 },
//       { header: 'Client Type', key: 'clientType', width: 18 },
//       { header: 'Client TAT', key: 'clientTAT', width: 18 },
//       { header: 'Vendor Name', key: 'vendorName', width: 20 },
//       { header: 'Vendor Rate', key: 'vendorRate', width: 18 },
//       { header: 'Client Rate', key: 'clientRate', width: 18 },
//       { header: 'Vendor Status', key: 'vendorStatus', width: 20 },
//       { header: 'Status', key: 'status', width: 16 },
//       { header: 'Case Status', key: 'caseStatus', width: 20 },
//       { header: 'List Of Employee', key: 'listByEmployee', width: 22 },
//       { header: 'Date In', key: 'dateIn', width: 18 },
//       { header: 'Date In (Day)', key: 'dateInDate', width: 20 },
//       { header: 'Date Out', key: 'dateOut', width: 18 },
//       { header: 'Date Out (Day)', key: 'dateOutInDay', width: 20 },
//       { header: 'Sent By', key: 'sentBy', width: 18 },
//       { header: 'Auto/Manual', key: 'autoOrManual', width: 18 },
//       { header: 'Case Done By', key: 'caseDoneBy', width: 22 },
//       { header: 'Customer Care', key: 'customerCare', width: 22 },
//       { header: 'Sent Date', key: 'sentDate', width: 20 },
//       { header: 'Sent Date (Day)', key: 'sentDateInDay', width: 22 },
//       { header: 'Dedup By', key: 'dedupBy', width: 20 },
//       { header: 'Name Upload By', key: 'NameUploadBy', width: 22 },
//       { header: 'Refer By', key: 'ReferBy', width: 20 },
//       { header: 'Is Rechecked', key: 'isRechecked', width: 16 },
//       { header: 'Is Dedup', key: 'isDedup', width: 16 },
//       { header: 'Rechecked At', key: 'recheckedAt', width: 22 },
//       { header: 'IP Address', key: 'ipAddress', width: 20 },
//       { header: 'Year', key: 'year', width: 12 },
//       { header: 'Month', key: 'month', width: 12 },
//       { header: 'Modified At', key: 'ModifyedAt', width: 22 }
//     ];

//     const fileName = `kyc_complete_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//     for await (const r of cursor) {
//       let row = worksheet.addRow({
//         userId: r.userId || '',
//         caseId: r.caseId || '',
//         remarks: r.remarks || '',
//         name: r.name || '',
//         details: r.details || '',
//         details1: r.details1 || '',
//         priority: r.priority || '',
//         correctUPN: r.correctUPN || '',
//         product: r.product || '',
//         updatedProductName: r.updatedProductName || '',
//         productType: r.productType || '',
//         accountNumber: r.accountNumber || '',
//         accountNumberDigit: r.accountNumberDigit || '',
//         requirement: r.requirement || '',
//         updatedRequirement: r.updatedRequirement || '',
//         bankCode: r.bankCode || '',
//         clientCode: r.clientCode || '',
//         clientType: r.clientType || '',
//         clientTAT: r.clientTAT || '',
//         vendorName: r.vendorName || '',
//         vendorRate: r.vendorRate || '',
//         clientRate: r.clientRate || '',
//         vendorStatus: r.vendorStatus || '',
//         status: r.status || '',
//         caseStatus: r.caseStatus || '',
//         listByEmployee: r.listByEmployee || '',
//         dateIn: r.dateIn || '',
//         dateInDate: r.dateInDate || '',
//         dateOut: r.dateOut || '',
//         dateOutInDay: r.dateOutInDay || '',
//         sentBy: r.sentBy || '',
//         autoOrManual: r.autoOrManual || '',
//         caseDoneBy: r.caseDoneBy || '',
//         customerCare: r.customerCare || '',
//         sentDate: r.sentDate || '',
//         sentDateInDay: r.sentDateInDay || '',
//         dedupBy: r.dedupBy || '',
//         NameUploadBy: r.NameUploadBy || '',
//         ReferBy: r.ReferBy || '',
//         isRechecked: r.isRechecked || '',
//         isDedup: r.isDedup || '',
//         recheckedAt: r.recheckedAt ? new Date(r.recheckedAt).toISOString() : '',
//         ipAddress: r.ipAddress || '',
//         year: r.year || '',
//         month: r.month || '',
//         ModifyedAt: r.ModifyedAt || '',
//       });

//       // Add hyperlink for first attachment
//       if (r.attachments && Array.isArray(r.attachments) && r.attachments[0]?.location) {
//         let cell = row.getCell("attachments");
//         cell.value = { text: "Open Attachment", hyperlink: r.attachments[0].location };
//         cell.font = { color: { argb: 'FF0000FF' }, underline: true };
//       }

//       row.commit();
//     }

//     worksheet.commit();
//     await workbook.commit();
//   } catch (err) {
//     console.error('Download report error:', err);
//     if (!res.headersSent) {
//       return res.status(500).json({ message: 'Server error', error: err.message });
//     }
//   }
// };


// // Update cell data
// exports.updateCellData = async (req, res) => {
//   try {
//     const { caseId, field, value } = req.body;

//     if (!caseId || !field) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Case ID and field are required" 
//       });
//     }

//     const updateData = { 
//       [field]: value,
//       ModifyedAt: moment().format('DD-MM-YYYY HH:mm:ss')
//     };

//     const result = await KYC.findOneAndUpdate(
//       { caseId: caseId },
//       { $set: updateData },
//       { new: true }
//     );

//     if (!result) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Record not found" 
//       });
//     }

//     res.json({
//       success: true,
//       message: "Cell updated successfully",
//       data: result
//     });
//   } catch (error) {
//     console.error("Error updating cell data:", error);
//     res.status(500).json({ 
//       success: false, 
//       message: "Failed to update cell data",
//       error: error.message 
//     });
//   }
// };









// const KYC = require("../models/kycModel");
// const ExcelJS = require("exceljs");
// const moment = require("moment");

// // Helper function to generate date range regex
// function generateDateRangeRegex(startDate, endDate) {
//   const start = moment(startDate, "DD-MM-YYYY");
//   const end = moment(endDate, "DD-MM-YYYY");
//   const dates = [];

//   let current = start.clone();
//   while (current <= end) {
//     dates.push(current.format("DD-MM-YYYY"));
//     current.add(1, "day");
//   }

//   return dates.join("|");
// }

// // Helper function to build date range query
// function buildDateRangeQuery(startDate, endDate) {
//   const dateFilter = {};
//   const startDateStr = startDate ? moment(startDate, "DD-MM-YYYY").format("DD-MM-YYYY") : null;
//   const endDateStr = endDate ? moment(endDate, "DD-MM-YYYY").format("DD-MM-YYYY") : null;

//   if (startDateStr && endDateStr) {
//     if (startDateStr === endDateStr) {
//       dateFilter.$regex = `^${startDateStr}`;
//     } else {
//       dateFilter.$regex = new RegExp(`^(${generateDateRangeRegex(startDateStr, endDateStr)})`);
//     }
//   } else if (startDateStr) {
//     dateFilter.$regex = `^${startDateStr}`;
//   } else if (endDateStr) {
//     dateFilter.$regex = new RegExp(`^(${generateDateRangeRegex("01-01-2000", endDateStr)})`);
//   }

//   return dateFilter;
// }

// // Get Report Data (Admin Only)
// exports.getReportData = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       pageSize = 50,
//       searchQuery = "",
//       // All filter parameters
//       product,
//       productType,
//       status,
//       caseStatus,
//       dateInStart,
//       dateInEnd,
//       dateOutStart,
//       dateOutEnd,
//       sentDate,
//       vendorStatus,
//       priority,
//       clientType,
//       clientCode,
//       year,
//       month,
//       day,
//       ...otherFilters
//     } = req.query;

//     const skip = (page - 1) * pageSize;
//     let query = {};

//     // Search functionality - ALL fields
//     if (searchQuery) {
//       const regex = { $regex: searchQuery, $options: "i" };
//       query.$or = [
//         { caseId: regex },
//         { userId: regex },
//         { remarks: regex },
//         { name: regex },
//         { details: regex },
//         { details1: regex },
//         { priority: regex },
//         { correctUPN: regex },
//         { product: regex },
//         { updatedProductName: regex },
//         { accountNumber: regex },
//         { requirement: regex },
//         { updatedRequirement: regex },
//         { accountNumberDigit: regex },
//         { bankCode: regex },
//         { clientCode: regex },
//         { vendorName: regex },
//         { dateIn: regex },
//         { dateInDate: regex },
//         { status: regex },
//         { caseStatus: regex },
//         { productType: regex },
//         { listByEmployee: regex },
//         { dateOut: regex },
//         { dateOutInDay: regex },
//         { sentBy: regex },
//         { autoOrManual: regex },
//         { caseDoneBy: regex },
//         { clientTAT: regex },
//         { customerCare: regex },
//         { sentDate: regex },
//         { sentDateInDay: regex },
//         { clientType: regex },
//         { dedupBy: regex },
//         { vendorRate: regex },
//         { clientRate: regex },
//         { NameUploadBy: regex },
//         { ReferBy: regex },
//         { ipAddress: regex },
//         { vendorStatus: regex },
//         { year: regex },
//         { month: regex },
//         { "attachments.filename": regex },
//         { "attachments.originalname": regex },
//         { "attachments.key": regex },
//       ];
//     }

//     // Apply ALL filters
//     if (product) query.product = product;
//     if (productType) query.productType = productType;
//     if (status) query.status = status;
//     if (caseStatus) query.caseStatus = caseStatus;
//     if (vendorStatus) query.vendorStatus = vendorStatus;
//     if (priority) query.priority = priority;
//     if (clientCode) query.clientCode = clientCode;
//     if (clientType) query.clientType = clientType;
//     if (year) query.year = year;
//     if (month) query.month = month;

//     // Date range filtering
//     if (dateInStart || dateInEnd) {
//       query.dateIn = buildDateRangeQuery(dateInStart, dateInEnd);
//     }

//     if (dateOutStart || dateOutEnd) {
//       query.dateOut = {
//         ...buildDateRangeQuery(dateOutStart, dateOutEnd),
//         $ne: "",
//         $exists: true,
//       };
//     }

//     if (sentDate) {
//       query.sentDate = { $regex: `^${sentDate}`, $options: "i" };
//     }

//     // Other array filters
//     Object.entries(otherFilters).forEach(([key, value]) => {
//       if (Array.isArray(value) && value.length > 0) {
//         query[key] = { $in: value };
//       }
//     });

//     const [reportData, totalCount] = await Promise.all([
//       KYC.find(query)
//         .sort({ _id: -1 })
//         .skip(skip)
//         .limit(parseInt(pageSize)),
//       KYC.countDocuments(query),
//     ]);

//     res.json({
//       data: reportData,
//       pagination: {
//         total: totalCount,
//         page: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalPages: Math.ceil(totalCount / pageSize),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching report data:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch data" });
//   }
// };

// // Download Excel Report (Admin Only) - ALL columns
// exports.downloadReportExcel = async (req, res) => {
//   try {
//     const {
//       searchQuery,
//       product,
//       productType,
//       status,
//       caseStatus,
//       dateInStart,
//       dateInEnd,
//       dateOutStart,
//       dateOutEnd,
//       sentDate,
//       vendorStatus,
//       priority,
//       clientType,
//       clientCode,
//       year,
//       month,
//     } = req.query;

//     let query = {};

//     // Build complete query
//     if (searchQuery) {
//       const regex = { $regex: searchQuery, $options: "i" };
//       query.$or = [
//         { caseId: regex },
//         { userId: regex },
//         { remarks: regex },
//         { name: regex },
//         { details: regex },
//         { details1: regex },
//         { priority: regex },
//         { correctUPN: regex },
//         { product: regex },
//         { updatedProductName: regex },
//         { accountNumber: regex },
//         { requirement: regex },
//         { updatedRequirement: regex },
//         { accountNumberDigit: regex },
//         { bankCode: regex },
//         { clientCode: regex },
//         { vendorName: regex },
//         { dateIn: regex },
//         { dateInDate: regex },
//         { status: regex },
//         { caseStatus: regex },
//         { productType: regex },
//         { listByEmployee: regex },
//         { dateOut: regex },
//         { dateOutInDay: regex },
//         { sentBy: regex },
//         { autoOrManual: regex },
//         { caseDoneBy: regex },
//         { clientTAT: regex },
//         { customerCare: regex },
//         { sentDate: regex },
//         { sentDateInDay: regex },
//         { clientType: regex },
//         { dedupBy: regex },
//         { vendorRate: regex },
//         { clientRate: regex },
//         { NameUploadBy: regex },
//         { ReferBy: regex },
//         { ipAddress: regex },
//         { vendorStatus: regex },
//         { year: regex },
//         { month: regex },
//       ];
//     }

//     // Apply all filters
//     if (product) query.product = product;
//     if (productType) query.productType = productType;
//     if (status) query.status = status;
//     if (caseStatus) query.caseStatus = caseStatus;
//     if (vendorStatus) query.vendorStatus = vendorStatus;
//     if (priority) query.priority = priority;
//     if (clientCode) query.clientCode = clientCode;
//     if (clientType) query.clientType = clientType;
//     if (year) query.year = year;
//     if (month) query.month = month;

//     if (dateInStart || dateInEnd) {
//       query.dateIn = buildDateRangeQuery(dateInStart, dateInEnd);
//     }

//     if (dateOutStart || dateOutEnd) {
//       query.dateOut = buildDateRangeQuery(dateOutStart, dateOutEnd);
//     }

//     if (sentDate) {
//       query.sentDate = { $regex: `^${sentDate}`, $options: "i" };
//     }

//     const cursor = KYC.find(query).sort({ createdAt: -1 }).lean().cursor();

//     const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
//       stream: res,
//       useStyles: true,
//       useSharedStrings: true
//     });

//     const worksheet = workbook.addWorksheet('KYC Reports');

//     // ALL columns from your model
//     worksheet.columns = [
//       { header: 'User ID', key: 'userId', width: 18 },
//       { header: 'Case ID', key: 'caseId', width: 18 },
//       { header: 'Attachments', key: 'attachments', width: 24 },
//       { header: 'Remarks', key: 'remarks', width: 22 },
//       { header: 'Name', key: 'name', width: 20 },
//       { header: 'Details', key: 'details', width: 22 },
//       { header: 'Details 1', key: 'details1', width: 22 },
//       { header: 'Priority', key: 'priority', width: 16 },
//       { header: 'Correct UPN', key: 'correctUPN', width: 20 },
//       { header: 'Product', key: 'product', width: 20 },
//       { header: 'Updated Product', key: 'updatedProductName', width: 24 },
//       { header: 'Product Type', key: 'productType', width: 18 },
//       { header: 'Account Number', key: 'accountNumber', width: 20 },
//       { header: 'Account Number Digit', key: 'accountNumberDigit', width: 22 },
//       { header: 'Requirement', key: 'requirement', width: 24 },
//       { header: 'Updated Requirement', key: 'updatedRequirement', width: 26 },
//       { header: 'Bank Code', key: 'bankCode', width: 16 },
//       { header: 'Client Code', key: 'clientCode', width: 18 },
//       { header: 'Client Type', key: 'clientType', width: 18 },
//       { header: 'Client TAT', key: 'clientTAT', width: 18 },
//       { header: 'Vendor Name', key: 'vendorName', width: 20 },
//       { header: 'Vendor Rate', key: 'vendorRate', width: 18 },
//       { header: 'Client Rate', key: 'clientRate', width: 18 },
//       { header: 'Vendor Status', key: 'vendorStatus', width: 20 },
//       { header: 'Status', key: 'status', width: 16 },
//       { header: 'Case Status', key: 'caseStatus', width: 20 },
//       { header: 'List Of Employee', key: 'listByEmployee', width: 22 },
//       { header: 'Date In', key: 'dateIn', width: 18 },
//       { header: 'Date In (Day)', key: 'dateInDate', width: 20 },
//       { header: 'Date Out', key: 'dateOut', width: 18 },
//       { header: 'Date Out (Day)', key: 'dateOutInDay', width: 20 },
//       { header: 'Sent By', key: 'sentBy', width: 18 },
//       { header: 'Auto/Manual', key: 'autoOrManual', width: 18 },
//       { header: 'Case Done By', key: 'caseDoneBy', width: 22 },
//       { header: 'Customer Care', key: 'customerCare', width: 22 },
//       { header: 'Sent Date', key: 'sentDate', width: 20 },
//       { header: 'Sent Date (Day)', key: 'sentDateInDay', width: 22 },
//       { header: 'Dedup By', key: 'dedupBy', width: 20 },
//       { header: 'Name Upload By', key: 'NameUploadBy', width: 22 },
//       { header: 'Refer By', key: 'ReferBy', width: 20 },
//       { header: 'Is Rechecked', key: 'isRechecked', width: 16 },
//       { header: 'Is Dedup', key: 'isDedup', width: 16 },
//       { header: 'Rechecked At', key: 'recheckedAt', width: 22 },
//       { header: 'IP Address', key: 'ipAddress', width: 20 },
//       { header: 'Year', key: 'year', width: 12 },
//       { header: 'Month', key: 'month', width: 12 },
//       { header: 'Modified At', key: 'ModifyedAt', width: 22 }
//     ];

//     const fileName = `kyc_complete_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//     for await (const r of cursor) {
//       let row = worksheet.addRow({
//         userId: r.userId || '',
//         caseId: r.caseId || '',
//         remarks: r.remarks || '',
//         name: r.name || '',
//         details: r.details || '',
//         details1: r.details1 || '',
//         priority: r.priority || '',
//         correctUPN: r.correctUPN || '',
//         product: r.product || '',
//         updatedProductName: r.updatedProductName || '',
//         productType: r.productType || '',
//         accountNumber: r.accountNumber || '',
//         accountNumberDigit: r.accountNumberDigit || '',
//         requirement: r.requirement || '',
//         updatedRequirement: r.updatedRequirement || '',
//         bankCode: r.bankCode || '',
//         clientCode: r.clientCode || '',
//         clientType: r.clientType || '',
//         clientTAT: r.clientTAT || '',
//         vendorName: r.vendorName || '',
//         vendorRate: r.vendorRate || '',
//         clientRate: r.clientRate || '',
//         vendorStatus: r.vendorStatus || '',
//         status: r.status || '',
//         caseStatus: r.caseStatus || '',
//         listByEmployee: r.listByEmployee || '',
//         dateIn: r.dateIn || '',
//         dateInDate: r.dateInDate || '',
//         dateOut: r.dateOut || '',
//         dateOutInDay: r.dateOutInDay || '',
//         sentBy: r.sentBy || '',
//         autoOrManual: r.autoOrManual || '',
//         caseDoneBy: r.caseDoneBy || '',
//         customerCare: r.customerCare || '',
//         sentDate: r.sentDate || '',
//         sentDateInDay: r.sentDateInDay || '',
//         dedupBy: r.dedupBy || '',
//         NameUploadBy: r.NameUploadBy || '',
//         ReferBy: r.ReferBy || '',
//         isRechecked: r.isRechecked || '',
//         isDedup: r.isDedup || '',
//         recheckedAt: r.recheckedAt ? new Date(r.recheckedAt).toISOString() : '',
//         ipAddress: r.ipAddress || '',
//         year: r.year || '',
//         month: r.month || '',
//         ModifyedAt: r.ModifyedAt || '',
//       });

//       // Add hyperlink for first attachment
//       if (r.attachments && Array.isArray(r.attachments) && r.attachments[0]?.location) {
//         let cell = row.getCell("attachments");
//         cell.value = { text: "Open Attachment", hyperlink: r.attachments[0].location };
//         cell.font = { color: { argb: 'FF0000FF' }, underline: true };
//       }

//       row.commit();
//     }

//     worksheet.commit();
//     await workbook.commit();
//   } catch (err) {
//     console.error('Download report error:', err);
//     if (!res.headersSent) {
//       return res.status(500).json({ message: 'Server error', error: err.message });
//     }
//   }
// };