/**
 * Format dashboard appearance
 */
function formatDashboard(sheet) {
  // Set column widths
  sheet.setColumnWidth(1, 200); // Company names
  sheet.setColumnWidths(2, 15, 60); // Timeline dates
  
  // Set row heights
  sheet.setRowHeight(1, 30); // Header
  sheet.setRowHeights(5, 3, 25); // KPI cards
  sheet.setRowHeights(13, 20, 20); // Timeline rows
  
  // Freeze header rows
  sheet.setFrozenRows(12);
  
  // Set print settings
  sheet.getRange('A1:P40').setFontFamily('Arial');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 16);
}

/**
 * Set up auto refresh trigger
 */
function setupAutoRefresh() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshDashboard') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger for auto refresh every 15 minutes
  ScriptApp.newTrigger('refreshDashboard')
    .timeBased()
    .everyMinutes(CONFIG.REFRESH_INTERVAL)
    .create();
    
  console.log(`⏰ Auto refresh set up for every ${CONFIG.REFRESH_INTERVAL} minutes`);
}

/**
 * Refresh dashboard function (called by trigger)
 */
function refreshDashboard() {
  try {
    console.log('🔄 Auto refreshing dashboard...');
    createDashboard();
    console.log('✅ Dashboard refreshed successfully');
  } catch (error) {
    console.error('❌ Error refreshing dashboard:', error);
  }
}

/**
 * Manual refresh function
 */
function manualRefresh() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Làm mới Dashboard',
    'Bạn có muốn làm mới dashboard không?',
    ui.AlertType.YES_NO
  );
  
  if (response === ui.AlertType.YES) {
    createDashboard();
  }
}