/**
 * Create daily summary table
 */
function createDailySummary(sheet, data) {
  const startRow = 27;
  const startCol = 2;
  
  // Create headers
  const headers = ['Ngày', 'Tổng người khám', 'Ca sáng', 'Ca chiều', 'Số công ty'];
  headers.forEach((header, index) => {
    const cell = sheet.getRange(startRow, startCol + index);
    cell.setValue(header);
    cell.setFontWeight('bold').setBackground('#e9ecef').setHorizontalAlignment('center');
  });
  
  // Generate daily summary data
  const dailySummary = generateDailySummary(data);
  
  // Fill data rows
  dailySummary.forEach((dayData, index) => {
    const row = startRow + 1 + index;
    
    sheet.getRange(row, startCol).setValue(dayData.date);
    sheet.getRange(row, startCol + 1).setValue(dayData.totalPatients);
    sheet.getRange(row, startCol + 2).setValue(dayData.morningShifts);
    sheet.getRange(row, startCol + 3).setValue(dayData.afternoonShifts);
    sheet.getRange(row, startCol + 4).setValue(dayData.companyCount);
    
    // Format numbers
    sheet.getRange(row, startCol + 1, 1, 4).setHorizontalAlignment('center');
    
    // Highlight weekends
    const date = new Date(dayData.dateObj);
    if (date.getDay() === 0 || date.getDay() === 6) {
      sheet.getRange(row, startCol, 1, 5).setBackground('#fff3cd');
    }
  });
  
  // Add totals row
  const totalRow = startRow + 1 + dailySummary.length;
  sheet.getRange(totalRow, startCol).setValue('TỔNG CỘNG');
  sheet.getRange(totalRow, startCol).setFontWeight('bold');
  
  const totalPatients = dailySummary.reduce((sum, day) => sum + day.totalPatients, 0);
  const totalMorning = dailySummary.reduce((sum, day) => sum + day.morningShifts, 0);
  const totalAfternoon = dailySummary.reduce((sum, day) => sum + day.afternoonShifts, 0);
  
  sheet.getRange(totalRow, startCol + 1).setValue(totalPatients);
  sheet.getRange(totalRow, startCol + 2).setValue(totalMorning);
  sheet.getRange(totalRow, startCol + 3).setValue(totalAfternoon);
  sheet.getRange(totalRow, startCol + 4).setValue('');
  
  sheet.getRange(totalRow, startCol, 1, 5).setFontWeight('bold').setBackground('#d4edda');
}

/**
 * Generate daily summary from data
 */
function generateDailySummary(data) {
  const dateRange = getDateRange(data);
  const dates = generateDateRange(dateRange.start, dateRange.end);
  
  const dailySummary = [];
  
  dates.forEach(date => {
    let totalPatients = 0;
    let morningShifts = 0;
    let afternoonShifts = 0;
    let companyCount = 0;
    
    data.forEach(record => {
      const startDate = new Date(record['ngay bat dau kham']);
      const endDate = new Date(record['ngay ket thuc kham']);
      
      if (date >= startDate && date <= endDate) {
        companyCount++;
        
        // Distribute patients across examination days
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const dailyPatients = Math.round((record['so nguoi kham'] || 0) / totalDays);
        totalPatients += dailyPatients;
        
        morningShifts += record['sang'] || 0;
        afternoonShifts += record['chieu'] || 0;
      }
    });
    
    dailySummary.push({
      date: Utilities.formatDate(date, 'GMT+7', 'dd/MM/yyyy'),
      dateObj: date,
      totalPatients,
      morningShifts,
      afternoonShifts,
      companyCount
    });
  });
  
  return dailySummary;
}