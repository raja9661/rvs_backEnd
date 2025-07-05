const ColumnSequence = require('../models/ColumnPreferences');

exports.getDefaultSequence = (role) => {
  const DEFAULT_SEQUENCES = {
    admin: [
      'attachments', 'caseId', 'remarks', 'name', 'details', 'details1',
      'priority', 'correctUPN', 'product', 'updatedProductName', 'accountNumber',
      'requirement', 'accountNumberDigit', 'bankCode', 'clientCode', 'vendorName',
      'vendorStatus', 'dateIn', 'dateInDate', 'status', 'caseStatus', 'productType',
      'listByEmployee', 'dateOut', 'dateOutInDay', 'sentBy', 'autoOrManual',
      'caseDoneBy', 'clientTAT', 'customerCare', 'NameUploadBy', 'ReferBy',
      'sentDate', 'sentDateInDay', 'clientType', 'dedupBy', 'ipAddress', 'isRechecked'
    ],
    employee: [
      'caseId', 'attachments', 'remarks', 'name', 'details', 'details1', 'priority',
      'correctUPN', 'product', 'updatedProductName', 'accountNumber', 'requirement',
      'accountNumberDigit', 'bankCode', 'clientCode', 'vendorName', 'vendorStatus',
      'dateIn', 'dateInDate', 'status', 'caseStatus', 'productType', 'listByEmployee',
      'dateOut', 'dateOutInDay', 'sentBy', 'autoOrManual', 'caseDoneBy', 'clientTAT',
      'NameUploadBy', 'ReferBy', 'customerCare', 'sentDate', 'sentDateInDay',
      'clientType', 'dedupBy', 'isRechecked'
    ],
    client: [
      'caseId', 'attachments', 'remarks', 'name', 'details', 'details1', 'priority',
      'correctUPN', 'product', 'updatedProductName', 'accountNumber', 'requirement',
      'clientCode', 'dateIn', 'dateInDate', 'status', 'caseStatus', 'productType',
      'listByEmployee', 'dateOut', 'sentBy', 'caseDoneBy', 'clientTAT', 'customerCare',
      'NameUploadBy', 'ReferBy', 'sentDate', 'isRechecked'
    ]
  };
  
  return DEFAULT_SEQUENCES[role] || [];
};

// Get sequence for role/user
exports.getSequence = async (role, user) => {
    console.log("hello")
  try {
    const sequence = await ColumnSequence.findOne({ role, user });
    return sequence?.columns || getDefaultSequence(role);
  } catch (error) {
    console.error('Error getting column sequence:', error);
    return getDefaultSequence(role);
  }
};

// Save sequence for role/user
exports.saveSequence = async (role, user, columns) => {
  try {
    let sequence = await ColumnSequence.findOne({ role, user });
    
    if (sequence) {
      sequence.columns = columns;
    } else {
      sequence = new ColumnSequence({ role, user, columns });
    }
    
    await sequence.save();
    return true;
  } catch (error) {
    console.error('Error saving column sequence:', error);
    return false;
  }
};

// Reset to default sequence
exports.resetSequence = async (role, user) => {
  try {
    await ColumnSequence.deleteOne({ role, user });
    return true;
  } catch (error) {
    console.error('Error resetting column sequence:', error);
    return false;
  }
};