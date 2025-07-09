/**
 * Lịch khám sức khoẻ công ty - HMSG CHC QUOC NGUYEN X
 * Phiên bản 2.5 - Fix UI dropdown styling + Cross-month logic
 * Tác giả: Quoc Nguyen
 * Ngày: 2025-07-05
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
function getScheduleData(month = null, year = null, showCompleted = false, searchCompany = '', filterEmployee = '', shiftFilter = 'total', timeFilter = 'all') {
  try {
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1);
    const targetYear = year || currentDate.getFullYear();
    
    // Cache key phải include shiftFilter và timeFilter để tránh cache sai
    const cacheKey = `scheduleData_${targetYear}_${targetMonth}_${showCompleted}_${searchCompany}_${filterEmployee}_${shiftFilter}_${timeFilter}`;
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Sử dụng dữ liệu từ cache cho shift:', shiftFilter, 'và timeFilter:', timeFilter);
      return JSON.parse(cachedData);
    }

    console.log(`Lấy dữ liệu tháng ${targetMonth}/${targetYear}, showCompleted: ${showCompleted}, shiftFilter: ${shiftFilter}, timeFilter: ${timeFilter}`);
    
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
        const value = row[columnIndexes[key]];
        // Chuyển đổi số cho các cột cận lâm sàng
        if (key.includes('sieuAm') || key.includes('khamPhuKhoa') || key.includes('xQuang') || key.includes('dienTamDo')) {
          record[key] = parseInt(value) || 0;
        } else {
          record[key] = value || '';
        }
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
      
      return true;
    });

    console.log(`Dữ liệu sau filter: ${filteredData.length} records`);

    // Tổng hợp dữ liệu với shiftFilter và timeFilter
    const processedData = processScheduleData(filteredData, targetMonth, targetYear, showCompleted, shiftFilter, timeFilter);
    
    // Cache kết quả
    cache.put(cacheKey, JSON.stringify(processedData), CONFIG.CACHE_DURATION);
    console.log('Đã cache dữ liệu cho shift:', shiftFilter, 'và timeFilter:', timeFilter);
    
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
 * Tìm index của các cột - bổ sung cột tên nhân viên và cận lâm sàng
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
    'tenNhanVien': ['ten nhan vien', 'tên nhân viên'],
    // Cận lâm sàng - Sáng
    'sieuAmBungSang': ['sieu am bung sang'],
    'khamPhuKhoaSang': ['kham phu khoa sang'],
    'xQuangSang': ['x quang sang'],
    'dienTamDoSang': ['dien tam do sang'],
    'sieuAmVuSang': ['sieu am vu sang'],
    'sieuAmGiapSang': ['sieu am giap sang'],
    'sieuAmTimSang': ['sieu am tim sang'],
    'sieuAmDongMachCanhSang': ['sieu am dong mach canh sang'],
    'sieuAmDanHoiMoGanSang': ['sieu am dan hoi mo gan sang'],
    // Cận lâm sàng - Chiều
    'sieuAmBungChieu': ['sieu am bung chieu'],
    'khamPhuKhoaChieu': ['kham phu khoa chieu'],
    'xQuangChieu': ['x quang chieu'],
    'dienTamDoChieu': ['dien tam do chieu'],
    'sieuAmVuChieu': ['sieu am vu chieu'],
    'sieuAmGiapChieu': ['sieu am giap chieu'],
    'sieuAmTimChieu': ['sieu am tim chieu'],
    'sieuAmDongMachCanhChieu': ['sieu am dong mach canh chieu'],
    'sieuAmDanHoiMoGanChieu': ['sieu am dan hoi mo gan chieu']
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
    
    // Chỉ bắt buộc các cột cơ bản, cận lâm sàng là optional
    const requiredFields = ['tenCongTy', 'ngayBatDau', 'ngayKetThuc', 'tongSoNgayKham', 'trungBinhNgay', 'sang', 'chieu', 'soNguoiKham'];
    if (foundIndex === -1 && requiredFields.includes(key)) {
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
 * 🔧 FIX: Xử lý dữ liệu với logic ĐÚNG cho cross-month scheduling
 */
function processScheduleData(rawData, targetMonth, targetYear, showCompleted, shiftFilter = 'total', timeFilter = 'all') {
  const companySchedules = {};
  const dailyTotals = {};
  const companyStatus = {};
  const companyTotals = {};
  const companyEmployees = {};
  const companyDetails = {};
  const employees = new Set();
  
  console.log(`🔧 Processing data with shiftFilter: ${shiftFilter}`);
  
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
    
    // Cập nhật thông tin sáng/chiều và cận lâm sàng
    if (!companyDetails[companyName]) {
      companyDetails[companyName] = {
        sang: 0,
        chieu: 0,
        tongNguoi: 0,
        tongSoNgay: 0,
        employee: record.tenNhanVien ? record.tenNhanVien.trim() : '',
        ngayBatDau: formatDate(record.ngayBatDau),
        ngayKetThuc: formatDate(record.ngayKetThuc),
        // Cận lâm sàng - Sáng
        sieuAmBungSang: 0,
        khamPhuKhoaSang: 0,
        xQuangSang: 0,
        dienTamDoSang: 0,
        sieuAmVuSang: 0,
        sieuAmGiapSang: 0,
        sieuAmTimSang: 0,
        sieuAmDongMachCanhSang: 0,
        sieuAmDanHoiMoGanSang: 0,
        // Cận lâm sàng - Chiều
        sieuAmBungChieu: 0,
        khamPhuKhoaChieu: 0,
        xQuangChieu: 0,
        dienTamDoChieu: 0,
        sieuAmVuChieu: 0,
        sieuAmGiapChieu: 0,
        sieuAmTimChieu: 0,
        sieuAmDongMachCanhChieu: 0,
        sieuAmDanHoiMoGanChieu: 0
      };
    }
    
    companyDetails[companyName].sang += sang;
    companyDetails[companyName].chieu += chieu;
    companyDetails[companyName].tongNguoi += soNguoiKham;
    companyDetails[companyName].tongSoNgay += tongSoNgayKham;
    
    // Cập nhật dữ liệu cận lâm sàng
    const clinicalFields = [
      'sieuAmBungSang', 'khamPhuKhoaSang', 'xQuangSang', 'dienTamDoSang',
      'sieuAmVuSang', 'sieuAmGiapSang', 'sieuAmTimSang', 'sieuAmDongMachCanhSang', 'sieuAmDanHoiMoGanSang',
      'sieuAmBungChieu', 'khamPhuKhoaChieu', 'xQuangChieu', 'dienTamDoChieu',
      'sieuAmVuChieu', 'sieuAmGiapChieu', 'sieuAmTimChieu', 'sieuAmDongMachCanhChieu', 'sieuAmDanHoiMoGanChieu'
    ];
    
    clinicalFields.forEach(field => {
      if (record[field] !== undefined) {
        companyDetails[companyName][field] += record[field];
      }
    });
    
    if (!companyDetails[companyName].employee && record.tenNhanVien) {
      companyDetails[companyName].employee = record.tenNhanVien.trim();
    }
    
    if (!companySchedules[companyName]) {
      companySchedules[companyName] = {};
      companyTotals[companyName] = 0;
    }
    
    // 🔧 FIX: Cross-month logic - chỉ tính ngày trong target month
    const targetMonthStart = new Date(targetYear, targetMonth - 1, 1);
    const targetMonthEnd = new Date(targetYear, targetMonth, 0);
    
    // Cắt ngày bắt đầu và kết thúc theo target month
    const effectiveStartDate = startDate < targetMonthStart ? targetMonthStart : startDate;
    const effectiveEndDate = endDate > targetMonthEnd ? targetMonthEnd : endDate;
    
    // Điều chỉnh lịch để tránh chủ nhật - chỉ trong target month
    const workingDays = adjustForWorkingDays(effectiveStartDate, effectiveEndDate, tongSoNgayKham);
    const actualWorkingDaysInMonth = workingDays.filter(day => 
      day >= targetMonthStart && day <= targetMonthEnd
    );
    
    if (actualWorkingDaysInMonth.length === 0) return;
    
    // 🔧 FIX: Logic ĐÚNG tính số người khám dựa trên số ngày THỰC TẾ trong target month
    let peoplePerDay = 0;
    
    if (shiftFilter === 'morning' || shiftFilter === 'sang') {
      peoplePerDay = sang; // Số người sáng mỗi ngày
      console.log(`🌅 Sáng - Company: ${companyName}, Per day: ${sang}, Days in month: ${actualWorkingDaysInMonth.length}`);
    } else if (shiftFilter === 'afternoon' || shiftFilter === 'chieu') {
      peoplePerDay = chieu; // Số người chiều mỗi ngày  
      console.log(`🌆 Chiều - Company: ${companyName}, Per day: ${chieu}, Days in month: ${actualWorkingDaysInMonth.length}`);
    } else {
      // Tổng: Tính trung bình người/ngày trong toàn bộ thời gian khám
      peoplePerDay = Math.ceil(soNguoiKham / tongSoNgayKham);
      console.log(`📊 Tổng - Company: ${companyName}, Total: ${soNguoiKham}, Per day: ${peoplePerDay}, Days in month: ${actualWorkingDaysInMonth.length}`);
    }
    
    // 🔧 FIX: Phân bổ người khám chỉ cho các ngày trong target month
    actualWorkingDaysInMonth.forEach(workDate => {
      const dateKey = formatDateKey(workDate);
      
      // Đảm bảo ngày thuộc target month
      if (workDate.getMonth() + 1 === targetMonth && workDate.getFullYear() === targetYear) {
        companySchedules[companyName][dateKey] = 
          (companySchedules[companyName][dateKey] || 0) + peoplePerDay;
        
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + peoplePerDay;
        companyTotals[companyName] = (companyTotals[companyName] || 0) + peoplePerDay;
      }
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

  // Áp dụng time filter (ngày, tuần, tháng)
  const filteredCompanySchedules = applyTimeFilter(companySchedules, timeFilter);

  const timeline = createTimelineData(filteredCompanySchedules, dailyTotals, companyTotals, targetMonth, targetYear, companyEmployees);

  // Tính lại statistics dựa trên filtered data
  const filteredStats = calculateFilteredStats(timeline, shiftFilter);
  
  // Tính lại statusCounts dựa trên filtered companies để tránh số âm
  const filteredStatusCounts = { completed: 0, pending: 0 };
  Object.keys(filteredCompanySchedules).forEach(companyName => {
    const status = companyStatus[companyName] || '';
    const statusLower = status.toLowerCase().trim();
    if (statusLower === 'đã khám xong' || statusLower === 'da kham xong') {
      filteredStatusCounts.completed++;
    } else {
      filteredStatusCounts.pending++;
    }
  });

  return {
    success: true,
    timeline: timeline,
    companyDetails: companyDetails,
    summary: {
      totalCompanies: Object.keys(filteredCompanySchedules).length,
      completedCompanies: filteredStatusCounts.completed,
      pendingCompanies: filteredStatusCounts.pending,
      activeCompanies: filteredStatusCounts.pending,
      currentMonth: targetMonth,
      currentYear: targetYear,
      maxPeoplePerDay: filteredStats.maxPeoplePerDay,
      averagePerDay: filteredStats.averagePerDay,
      totalRecords: rawData.length,
      processedRecords: targetMonthData.length,
      shiftFilter: shiftFilter
    },
    employees: Array.from(employees).sort()
  };
}

/**
 * Tính statistics dựa trên filtered timeline data
 */
function calculateFilteredStats(timeline, shiftFilter) {
  if (!timeline.rows || timeline.rows.length === 0) {
    return { maxPeoplePerDay: 0, averagePerDay: 0 };
  }
  
  const dailyTotals = new Array(timeline.dates.length).fill(0);
  
  timeline.rows.forEach(row => {
    row.data.forEach((value, index) => {
      dailyTotals[index] += value || 0;
    });
  });
  
  const maxPeoplePerDay = Math.max(...dailyTotals, 0);
  const totalPeople = dailyTotals.reduce((sum, val) => sum + val, 0);
  const averagePerDay = timeline.dates.length > 0 ? 
    Math.round(totalPeople / timeline.dates.length) : 0;
  
  console.log(`📊 Stats for ${shiftFilter}: Max=${maxPeoplePerDay}, Avg=${averagePerDay}`);
  
  return { maxPeoplePerDay, averagePerDay };
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

/**
 * Lọc dữ liệu theo thời gian (ngày, tuần, tháng)
 */
function applyTimeFilter(companySchedules, timeFilter) {
  if (!timeFilter || timeFilter === 'all') {
    return companySchedules; // Không lọc
  }
  
  const today = new Date();
  const currentDateKey = formatDateKey(today);
  
  // Tính ngày đầu tuần (thứ 2)
  const currentDay = today.getDay(); // 0 = CN, 1 = T2, ...
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  
  // Tính ngày cuối tuần (chủ nhật)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  // Tạo mảng các ngày trong tuần hiện tại
  const currentWeekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    currentWeekDates.push(formatDateKey(date));
  }
  
  // Tính ngày đầu tháng và cuối tháng hiện tại
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  
  // Tạo mảng các ngày trong tháng hiện tại
  const currentMonthDates = [];
  const tempDate = new Date(firstDayOfMonth);
  while (tempDate <= lastDayOfMonth) {
    currentMonthDates.push(formatDateKey(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }
  
  const filteredSchedules = {};
  
  // Lọc theo ngày, tuần hoặc tháng
  Object.keys(companySchedules).forEach(companyName => {
    const companyData = companySchedules[companyName];
    
    // Kiểm tra xem công ty có lịch khám trong khoảng thời gian được lọc không
    let hasAppointmentInTimeFilter = false;
    
    if (timeFilter === 'today') {
      // Kiểm tra ngày hiện tại
      hasAppointmentInTimeFilter = companyData[currentDateKey] && companyData[currentDateKey] > 0;
      console.log(`Công ty ${companyName} trong ngày ${currentDateKey}: ${hasAppointmentInTimeFilter ? 'Có' : 'Không'}`);
    } else if (timeFilter === 'week') {
      // Kiểm tra tuần hiện tại
      for (const dateKey of currentWeekDates) {
        if (companyData[dateKey] && companyData[dateKey] > 0) {
          hasAppointmentInTimeFilter = true;
          console.log(`Công ty ${companyName} trong tuần có ngày ${dateKey}: Có`);
          break;
        }
      }
    } else if (timeFilter === 'month') {
      // Kiểm tra tháng hiện tại
      for (const dateKey of currentMonthDates) {
        if (companyData[dateKey] && companyData[dateKey] > 0) {
          hasAppointmentInTimeFilter = true;
          console.log(`Công ty ${companyName} trong tháng có ngày ${dateKey}: Có`);
          break;
        }
      }
    }
    
    // Nếu có lịch khám trong khoảng thời gian được lọc, thêm vào kết quả
    if (hasAppointmentInTimeFilter) {
      filteredSchedules[companyName] = companyData;
    }
  });
  
  console.log(`Lọc theo ${timeFilter}: Từ ${Object.keys(companySchedules).length} công ty còn ${Object.keys(filteredSchedules).length} công ty`);
  
  return timeFilter === 'all' ? companySchedules : filteredSchedules;
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

/**
 * Định dạng ngày tháng theo dd/mm/yyyy
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  // Kiểm tra nếu dateString đã là định dạng dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }
  
  // Nếu là định dạng ISO hoặc khác
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Trả về nguyên bản nếu không phải ngày hợp lệ
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    console.error('Lỗi định dạng ngày:', e);
    return dateString;
  }
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

/**
 * Lấy dữ liệu cận lâm sàng cho bảng hiển thị
 */
function getClinicalData(month = null, year = null, showCompleted = false, searchCompany = '', filterEmployee = '', shiftFilter = 'total', timeFilter = 'all') {
  try {
    // Luôn lọc theo tháng và chỉ hiển thị công ty chưa khám xong
    const scheduleData = getScheduleData(month, year, false, searchCompany, filterEmployee, shiftFilter, timeFilter);
    
    if (!scheduleData.success) {
      return scheduleData;
    }
    
    const clinicalData = [];
    const companyDetails = scheduleData.companyDetails || {};
    
    // Định nghĩa thứ tự cột theo ảnh người dùng gửi
    const clinicalColumns = [
      { key: 'tongSieuAmSang', label: 'Tổng siêu âm sáng' },
      { key: 'khamPhuKhoaSang', label: 'Khám phụ khoa sáng' },
      { key: 'xQuangSang', label: 'X-quang sáng' },
      { key: 'dienTamDoSang', label: 'Điện tâm đồ sáng' },
      { key: 'sieuAmBungSang', label: 'Siêu âm bụng sáng' },
      { key: 'sieuAmVuSang', label: 'Siêu âm vú sáng' },
      { key: 'sieuAmGiapSang', label: 'Siêu âm giáp sáng' },
      { key: 'sieuAmTimSang', label: 'Siêu âm tim sáng' },
      { key: 'sieuAmDongMachCanhSang', label: 'Siêu âm động mạch cảnh sáng' },
      { key: 'sieuAmDanHoiMoGanSang', label: 'Siêu âm đàn hồi mô gan sáng' },
      { key: 'tongSieuAmChieu', label: 'Tổng siêu âm chiều' },
      { key: 'khamPhuKhoaChieu', label: 'Khám phụ khoa chiều' },
      { key: 'xQuangChieu', label: 'X-quang chiều' },
      { key: 'dienTamDoChieu', label: 'Điện tâm đồ chiều' },
      { key: 'sieuAmBungChieu', label: 'Siêu âm bụng chiều' },
      { key: 'sieuAmVuChieu', label: 'Siêu âm vú chiều' },
      { key: 'sieuAmGiapChieu', label: 'Siêu âm giáp chiều' },
      { key: 'sieuAmTimChieu', label: 'Siêu âm tim chiều' },
      { key: 'sieuAmDongMachCanhChieu', label: 'Siêu âm động mạch cảnh chiều' },
      { key: 'sieuAmDanHoiMoGanChieu', label: 'Siêu âm đàn hồi mô gan chiều' }
    ];
    
    // Xử lý dữ liệu cho từng công ty
    Object.keys(companyDetails).forEach(companyName => {
      const details = companyDetails[companyName];
      
      const clinicalRow = {
        company: companyName,
        employee: details.totalPeople || 0,
        // Tính tổng siêu âm
        tongSieuAmSang: (details.sieuAmBungSang || 0) + (details.sieuAmVuSang || 0) + 
                       (details.sieuAmGiapSang || 0) + (details.sieuAmTimSang || 0) + 
                       (details.sieuAmDongMachCanhSang || 0) + (details.sieuAmDanHoiMoGanSang || 0),
        tongSieuAmChieu: (details.sieuAmBungChieu || 0) + (details.sieuAmVuChieu || 0) + 
                        (details.sieuAmGiapChieu || 0) + (details.sieuAmTimChieu || 0) + 
                        (details.sieuAmDongMachCanhChieu || 0) + (details.sieuAmDanHoiMoGanChieu || 0),
        // Các cột cận lâm sàng khác
        khamPhuKhoaSang: details.khamPhuKhoaSang || 0,
        xQuangSang: details.xQuangSang || 0,
        dienTamDoSang: details.dienTamDoSang || 0,
        sieuAmBungSang: details.sieuAmBungSang || 0,
        sieuAmVuSang: details.sieuAmVuSang || 0,
        sieuAmGiapSang: details.sieuAmGiapSang || 0,
        sieuAmTimSang: details.sieuAmTimSang || 0,
        sieuAmDongMachCanhSang: details.sieuAmDongMachCanhSang || 0,
        sieuAmDanHoiMoGanSang: details.sieuAmDanHoiMoGanSang || 0,
        khamPhuKhoaChieu: details.khamPhuKhoaChieu || 0,
        xQuangChieu: details.xQuangChieu || 0,
        dienTamDoChieu: details.dienTamDoChieu || 0,
        sieuAmBungChieu: details.sieuAmBungChieu || 0,
        sieuAmVuChieu: details.sieuAmVuChieu || 0,
        sieuAmGiapChieu: details.sieuAmGiapChieu || 0,
        sieuAmTimChieu: details.sieuAmTimChieu || 0,
        sieuAmDongMachCanhChieu: details.sieuAmDongMachCanhChieu || 0,
        sieuAmDanHoiMoGanChieu: details.sieuAmDanHoiMoGanChieu || 0
      };
      
      // Chỉ thêm công ty nếu có ít nhất một hạng mục cận lâm sàng > 0
      const hasClinicalData = clinicalColumns.some(col => clinicalRow[col.key] > 0);
      if (hasClinicalData) {
        clinicalData.push(clinicalRow);
      }
    });
    
    // Sắp xếp theo số người giảm dần (nhiều người nhất lên đầu)
    clinicalData.sort((a, b) => b.employee - a.employee);
    
    return {
      success: true,
      data: clinicalData,
      columns: clinicalColumns,
      summary: scheduleData.summary
    };
    
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu cận lâm sàng:', error);
    return {
      success: false,
      error: error.message,
      data: [],
      columns: []
    };
  }
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