/**
 * Lịch khám sức khoẻ công ty - HMSG CHC QUOC
 * Phiên bản 2.2 - Cải tiến UX và sửa lỗi
 * Tác giả: System Auto-generated
 * Ngày: 2025-07-04
 */

// Cấu hình chung
const CONFIG = {
  SHEET_ID: '15eMfEvqNvy1qBNG1NXwr7eSBsYZA6KqlBB3lTyzTfhM',
  SHEET_NAME: 'chc',
  CACHE_DURATION: 300,
  DATE_FORMAT: 'dd/MM/yyyy',
  HIGH_VOLUME_THRESHOLD: 50
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
function getScheduleData(month = null, year = null, showCompleted = false, searchCompany = '', filterEmployee = '', shiftFilter = 'total') {
  try {
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1);
    const targetYear = year || currentDate.getFullYear();
    
    const cacheKey = `scheduleData_${targetYear}_${targetMonth}_${showCompleted}_${searchCompany}_${filterEmployee}_${shiftFilter}`;
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Sử dụng dữ liệu từ cache');
      return JSON.parse(cachedData);
    }

    console.log(`Lấy dữ liệu tháng ${targetMonth}/${targetYear}, showCompleted: ${showCompleted}, shiftFilter: ${shiftFilter}`);
    
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

    // Lọc theo search và employee
    let filteredData = rawData.filter(record => {
      if (!record.tenCongTy || !record.ngayBatDau || !record.ngayKetThuc || !record.soNguoiKham) {
        return false;
      }
      
      // Search filter
      if (searchCompany && !record.tenCongTy.toLowerCase().includes(searchCompany.toLowerCase())) {
        return false;
      }
      
      // Employee filter
      if (filterEmployee && record.tenNhanVien && !record.tenNhanVien.toLowerCase().includes(filterEmployee.toLowerCase())) {
        return false;
      }
      
      // Status filter - Cải tiến: luôn tính cả completed và pending
      return true;
    });

    console.log(`Dữ liệu sau filter: ${filteredData.length} records`);

    // Tổng hợp dữ liệu
    const processedData = processScheduleData(filteredData, targetMonth, targetYear, showCompleted, shiftFilter);
    
    // Cache kết quả
    cache.put(cacheKey, JSON.stringify(processedData), CONFIG.CACHE_DURATION);
    console.log('Đã cache dữ liệu');
    
    return processedData;
    
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error);
    return {
      success: false,
      error: error.message,
      timeline: { dates: [], weekdays: [], rows: [] },
      summary: {},
      employees: []
    };
  }
}

/**
 * Tìm index của các cột - bổ sung cột tên nhân viên
 */
function getColumnIndexes(headers) {
  const requiredColumns = {
    'tenCongTy': ['ten cong ty', 'tên công ty'],
    'ngayBatDau': ['ngay bat dau kham', 'ngày bắt đầu khám'],
    'ngayKetThuc': ['ngay ket thuc kham', 'ngày kết thúc khám'],
    'tongSoNgayKham': ['tong so ngay kham thuc te', 'tổng số ngày khám'],
    'trungBinhNgay': ['trung binh ngay', 'trung bình ngày'],
    'sang': ['trung binh ngay sang', 'sáng'],
    'chieu': ['trung binh ngay chieu', 'chiều'],
    'soNguoiKham': ['so nguoi kham', 'số người khám'],
    'trangThaiKham': ['trang thai kham', 'trạng thái khám'],
    'tenNhanVien': ['ten nhan vien', 'tên nhân viên'] // Thêm cột mới
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
    
    if (foundIndex === -1 && !['trangThaiKham', 'tenNhanVien'].includes(key)) {
      throw new Error(`Không tìm thấy cột '${possibleNames[0]}'`);
    }
    
    if (foundIndex !== -1) {
      indexes[key] = foundIndex;
    }
  });
  
  return indexes;
}

/**
 * Kiểm tra ngày có phải chủ nhật không
 */
function isSunday(date) {
  return date.getDay() === 0;
}

/**
 * Điều chỉnh ngày để tránh chủ nhật
 */
function adjustForWorkingDays(startDate, endDate, totalDays) {
  const workingDays = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (!isSunday(currentDate)) {
      workingDays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Xử lý dữ liệu với tránh chủ nhật
 */
function processScheduleData(rawData, targetMonth, targetYear, showCompleted, shiftFilter = 'total') {
  const companySchedules = {};
  const dailyTotals = {};
  const companyStatus = {};
  const companyTotals = {}; // Tổng mỗi công ty
  const companyEmployees = {}; // Map company to employee
  const companyDetails = {}; // Lưu thông tin sáng/chiều cho mỗi công ty
  const employees = new Set(); // Danh sách nhân viên
  
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
    const sang = parseInt(record.sang) || 0;
    const chieu = parseInt(record.chieu) || 0;
    
    if (!startDate || !endDate || soNguoiKham === 0) return;
    
    // Thu thập nhân viên và map với công ty
    if (record.tenNhanVien) {
      const employeeName = record.tenNhanVien.trim();
      employees.add(employeeName);
      if (!companyEmployees[companyName]) {
        companyEmployees[companyName] = employeeName;
      }
    }
    
    // Lưu trạng thái công ty và thông tin sáng/chiều
    companyStatus[companyName] = trangThaiKham;
    
    // Cập nhật thông tin sáng/chiều - cộng dồn nếu đã có
    if (!companyDetails[companyName]) {
      companyDetails[companyName] = {
        sang: 0,
        chieu: 0,
        tongNguoi: 0,
        tongSoNgay: 0,
        employee: record.tenNhanVien ? record.tenNhanVien.trim() : ''
      };
    }
    
    // Lấy giá trị thực tế từ Google Sheet thay vì tính toán
    companyDetails[companyName].sang = sang;
    companyDetails[companyName].chieu = chieu;
    companyDetails[companyName].tongNguoi = soNguoiKham;
    companyDetails[companyName].tongSoNgay += tongSoNgayKham; // Cộng dồn số ngày khám
    
    // Cập nhật nhân viên nếu chưa có
    if (!companyDetails[companyName].employee && record.tenNhanVien) {
      companyDetails[companyName].employee = record.tenNhanVien.trim();
    }
    
    if (!companySchedules[companyName]) {
      companySchedules[companyName] = {};
      companyTotals[companyName] = 0;
    }
    
    // Điều chỉnh lịch để tránh chủ nhật
    const workingDays = adjustForWorkingDays(startDate, endDate, tongSoNgayKham);
    const actualWorkingDays = Math.min(workingDays.length, tongSoNgayKham);
    
    if (actualWorkingDays === 0) return;
    
    const nguoiKhamMoiNgay = Math.ceil(soNguoiKham / actualWorkingDays);
    
    // Phân bổ người khám cho từng ngày làm việc dựa trên shift filter
    let remainingPeople = soNguoiKham;
    let remainingDays = actualWorkingDays;
    
    // Tính số người khám dựa trên shift filter
    let actualPeoplePerDay = 0;
    if (shiftFilter === 'morning') {
      actualPeoplePerDay = Math.ceil(sang / actualWorkingDays);
      remainingPeople = sang;
    } else if (shiftFilter === 'afternoon') {
      actualPeoplePerDay = Math.ceil(chieu / actualWorkingDays);
      remainingPeople = chieu;
    } else {
      // Mặc định là 'total' - lấy tổng số người khám
      actualPeoplePerDay = Math.ceil(soNguoiKham / actualWorkingDays);
      remainingPeople = soNguoiKham;
    }
    
    workingDays.slice(0, actualWorkingDays).forEach(workDate => {
      if (workDate.getMonth() + 1 === targetMonth && workDate.getFullYear() === targetYear) {
        const dateKey = formatDateKey(workDate);
        const peopleToday = remainingDays === 1 ? 
          remainingPeople : 
          Math.min(actualPeoplePerDay, remainingPeople);
        
        companySchedules[companyName][dateKey] = 
          (companySchedules[companyName][dateKey] || 0) + peopleToday;
        
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + peopleToday;
        companyTotals[companyName] += peopleToday;
        
        remainingPeople -= peopleToday;
      }
      
      remainingDays--;
    });
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
  
  // Nếu không hiển thị completed, loại bỏ khỏi timeline
  if (!showCompleted) {
    Object.keys(companySchedules).forEach(companyName => {
      const status = companyStatus[companyName] || '';
      const statusLower = status.toLowerCase().trim();
      if (statusLower === 'đã khám xong' || statusLower === 'da kham xong') {
        delete companySchedules[companyName];
        delete companyTotals[companyName];
      }
    });
  }
  
  const timeline = createTimelineData(companySchedules, dailyTotals, companyTotals, targetMonth, targetYear, companyEmployees);
  
  return {
    success: true,
    timeline: timeline,
    companyDetails: companyDetails, // Thêm thông tin chi tiết công ty
    summary: {
      totalCompanies: Object.keys(companySchedules).length,
      completedCompanies: statusCounts.completed,
      pendingCompanies: statusCounts.pending,
      currentMonth: targetMonth,
      currentYear: targetYear,
      maxPeoplePerDay: Math.max(...Object.values(dailyTotals), 0),
      averagePerDay: Math.round(Object.values(dailyTotals).reduce((sum, val) => sum + val, 0) / Math.max(Object.keys(dailyTotals).length, 1)),
      totalRecords: rawData.length,
      processedRecords: targetMonthData.length
    },
    employees: Array.from(employees).sort()
  };
}

/**
 * Tạo timeline data với sắp xếp theo tổng số ngày khám (nhiều nhất ở dưới)
 */
function createTimelineData(companySchedules, dailyTotals, companyTotals, month, year, companyEmployees) {
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
  
  // Sắp xếp công ty theo tổng số người khám (ít nhất ở trên, nhiều nhất ở dưới)
  const sortedCompanies = Object.keys(companySchedules).sort((a, b) => {
    return (companyTotals[a] || 0) - (companyTotals[b] || 0);
  });
  
  sortedCompanies.forEach(companyName => {
    const row = {
      company: companyName,
      employee: companyEmployees[companyName] || '',
      data: [],
      total: companyTotals[companyName] || 0
    };
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const peopleCount = companySchedules[companyName][dateKey] || 0;
      row.data.push(peopleCount);
    }
    
    timeline.push(row);
  });
  
  return {
    dates: dates,
    weekdays: weekdays,
    rows: timeline
  };
}

// Lấy danh sách nhân viên
function getEmployeeList() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    const headers = values[0];
    const columnIndexes = getColumnIndexes(headers);
    
    const employees = new Set();
    
    values.slice(1).forEach(row => {
      if (columnIndexes.tenNhanVien && row[columnIndexes.tenNhanVien]) {
        employees.add(row[columnIndexes.tenNhanVien].trim());
      }
    });
    
    return Array.from(employees).sort();
    
  } catch (error) {
    console.error('Lỗi lấy danh sách nhân viên:', error);
    return [];
  }
}

/**
 * Tính tổng số nhân viên sáng/chiều cho tất cả công ty
 */
function calculateTotalShifts(companyDetails) {
  let totalSang = 0;
  let totalChieu = 0;
  
  Object.values(companyDetails).forEach(detail => {
    totalSang += detail.sang || 0;
    totalChieu += detail.chieu || 0;
  });
  
  return {
    sang: totalSang,
    chieu: totalChieu
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