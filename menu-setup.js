/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🏥 HMSG Dashboard')
    .addItem('📊 Tạo Dashboard', 'createDashboard')
    .addItem('🔄 Làm mới Dashboard', 'manualRefresh')
    .addSeparator()
    .addItem('⚙️ Cài đặt Auto Refresh', 'setupAutoRefresh')
    .addItem('🛑 Tắt Auto Refresh', 'stopAutoRefresh')
    .addSeparator()
    .addItem('📋 Hướng dẫn sử dụng', 'showHelp')
    .addToUi();
}

/**
 * Stop auto refresh
 */
function stopAutoRefresh() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshDashboard') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  SpreadsheetApp.getUi().alert(
    'Thành công!',
    'Đã tắt auto refresh',
    SpreadsheetApp.getUi().AlertType.INFO
  );
}

/**
 * Show help dialog
 */
function showHelp() {
  const helpText = `
🏥 HMSG DASHBOARD - HƯỚNG DẪN SỬ DỤNG

📊 TÍNH NĂNG:
• Tự động tạo dashboard từ dữ liệu sheet 'chc'
• Hiển thị KPI cards: công ty, người khám, ca sáng/chiều
• Timeline chart: lịch khám theo thời gian
• Bảng tổng hợp hàng ngày
• Tự động refresh mỗi 15 phút

🔧 CÁCH SỬ DỤNG:
1. Đảm bảo có sheet 'chc' với đúng format dữ liệu
2. Chọn menu "🏥 HMSG Dashboard" > "📊 Tạo Dashboard"
3. Dashboard sẽ được tạo trong sheet 'Dashboard'

⚠️ LƯU Ý:
• Cần có quyền chỉnh sửa spreadsheet
• Dữ liệu trong sheet 'chc' phải có đúng format
• Auto refresh chỉ hoạt động khi file được mở

📞 HỖ TRỢ:
Liên hệ admin nếu có vấn đề kỹ thuật.
  `;
  
  SpreadsheetApp.getUi().alert(
    'Hướng dẫn sử dụng',
    helpText,
    SpreadsheetApp.getUi().AlertType.INFO
  );
}