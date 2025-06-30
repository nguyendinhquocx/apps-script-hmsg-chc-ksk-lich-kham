/**
 * Create timeline chart (Gantt-style)
 */
function createTimelineChart(sheet, data) {
  // Sort data by start date
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a['ngay bat dau kham']);
    const dateB = new Date(b['ngay bat dau kham']);
    return dateA - dateB;
  });
  
  // Create timeline header
  createTimelineHeader(sheet, sortedData);
  
  // Create timeline rows
  createTimelineRows(sheet, sortedData);
}

/**
 * Create timeline header with dates
 */
function createTimelineHeader(sheet, data) {
  const startRow = 12;
  const startCol = 2;
  
  // Get date range
  const dateRange = getDateRange(data);
  const dates = generateDateRange(dateRange.start, dateRange.end);
  
  // Company name header
  sheet.getRange(startRow, startCol - 1).setValue('CÔNG TY');
  sheet.getRange(startRow, startCol - 1).setFontWeight('bold').setFontSize(10);
  
  // Date headers
  dates.forEach((date, index) => {
    const cell = sheet.getRange(startRow, startCol + index);
    cell.setValue(Utilities.formatDate(date, 'GMT+7', 'dd/MM'));
    cell.setFontSize(8).setFontWeight('bold').setHorizontalAlignment('center');
    cell.setTextRotation(45);
  });
}

/**
 * Create timeline rows for each company
 */
function createTimelineRows(sheet, data) {
  const startRow = 13;
  const startCol = 2;
  
  // Get date range
  const dateRange = getDateRange(data);
  const dates = generateDateRange(dateRange.start, dateRange.end);
  
  data.forEach((record, index) => {
    const row = startRow + index;
    const companyName = record['ten cong ty'] || 'N/A';
    const startDate = new Date(record['ngay bat dau kham']);
    const endDate = new Date(record['ngay ket thuc kham']);
    const patients = record['so nguoi kham'] || 0;
    
    // Company name
    sheet.getRange(row, startCol - 1).setValue(companyName);
    sheet.getRange(row, startCol - 1).setFontSize(9).setWrap(true);
    
    // Timeline bars
    dates.forEach((date, dateIndex) => {
      const cell = sheet.getRange(row, startCol + dateIndex);
      
      if (date >= startDate && date <= endDate) {
        // Active examination period
        cell.setBackground(CONFIG.COLORS.SUCCESS);
        cell.setValue('█');
        cell.setFontColor(CONFIG.COLORS.SUCCESS);
        cell.setHorizontalAlignment('center');
        
        // Add patient count on start date
        if (isSameDate(date, startDate)) {
          cell.setNote(`${companyName}\nSố người khám: ${patients}\nTừ ${Utilities.formatDate(startDate, 'GMT+7', 'dd/MM')} đến ${Utilities.formatDate(endDate, 'GMT+7', 'dd/MM')}`);
        }
      } else {
        cell.setBackground('#ffffff');
        cell.setValue('');
      }
    });
  });
}

/**
 * Get date range from data
 */
function getDateRange(data) {
  let minDate = new Date();
  let maxDate = new Date();
  
  data.forEach(record => {
    const startDate = new Date(record['ngay bat dau kham']);
    const endDate = new Date(record['ngay ket thuc kham']);
    
    if (startDate < minDate) minDate = startDate;
    if (endDate > maxDate) maxDate = endDate;
  });
  
  return { start: minDate, end: maxDate };
}

/**
 * Generate array of dates between start and end
 */
function generateDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Check if two dates are the same day
 */
function isSameDate(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}