const parseCustomDateTime = (dateStr) => {
  if (!dateStr) return null;
  
  // Already a Date object
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }

  // Handle ISO format
  if (dateStr.includes('T')) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  // Handle "dd-mm-yyyy, h:mm:ss am/pm" format
  try {
    const [datePart, timePart] = dateStr.split(', ');
    if (!datePart || !timePart) return null;

    const [day, month, year] = datePart.split('-').map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    const [time, period] = timePart.toLowerCase().split(' ');
    let [hours, minutes, seconds] = time.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) return null;
    if (isNaN(seconds)) seconds = 0;

    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }

    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

const calculateTAT = (startStr, endStr) => {
  console.log("start date:",startStr)
  console.log("endStr date:",endStr)
  const start = parseCustomDateTime(startStr);
  const end = parseCustomDateTime(endStr);
  console.log("start:",start)
  console.log("end:",end)
  
  if (!start || !end) return 'N/A';
  if (end < start) return 'Invalid Date Range';

  const diff = Math.abs(end - start);
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Return business-friendly format
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;
  }
  return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
};

module.exports = {
  parseCustomDateTime,
  calculateTAT
};


// /**
//  * Robust date handling utilities with guaranteed AM/PM formatting
//  */
// const parseCustomDateTime = (dateStr) => {
//   // Return null for invalid inputs
//   if (!dateStr) return null;
  
//   // Already a Date object
//   if (dateStr instanceof Date) {
//     return isNaN(dateStr.getTime()) ? null : dateStr;
//   }

//   // Handle ISO format (from database)
//   if (dateStr.includes('T')) {
//     const date = new Date(dateStr);
//     return isNaN(date.getTime()) ? null : date;
//   }

//   // Handle custom "dd-mm-yyyy, h:mm:ss am/pm" format
//   try {
//     const [datePart, timePart] = dateStr.split(', ');
//     if (!datePart || !timePart) return null;

//     // Parse date components
//     const [day, month, year] = datePart.split('-').map(Number);
//     if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

//     // Parse time components
//     const [time, period] = timePart.toLowerCase().split(' ');
//     let [hours, minutes, seconds] = time.split(':').map(Number);

//     // Validate time components
//     if (isNaN(hours) || isNaN(minutes)) return null;
//     if (isNaN(seconds)) seconds = 0;

//     // Convert to 24-hour format
//     if (period === 'pm' && hours !== 12) {
//       hours += 12;
//     } else if (period === 'am' && hours === 12) {
//       hours = 0;
//     }

//     // Create Date object (months are 0-indexed)
//     const date = new Date(year, month - 1, day, hours, minutes, seconds);
//     return isNaN(date.getTime()) ? null : date;

//   } catch (error) {
//     console.error('Date parsing error:', error);
//     return null;
//   }
// };

// const formatCustomDateTime = (date) => {
//   const d = parseCustomDateTime(date);
//   if (!d) return 'Invalid Date';

//   try {
//     // Get date components
//     const day = d.getDate().toString().padStart(2, '0');
//     const month = (d.getMonth() + 1).toString().padStart(2, '0');
//     const year = d.getFullYear();

//     // Get time components
//     let hours = d.getHours();
//     const minutes = d.getMinutes().toString().padStart(2, '0');
//     const seconds = d.getSeconds().toString().padStart(2, '0');
//     const period = hours >= 12 ? 'pm' : 'am';

//     // Convert to 12-hour format
//     hours = hours % 12;
//     hours = hours || 12; // Convert 0 to 12

//     return `${day}-${month}-${year}, ${hours}:${minutes}:${seconds} ${period}`;
//   } catch (error) {
//     console.error('Date formatting error:', error);
//     return 'Format Error';
//   }
// };

// const calculateTAT = (startStr, endStr) => {
//   const start = parseCustomDateTime(startStr);
//   const end = parseCustomDateTime(endStr);
  
//   if (!start || !end) return 'N/A';

//   const diff = Math.abs(end - start);
//   const seconds = Math.floor(diff / 1000) % 60;
//   const minutes = Math.floor(diff / (1000 * 60)) % 60;
//   const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
//   const days = Math.floor(diff / (1000 * 60 * 60 * 24));

//   const parts = [];
//   if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
//   if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
//   if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
//   parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

//   return parts.join(', ');
// };

// module.exports = {
//   parseCustomDateTime,
//   formatCustomDateTime,
//   calculateTAT
// };





// // // Backend-focused date handling
// // const parseCustomDateTime = (dateStr) => {
// //   if (dateStr instanceof Date) return dateStr;
// //   if (!dateStr) return null;

// //   // Handle both ISO strings and custom format
// //   if (dateStr.includes('T')) return new Date(dateStr);
  
// //   // Custom format parsing (dd-mm-yyyy, h:mm:ss am/pm)
// //   const [datePart, timePart] = dateStr.split(', ');
// //   const [day, month, year] = datePart.split('-').map(Number);
// //   let [time, period] = timePart.split(' ');
  
// //   let [hours, minutes, seconds] = time.split(':').map(Number);
// //   if (period?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
// //   if (period?.toLowerCase() === 'am' && hours === 12) hours = 0;

// //   return new Date(year, month - 1, day, hours, minutes, seconds || 0);
// // };

// // const formatForFrontend = (date) => {
// //   if (!date) return '';
// //   const d = new Date(date);
  
// //   const day = d.getDate().toString().padStart(2, '0');
// //   const month = (d.getMonth() + 1).toString().padStart(2, '0');
// //   const year = d.getFullYear();
  
// //   let hours = d.getHours();
// //   const ampm = hours >= 12 ? 'pm' : 'am';
// //   hours = hours % 12;
// //   hours = hours || 12; // Convert 0 to 12
  
// //   return `${day}-${month}-${year}, ${hours}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} ${ampm}`;
// // };

// // const calculateTAT = (start, end) => {
// //   const diff = Math.abs(end - start);
// //   const days = Math.floor(diff / (1000 * 60 * 60 * 24));
// //   const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
// //   const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
// //   const seconds = Math.floor((diff % (1000 * 60)) / 1000);

// //   return [
// //     days && `${days} day${days > 1 ? 's' : ''}`,
// //     hours && `${hours} hour${hours > 1 ? 's' : ''}`,
// //     minutes && `${minutes} minute${minutes > 1 ? 's' : ''}`,
// //     `${seconds} second${seconds !== 1 ? 's' : ''}`
// //   ].filter(Boolean).join(', ');
// // };

// // module.exports = { parseCustomDateTime, formatForFrontend, calculateTAT };