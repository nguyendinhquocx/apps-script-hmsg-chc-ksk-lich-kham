/**
 * HMSG Medical Scheduling Dashboard Generator
 * Author: Dashboard Expert
 * Created: 2025-06-30
 */

// Configuration
const CONFIG = {
  SHEET_NAME: 'chc',
  DASHBOARD_SHEET: 'Dashboard',
  REFRESH_INTERVAL: 15, // minutes
  HOSPITAL_NAME: 'HMSG',
  COLORS: {
    PRIMARY: '#1f4e79',
    SECONDARY: '#70ad47', 
    WARNING: '#ffc000',
    DANGER: '#c5504b',
    SUCCESS: '#70ad47'
  }
};

/**
 * Main function to create dashboard
 */
function createDashboard() {
  try {
    console.log('🚀 Starting HMSG Dashboard Generation...');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create dashboard sheet
    let dashboardSheet = getDashboardSheet(ss);
    
    // Clear existing content
    dashboardSheet.clear();
    
    // Get data from CHC sheet
    const data = getChcData(ss);
    
    if (!data || data.length === 0) {
      throw new Error('Không có dữ liệu trong sheet CHC');
    }
    
    // Create dashboard layout
    createDashboardLayout(dashboardSheet, data);
    
    // Create KPI cards
    createKPICards(dashboardSheet, data);
    
    // Create timeline chart
    createTimelineChart(dashboardSheet, data);
    
    // Create daily summary
    createDailySummary(dashboardSheet, data);
    
    // Format dashboard
    formatDashboard(dashboardSheet);
    
    // Set up auto refresh
    setupAutoRefresh();
    
    console.log('✅ Dashboard created successfully!');
    
    SpreadsheetApp.getUi().alert(
      'Thành công!', 
      'Dashboard đã được tạo thành công!\nVui lòng kiểm tra sheet "Dashboard"', 
      SpreadsheetApp.getUi().AlertType.INFO
    );
    
  } catch (error) {
    console.error('❌ Error creating dashboard:', error);
    SpreadsheetApp.getUi().alert(
      'Lỗi!', 
      'Có lỗi xảy ra: ' + error.toString(), 
      SpreadsheetApp.getUi().AlertType.ERROR
    );
  }
}

/**
 * Get or create dashboard sheet
 */
function getDashboardSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.DASHBOARD_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.DASHBOARD_SHEET);
    console.log('📊 Created new dashboard sheet');
  }
  
  return sheet;
}

/**
 * Get data from CHC sheet
 */
function getChcData(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    throw new Error(`Sheet "${CONFIG.SHEET_NAME}" không tồn tại`);
  }
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length < 2) {
    throw new Error('Không có dữ liệu trong sheet');
  }
  
  // Convert to objects
  const headers = values[0];
  const data = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    data.push(row);
  }
  
  console.log(`📊 Loaded ${data.length} records from CHC sheet`);
  return data;
}