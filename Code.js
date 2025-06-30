/**
 * Lịch khám sức khoẻ công ty - HMSG CHC
 * Phiên bản 2.0 - Thiết kế tối giản
 * Tác giả: System Auto-generated
 * Ngày: 2025-06-30
 */

// Cấu hình chung
const CONFIG = {
  SHEET_ID: '15eMfEvqNvy1qBNG1NXwr7eSBsYZA6KqlBB3lTyzTfhM',
  SHEET_NAME: 'chc',
  CACHE_DURATION: 300,
  DATE_FORMAT: 'dd/MM/yyyy'
};

function doGet(e) {
  return HtmlService.createTemplateFromFile('dashboard')
    .evaluate()
    .setTitle('Lịch khám sức khoẻ công ty - HMSG CHC')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Lấy dữ liệu với tháng cụ thể và filter trạng thái
 */
function getScheduleData(month = null, year = null, showCompleted = false) {
  try {
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1);
    const targetYear = year || currentDate.getFullYear();
    
    const cacheKey = `scheduleData_${targetYear}_${targetMonth}_${showCompleted}`;
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Sử dụng dữ liệu từ cache');
      return JSON.parse(cachedData);
    }

    console.log(`Lấy dữ liệu tháng ${targetMonth}/${targetYear}, showCompleted: ${showCompleted}`);
    
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`Không tìm thấy sheet '${CONFIG.SHEET_NAME}'`);
    }

    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length === 0) {
      throw new Error('Sheet không có dữ liệu');
    }
    
    const headers = values[0];
    const columnIndexes = getColumnIndexes(headers);
    
    // Xử lý dữ liệu thô
    const rawData = values.slice(1).map(row => {
      const record = {};
      Object.keys(columnIndexes).forEach(key => {
        record[key] = row[columnIndexes[key]] || '';
      });
      return record;
    });

    // Lọc theo trạng thái khám
    const filteredData = rawData.filter(record => {
      if (!record.tenCongTy || !record.ngayBatDau || !record.ngayKetThuc || !record.soNguoiKham) {
        return false;
      }
      
      // Filter theo trạng thái khám
      if (!showCompleted && record.trangThaiKham) {
        const status = record.trangThaiKham.toLowerCase().trim();
        if (status === 'đã khám xong' || status === 'da kham xong') {
          return false;
        }
      }
      
      return true;
    });

    console.log(`Dữ liệu sau filter: ${filteredData.length} records`);

    // Tổng hợp dữ liệu
    const processedData = processScheduleData(filteredData, targetMonth, targetYear);
    
    // Cache kết quả
    cache.put(cacheKey, JSON.stringify(processedData), CONFIG.CACHE_DURATION);
    console.log('Đã cache dữ liệu');
    
    return processedData;
    
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error);
    return {
      success: false,
      error: error.message,
      timeline: { dates: [], rows: [] },
      summary: {}
    };
  }
}

/**
 * Tìm index của các cột - bổ sung cột trạng thái khám
 */
function getColumnIndexes(headers) {
  const requiredColumns = {
    'tenCongTy': ['ten cong ty', 'tên công ty'],
    'ngayBatDau': ['ngay bat dau kham', 'ngày bắt đầu khám'],
    'ngayKetThuc': ['ngay ket thuc kham', 'ngày kết thúc khám'],
    'tongSoNgayKham': ['tong so ngay kham', 'tổng số ngày khám'],
    'trungBinhNgay': ['trung binh ngay', 'trung bình ngày'],
    'sang': ['sang', 'sáng'],
    'chieu': ['chieu', 'chiều'],
    'soNguoiKham': ['so nguoi kham', 'số người khám'],
    'trangThaiKham': ['trang thai kham', 'trạng thái khám'] // Thêm cột mới
  };
  
  const indexes = {};
  
  Object.keys(requiredColumns).forEach(key => {
    const possibleNames = requiredColumns[key];
    let foundIndex = -1;
    
    for (const name of possibleNames) {
      foundIndex = headers.findIndex(h => 
        h.toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (foundIndex !== -1) break;
    }
    
    if (foundIndex === -1 && key !== 'trangThaiKham') { // trangThaiKham là optional
      throw new Error(`Không tìm thấy cột '${possibleNames[0]}'`);
    }
    
    if (foundIndex !== -1) {
      indexes[key] = foundIndex;
    }
  });
  
  return indexes;
}

/**
 * Xử lý dữ liệu với tháng cụ thể
 */
function processScheduleData(rawData, targetMonth, targetYear) {
  const companySchedules = {};
  const dailyTotals = {};
  const companyStatus = {}; // Theo dõi trạng thái từng công ty
  
  // Lọc dữ liệu có giao thoa với tháng target
  const targetMonthData = rawData.filter(record => {
    const startDate = parseDate(record.ngayBatDau);
    const endDate = parseDate(record.ngayKetThuc);
    
    if (!startDate || !endDate) return false;
    
    const targetMonthStart = new Date(targetYear, targetMonth - 1, 1);
    const targetMonthEnd = new Date(targetYear, targetMonth, 0);
    
    return (startDate <= targetMonthEnd && endDate >= targetMonthStart);
  });

  // Xử lý từng record
  targetMonthData.forEach(record => {
    const startDate = parseDate(record.ngayBatDau);
    const endDate = parseDate(record.ngayKetThuc);
    const soNguoiKham = parseInt(record.soNguoiKham) || 0;
    const tongSoNgayKham = parseInt(record.tongSoNgayKham) || 1;
    const companyName = record.tenCongTy.trim();
    const trangThaiKham = record.trangThaiKham || 'Chưa khám xong';
    
    if (!startDate || !endDate || soNguoiKham === 0) return;
    
    // Lưu trạng thái công ty
    companyStatus[companyName] = trangThaiKham;
    
    const nguoiKhamMoiNgay = Math.ceil(soNguoiKham / tongSoNgayKham);
    
    if (!companySchedules[companyName]) {
      companySchedules[companyName] = {};
    }
    
    // Phân bổ người khám cho từng ngày
    const currentDate = new Date(startDate);
    let remainingPeople = soNguoiKham;
    let remainingDays = tongSoNgayKham;
    
    while (currentDate <= endDate && remainingDays > 0) {
      if (currentDate.getMonth() + 1 === targetMonth && currentDate.getFullYear() === targetYear) {
        const dateKey = formatDateKey(currentDate);
        const peopleToday = remainingDays === 1 ? 
          remainingPeople : 
          Math.min(nguoiKhamMoiNgay, remainingPeople);
        
        companySchedules[companyName][dateKey] = 
          (companySchedules[companyName][dateKey] || 0) + peopleToday;
        
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + peopleToday;
        
        remainingPeople -= peopleToday;
      }
      
      remainingDays--;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  // Tính thống kê trạng thái
  const statusCounts = { completed: 0, pending: 0 };
  Object.values(companyStatus).forEach(status => {
    const statusLower = status.toLowerCase().trim();
    if (statusLower === 'đã khám xong' || statusLower === 'da kham xong') {
      statusCounts.completed++;
    } else {
      statusCounts.pending++;
    }
  });
  
  // Tính trung bình ngày
  const totalDays = Object.values(dailyTotals).reduce((sum, val) => sum + val, 0);
  const workingDays = Object.keys(dailyTotals).length;
  const averagePerDay = workingDays > 0 ? Math.round(totalDays / workingDays) : 0;
  
  const timeline = createTimelineData(companySchedules, dailyTotals, targetMonth, targetYear);
  
  return {
    success: true,
    timeline: timeline,
    summary: {
      totalCompanies: Object.keys(companySchedules).length,
      completedCompanies: statusCounts.completed,
      pendingCompanies: statusCounts.pending,
      currentMonth: targetMonth,
      currentYear: targetYear,
      maxPeoplePerDay: Math.max(...Object.values(dailyTotals), 0),
      averagePerDay: averagePerDay,
      totalRecords: rawData.length,
      processedRecords: targetMonthData.length
    }
  };
}

/**
 * Tạo timeline data với thứ trong tuần
 */
function createTimelineData(companySchedules, dailyTotals, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const timeline = [];
  
  // Tạo dates với thứ
  const dates = [];
  const weekdays = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
    
    dates.push(day);
    weekdays.push(weekday);
  }
  
  // Sắp xếp công ty theo tên
  const sortedCompanies = Object.keys(companySchedules).sort();
  
  sortedCompanies.forEach(companyName => {
    const row = {
      company: companyName,
      data: [],
      total: 0
    };
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const peopleCount = companySchedules[companyName][dateKey] || 0;
      row.data.push(peopleCount);
      row.total += peopleCount;
    }
    
    timeline.push(row);
  });
  
  // Dòng tổng
  const totalRow = {
    company: 'TỔNG',
    data: [],
    total: 0
  };
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const totalPeople = dailyTotals[dateKey] || 0;
    totalRow.data.push(totalPeople);
    totalRow.total += totalPeople;
  }
  
  timeline.push(totalRow);
  
  return {
    dates: dates,
    weekdays: weekdays,
    rows: timeline
  };
}

// Các hàm utility giữ nguyên
function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    if (dateString instanceof Date) return dateString;
    
    const dateStr = dateString.toString().trim();
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year, month, day;
        
        if (format.source.includes('yyyy')) {
          if (format.source.startsWith('^\\(\\d{4}\\)')) {
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          } else {
            const part1 = parseInt(match[1]);
            const part2 = parseInt(match[2]);
            year = parseInt(match[3]);
            
            if (part1 > 12) {
              day = part1;
              month = part2;
            } else if (part2 > 12) {
              month = part1;
              day = part2;
            } else {
              day = part1;
              month = part2;
            }
          }
        }
        
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) return date;
      }
    }
    
    const directParse = new Date(dateStr);
    if (!isNaN(directParse.getTime())) return directParse;
    
    return null;
    
  } catch (error) {
    console.error('Lỗi parse ngày:', dateString, error);
    return null;
  }
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshCache() {
  console.log('Làm mới cache...');
  const cache = CacheService.getScriptCache();
  cache.removeAll(['scheduleData']);
  
  // Lấy dữ liệu mới
  const currentDate = new Date();
  return getScheduleData(currentDate.getMonth() + 1, currentDate.getFullYear(), false);
}

function getCurrentUser() {
  return {
    email: Session.getActiveUser().getEmail(),
    name: Session.getActiveUser().getUsername() || 'User'
  };
}

function testConnection() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      return `Lỗi: Không tìm thấy sheet '${CONFIG.SHEET_NAME}'`;
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    return {
      success: true,
      message: `Kết nối thành công! Tìm thấy ${values.length} dòng dữ liệu`,
      headers: values[0],
      sampleData: values.slice(1, 3)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}