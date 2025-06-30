/**
 * Create dashboard layout structure
 */
function createDashboardLayout(sheet, data) {
  const today = new Date();
  
  // Header
  sheet.getRange('A1:L1').merge();
  sheet.getRange('A1').setValue(`🏥 HMSG - DASHBOARD LỊCH KHÁM SỨC KHỎE DOANH NGHIỆP`);
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  
  // Subtitle
  sheet.getRange('A2:L2').merge();
  sheet.getRange('A2').setValue(`Cập nhật lần cuối: ${Utilities.formatDate(today, 'GMT+7', 'dd/MM/yyyy HH:mm:ss')}`);
  sheet.getRange('A2').setFontSize(10).setHorizontalAlignment('center').setFontStyle('italic');
  
  // KPI Section Title
  sheet.getRange('A4').setValue('📊 THỐNG KÊ TỔNG QUAN');
  sheet.getRange('A4').setFontWeight('bold').setFontSize(12);
  
  // Timeline Section Title  
  sheet.getRange('A10').setValue('📅 LỊCH KHÁM THEO THỜI GIAN');
  sheet.getRange('A10').setFontWeight('bold').setFontSize(12);
  
  // Daily Summary Section Title
  sheet.getRange('A25').setValue('📋 TỔNG HỢP THEO NGÀY');
  sheet.getRange('A25').setFontWeight('bold').setFontSize(12);
}

/**
 * Create KPI cards
 */
function createKPICards(sheet, data) {
  const today = new Date();
  
  // Calculate KPIs
  const kpis = calculateKPIs(data, today);
  
  // KPI Card 1: Công ty đang khám hôm nay
  createKPICard(sheet, 'B5', 'Công ty hôm nay', kpis.companiesActive, '🏢', CONFIG.COLORS.PRIMARY);
  
  // KPI Card 2: Tổng người khám hôm nay
  createKPICard(sheet, 'E5', 'Người khám hôm nay', kpis.patientsToday, '👥', CONFIG.COLORS.SUCCESS);
  
  // KPI Card 3: Ca sáng
  createKPICard(sheet, 'H5', 'Ca sáng', kpis.morningShifts, '🌅', CONFIG.COLORS.WARNING);
  
  // KPI Card 4: Ca chiều  
  createKPICard(sheet, 'K5', 'Ca chiều', kpis.afternoonShifts, '🌆', CONFIG.COLORS.SECONDARY);
}

/**
 * Create individual KPI card
 */
function createKPICard(sheet, startCell, title, value, icon, color) {
  const range = sheet.getRange(startCell);
  const row = range.getRow();
  const col = range.getColumn();
  
  // Card background
  const cardRange = sheet.getRange(row, col, 3, 2);
  cardRange.setBackground('#f8f9fa');
  cardRange.setBorder(true, true, true, true, true, true, '#dee2e6', SpreadsheetApp.BorderStyle.SOLID);
  
  // Icon and title
  sheet.getRange(row, col, 1, 2).merge();
  sheet.getRange(row, col).setValue(`${icon} ${title}`);
  sheet.getRange(row, col).setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center');
  
  // Value
  sheet.getRange(row + 1, col, 1, 2).merge(); 
  sheet.getRange(row + 1, col).setValue(value);
  sheet.getRange(row + 1, col).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setFontColor(color);
  
  // Trend (placeholder)
  sheet.getRange(row + 2, col, 1, 2).merge();
  sheet.getRange(row + 2, col).setValue('📈 +12%');
  sheet.getRange(row + 2, col).setFontSize(8).setHorizontalAlignment('center').setFontColor('#6c757d');
}

/**
 * Calculate KPIs from data
 */
function calculateKPIs(data, today) {
  let companiesActive = 0;
  let patientsToday = 0;
  let morningShifts = 0;
  let afternoonShifts = 0;
  
  const todayStr = Utilities.formatDate(today, 'GMT+7', 'M/d/yyyy');
  
  data.forEach(record => {
    const startDate = new Date(record['ngay bat dau kham']);
    const endDate = new Date(record['ngay ket thuc kham']);
    
    // Check if today is within examination period
    if (today >= startDate && today <= endDate) {
      companiesActive++;
      
      // Calculate daily patients (distribute total patients across examination days)
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const dailyPatients = Math.round((record['so nguoi kham'] || 0) / totalDays);
      patientsToday += dailyPatients;
      
      morningShifts += record['sang'] || 0;
      afternoonShifts += record['chieu'] || 0;
    }
  });
  
  return {
    companiesActive,
    patientsToday,
    morningShifts,  
    afternoonShifts
  };
}