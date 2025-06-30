/**
 * Dashboard Theo dõi Lịch Khám - HMSG CHC
 * Tác giả: System Auto-generated
 * Ngày: 2025-06-30
 */

// Cấu hình chung
const CONFIG = {
  SHEET_NAME: 'chc',
  CACHE_DURATION: 300, // 5 phút
  DATE_FORMAT: 'dd/MM/yyyy'
};

/**
 * Hàm chính để serve Web App
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('dashboard')
    .evaluate()
    .setTitle('Dashboard Lịch Khám - HMSG CHC')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include file CSS/JS vào HTML
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Lấy dữ liệu từ Google Sheets và tổng hợp
 */
function getScheduleData() {
  try {
    // Kiểm tra cache trước
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get('scheduleData');
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`Không tìm thấy sheet '${CONFIG.SHEET_NAME}'`);
    }

    // Lấy dữ liệu từ sheet
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    // Tìm index các cột cần thiết
    const columnIndexes = getColumnIndexes(headers);
    
    // Xử lý dữ liệu
    const rawData = values.slice(1).map(row => {
      const record = {};
      Object.keys(columnIndexes).forEach(key => {
        record[key] = row[columnIndexes[key]] || '';
      });
      return record;
    });

    // Tổng hợp dữ liệu theo timeline
    const processedData = processScheduleData(rawData);
    
    // Cache kết quả
    cache.put('scheduleData', JSON.stringify(processedData), CONFIG.CACHE_DURATION);
    
    return processedData;
    
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error);
    return {
      success: false,
      error: error.message,
      timeline: [],
      summary: {}
    };
  }
}

/**
 * Tìm index của các cột cần thiết
 */
function getColumnIndexes(headers) {
  const requiredColumns = {
    'tenCongTy': 'ten cong ty',
    'ngayBatDau': 'ngay bat dau kham',
    'ngayKetThuc': 'ngay ket thuc kham',
    'tongSoNgayKham': 'tong so ngay kham',
    'trungBinhNgay': 'trung binh ngay',
    'sang': 'sang',
    'chieu': 'chieu',
    'soNguoiKham': 'so nguoi kham'
  };
  
  const indexes = {};
  
  Object.keys(requiredColumns).forEach(key => {
    const columnName = requiredColumns[key];
    const index = headers.findIndex(h => h.toLowerCase().trim() === columnName.toLowerCase().trim());
    if (index === -1) {
      throw new Error(`Không tìm thấy cột '${columnName}'`);
    }
    indexes[key] = index;
  });
  
  return indexes;
}

/**
 * Xử lý và tổng hợp dữ liệu thành timeline
 */
function processScheduleData(rawData) {
  const companySchedules = {};
  const dailyTotals = {};
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  // Lọc dữ liệu theo tháng hiện tại
  const currentMonthData = rawData.filter(record => {
    const startDate = parseDate(record.ngayBatDau);
    const endDate = parseDate(record.ngayKetThuc);
    
    return startDate && endDate && 
           (startDate.getMonth() + 1 === currentMonth || endDate.getMonth() + 1 === currentMonth) &&
           (startDate.getFullYear() === currentYear || endDate.getFullYear() === currentYear);
  });

  // Xử lý từng record
  currentMonthData.forEach(record => {
    const startDate = parseDate(record.ngayBatDau);
    const endDate = parseDate(record.ngayKetThuc);
    const soNguoiKham = parseInt(record.soNguoiKham) || 0;
    const tongSoNgayKham = parseInt(record.tongSoNgayKham) || 1;
    const companyName = record.tenCongTy.trim();
    
    if (!startDate || !endDate || soNguoiKham === 0) return;
    
    // Tính số người khám trung bình mỗi ngày
    const nguoiKhamMoiNgay = Math.ceil(soNguoiKham / tongSoNgayKham);
    
    // Khởi tạo schedule cho công ty
    if (!companySchedules[companyName]) {
      companySchedules[companyName] = {};
    }
    
    // Phân bổ số người khám cho từng ngày trong khoảng thời gian
    const currentDate = new Date(startDate);
    let remainingPeople = soNguoiKham;
    let remainingDays = tongSoNgayKham;
    
    while (currentDate <= endDate && remainingDays > 0) {
      const dateKey = formatDateKey(currentDate);
      const peopleToday = remainingDays === 1 ? remainingPeople : Math.min(nguoiKhamMoiNgay, remainingPeople);
      
      if (currentDate.getMonth() + 1 === currentMonth && currentDate.getFullYear() === currentYear) {
        // Cộng dồn cho công ty
        companySchedules[companyName][dateKey] = (companySchedules[companyName][dateKey] || 0) + peopleToday;
        
        // Cộng dồn tổng ngày
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + peopleToday;
      }
      
      remainingPeople -= peopleToday;
      remainingDays--;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  // Tạo timeline data
  const timeline = createTimelineData(companySchedules, dailyTotals, currentMonth, currentYear);
  
  return {
    success: true,
    timeline: timeline,
    summary: {
      totalCompanies: Object.keys(companySchedules).length,
      totalDays: Object.keys(dailyTotals).length,
      currentMonth: currentMonth,
      currentYear: currentYear,
      maxPeoplePerDay: Math.max(...Object.values(dailyTotals), 0)
    }
  };
}

/**
 * Tạo dữ liệu timeline có cấu trúc
 */
function createTimelineData(companySchedules, dailyTotals, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const timeline = [];
  
  // Tạo header với các ngày
  const dates = [];
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(day);
  }
  
  // Dữ liệu cho từng công ty
  Object.keys(companySchedules).forEach(companyName => {
    const row = {
      company: companyName,
      data: []
    };
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const peopleCount = companySchedules[companyName][dateKey] || 0;
      row.data.push(peopleCount);
    }
    
    timeline.push(row);
  });
  
  // Thêm dòng tổng
  const totalRow = {
    company: 'TỔNG',
    data: []
  };
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const totalPeople = dailyTotals[dateKey] || 0;
    totalRow.data.push(totalPeople);
  }
  
  timeline.push(totalRow);
  
  return {
    dates: dates,
    rows: timeline
  };
}

/**
 * Parse ngày từ string
 */
function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Thử format MM/dd/yyyy hoặc dd/MM/yyyy
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      return new Date(year, month - 1, day);
    }
    
    return new Date(dateString);
  } catch (error) {
    console.error('Lỗi parse ngày:', dateString, error);
    return null;
  }
}

/**
 * Format ngày thành key
 */
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Làm mới cache
 */
function refreshCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('scheduleData');
  return getScheduleData();
}

/**
 * Lấy thông tin người dùng hiện tại
 */
function getCurrentUser() {
  return {
    email: Session.getActiveUser().getEmail(),
    name: Session.getActiveUser().getUsername() || 'User'
  };
}