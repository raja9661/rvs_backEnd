

//   // Handle "dd-mm-yyyy, h:mm:ss am/pm" format
//   try {
//     const [datePart, timePart] = dateStr.split(', ');
//     if (!datePart || !timePart) return null;

//     const [day, month, year] = datePart.split('-').map(Number);
//     if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

//     const [time, period] = timePart.toLowerCase().split(' ');
//     let [hours, minutes, seconds] = time.split(':').map(Number);

//     if (isNaN(hours) || isNaN(minutes)) return null;
//     if (isNaN(seconds)) seconds = 0;

//     // Convert to 24-hour format
//     if (period === 'pm' && hours !== 12) {
//       hours += 12;
//     } else if (period === 'am' && hours === 12) {
//       hours = 0;
//     }

//     const date = new Date(year, month - 1, day, hours, minutes, seconds);
//     return isNaN(date.getTime()) ? null : date;
//   } catch (error) {
//     console.error('Date parsing error:', error);
//     return null;
//   }
// };

// const calculateTAT = (startStr, endStr) => {
//   console.log("start date:",startStr)
//   console.log("endStr date:",endStr)
//   const start = parseCustomDateTime(startStr);
//   const end = parseCustomDateTime(endStr);
//   console.log("start:",start)
//   console.log("end:",end)
  
//   if (!start || !end) return 'N/A';
//   if (end < start) return 'Invalid Date Range';

//   const diff = Math.abs(end - start);
//   const seconds = Math.floor(diff / 1000) % 60;
//   const minutes = Math.floor(diff / (1000 * 60)) % 60;
//   const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
//   const days = Math.floor(diff / (1000 * 60 * 60 * 24));

//   // Return business-friendly format
//   if (days > 0) {
//     return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
//   }
//   if (hours > 0) {
//     return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
//   }
//   if (minutes > 0) {
//     return `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;
//   }
//   return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
// };

const parseCustomDateTime = (dateStr) => {
  if (!dateStr) return null;
  
  // Handle Date objects and ISO strings
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

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

    // Create date in UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

const calculateTAT = (startStr, endStr) => {
  const start = parseCustomDateTime(startStr);
  const end = parseCustomDateTime(endStr);
  
  if (!start || !end) return 'N/A';
  
  // Convert to milliseconds since epoch for comparison
  const startTime = start.getTime();
  const endTime = end.getTime();
  
  if (endTime < startTime) return 'Invalid Date Range';

  const diff = Math.abs(endTime - startTime);
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Return business-friendly format
  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);
  if (days === 0 && hours === 0) parts.push(`${seconds} sec${seconds !== 1 ? 's' : ''}`);

  return parts.join(' ') || '0 sec';
};

module.exports = {
  parseCustomDateTime,
  calculateTAT
};
