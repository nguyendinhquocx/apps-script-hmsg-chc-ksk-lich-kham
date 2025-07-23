/**
 * Lịch khám sức khoẻ công ty - HMSG CHC QUOC NGUYEN X
 * Phiên bản 2.5 - Fix UI dropdown styling + Cross-month logic.
 * Tác giả: Quoc Nguyen
 * Ngày: 2025-07-05
 */

// Cấu hình chung
const CONFIG = {
  SHEET_ID: '15eMfEvqNvy1qBNG1NXwr7eSBsYZA6KqlBB3lTyzTfhM',
  SHEET_NAME: 'chc',
  CACHE_DURATION: 300,
  DATE_FORMAT: 'mm/dd/yyyy',
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
function getScheduleData(month = null, year = null, searchCompany = '', filterEmployee = '', shiftFilter = 'total', timeFilter = 'all', showGold = false) {
  try {
    // Thêm timeout protection
    const startTime = new Date().getTime();
    const MAX_EXECUTION_TIME = 25000; // 25 giây max
    
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1);
    const targetYear = year || currentDate.getFullYear();
    
    // Tối ưu cache key - tách thành nhiều level để tăng hiệu quả cache
    const baseCacheKey = `scheduleData_${targetYear}_${targetMonth}`;
    const filterCacheKey = `${baseCacheKey}_${showGold}`;
    const searchCacheKey = searchCompany ? `_search_${searchCompany.substring(0, 10)}` : '';
    const employeeCacheKey = filterEmployee ? `_emp_${filterEmployee.substring(0, 10)}` : '';
    const cacheKey = `${filterCacheKey}${searchCacheKey}${employeeCacheKey}_${shiftFilter}_${timeFilter}`;
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Sử dụng dữ liệu từ cache cho shift:', shiftFilter, 'và timeFilter:', timeFilter);
      return JSON.parse(cachedData);
    }
    
    // Kiểm tra thời gian thực thi
    function checkExecutionTime() {
      const currentTime = new Date().getTime();
      if (currentTime - startTime > MAX_EXECUTION_TIME) {
        throw new Error('Execution timeout - dữ liệu quá lớn, vui lòng thử lại');
      }
    }

    console.log(`Lấy dữ liệu tháng ${targetMonth}/${targetYear}, shiftFilter: ${shiftFilter}, timeFilter: ${timeFilter}, showGold: ${showGold}`);
    
    // Kiểm tra thời gian thực thi
    checkExecutionTime();
    
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`Không tìm thấy sheet '${CONFIG.SHEET_NAME}'`);
    }

    // Kiểm tra thời gian thực thi trước khi đọc dữ liệu
    checkExecutionTime();
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length === 0) {
      throw new Error('Sheet không có dữ liệu');
    }
    
    const headers = values[0];
    const columnIndexes = getColumnIndexes(headers);
    
    // Xử lý dữ liệu thô với timeout check
    const rawData = values.slice(1).map((row, index) => {
      // Kiểm tra timeout mỗi 100 records
      if (index % 100 === 0) {
        checkExecutionTime();
      }
      
      const record = {};
      Object.keys(columnIndexes).forEach(key => {
        const value = row[columnIndexes[key]];
        // Chuyển đổi số cho các cột cận lâm sàng
        if (key.includes('sieuAm') || key.includes('khamPhuKhoa') || key.includes('xQuang') || key.includes('dienTamDo') || key.includes('doLoang')) {
          record[key] = parseInt(value) || 0;
        } else {
          record[key] = value || '';
        }
      });
      return record;
    });

    // Lọc theo search, employee và gold
    let filteredData = rawData.filter(record => {
      if (!record.tenCongTy || !record.ngayBatDau || !record.ngayKetThuc || !record.soNguoiKham) {
        return false;
      }
      
      // Search filter
      if (searchCompany && !record.tenCongTy.toLowerCase().includes(searchCompany.toLowerCase())) {
        return false;
      }
      
      // Employee filter
      if (filterEmployee && filterEmployee.trim() !== '') {
        if (!record.tenNhanVien || !record.tenNhanVien.toLowerCase().includes(filterEmployee.toLowerCase())) {
          return false;
        }
      }
      
      // Gold filter
      const goldValue = (record.gold || '').toString().toLowerCase().trim();
      const hasGoldMark = goldValue === 'x' || goldValue === 'X';
      
      if (showGold) {
        // Nếu showGold = true, chỉ hiển thị những công ty có đánh dấu gold
        if (!hasGoldMark) {
          return false;
        }
      } else {
        // Nếu showGold = false, ẩn những công ty có đánh dấu gold
        if (hasGoldMark) {
          return false;
        }
      }
      
      return true;
    });

    console.log(`Dữ liệu sau filter: ${filteredData.length} records`);

    // Tổng hợp dữ liệu với shiftFilter, timeFilter và showGold
    const processedData = processScheduleData(filteredData, targetMonth, targetYear, shiftFilter, timeFilter, showGold);
    
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
    'cacNgayKhamThucTe': ['cac ngay kham thuc te', 'các ngày khám thực tế'],
    'tongSoNgayKham': ['tong so ngay kham thuc te', 'tổng số ngày khám'],
    'trungBinhNgay': ['trung binh ngay', 'trung bình ngày'],
    'sang': ['trung binh ngay sang', 'sáng'],
    'chieu': ['trung binh ngay chieu', 'chiều'],
    'soNguoiKham': ['so nguoi kham', 'số người khám'],
    'trangThaiKham': ['trang thai kham', 'trạng thái khám'],
    'tenNhanVien': ['ten nhan vien', 'tên nhân viên'],
    'gold': ['gold'],
    'ngayLayMau': ['ngay lay mau', 'ngày lấy máu'],
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
    'sieuAmDauDoAmDaoSang': ['sieu am dau do am dao sang'],
    'doLoangXuongSang': ['do loang xuong sang'],
    // Cận lâm sàng - Chiều
    'sieuAmBungChieu': ['sieu am bung chieu'],
    'khamPhuKhoaChieu': ['kham phu khoa chieu'],
    'xQuangChieu': ['x quang chieu'],
    'dienTamDoChieu': ['dien tam do chieu'],
    'sieuAmVuChieu': ['sieu am vu chieu'],
    'sieuAmGiapChieu': ['sieu am giap chieu'],
    'sieuAmTimChieu': ['sieu am tim chieu'],
    'sieuAmDongMachCanhChieu': ['sieu am dong mach canh chieu'],
    'sieuAmDanHoiMoGanChieu': ['sieu am dan hoi mo gan chieu'],
    'sieuAmDauDoAmDaoChieu': ['sieu am dau do am dao chieu'],
    'doLoangXuongChieu': ['do loang xuong chieu']
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
 * Parse ngày khám thực tế từ chuỗi mm/dd, mm/dd
 */
function parseActualExamDates(actualDatesStr, targetYear, targetMonth) {
  if (!actualDatesStr || actualDatesStr.trim() === '') {
    return [];
  }
  
  const dates = [];
  const dateStrings = actualDatesStr.split(',').map(s => s.trim());
  
  dateStrings.forEach(dateStr => {
    if (dateStr.includes('/')) {
      const [month, day] = dateStr.split('/').map(s => parseInt(s.trim()));
      if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(targetYear, month - 1, day);
        // Chỉ lấy ngày thuộc target month và không phải chủ nhật
        if (date.getMonth() + 1 === targetMonth && !isSunday(date)) {
          dates.push(date);
        }
      }
    }
  });
  
  return dates;
}

/**
 * 🔧 FIX: Xử lý dữ liệu với logic ĐÚNG cho cross-month scheduling
 */
function processScheduleData(rawData, targetMonth, targetYear, shiftFilter = 'total', timeFilter = 'all', showGold = false) {
  // Tối ưu: Sử dụng Map thay vì Object để tăng hiệu suất
  const companySchedules = new Map();
  const dailyTotals = new Map();
  const companyStatus = new Map();
  const companyTotals = new Map();
  const companyEmployees = new Map();
  const companyDetails = new Map();
  const employees = new Set();
  
  // Early return nếu không có dữ liệu
  if (!rawData || rawData.length === 0) {
    return {
      companySchedules: {},
      dailyTotals: {},
      companyStatus: {},
      companyTotals: {},
      companyEmployees: {},
      companyDetails: {},
      employees: []
    };
  }
  
  console.log(`🔧 Processing data with shiftFilter: ${shiftFilter}, showGold: ${showGold}`);
  
  // Tối ưu: Pre-calculate target month boundaries
  const targetMonthStart = new Date(targetYear, targetMonth - 1, 1);
  const targetMonthEnd = new Date(targetYear, targetMonth, 0);
  
  // Lọc dữ liệu có giao thoa với tháng target với early returns
  const targetMonthData = [];
  for (let i = 0; i < rawData.length; i++) {
    const record = rawData[i];
    const startDate = parseDate(record.ngayBatDau);
    const endDate = parseDate(record.ngayKetThuc);
    
    // Early continue nếu không có ngày hợp lệ
    if (!startDate || !endDate) continue;
    
    // Early continue nếu không giao thoa với target month
    if (startDate > targetMonthEnd || endDate < targetMonthStart) continue;
    
    targetMonthData.push(record);
  }
  
  // Early return nếu không có dữ liệu trong tháng target
  if (targetMonthData.length === 0) {
    return {
      companySchedules: {},
      dailyTotals: {},
      companyStatus: {},
      companyTotals: {},
      companyEmployees: {},
      companyDetails: {},
      employees: []
    };
  }

  // Xử lý từng record
  targetMonthData.forEach(record => {
    const startDate = parseDate(record.ngayBatDau);
    const endDate = parseDate(record.ngayKetThuc);
    const soNguoiKham = parseInt(record.soNguoiKham) || 0;
    let tongSoNgayKham = parseInt(record.tongSoNgayKham) || 1;
    const companyName = record.tenCongTy.trim();
    const trangThaiKham = record.trangThaiKham || 'Chưa khám xong';
    let sang = parseInt(record.sang) || 0;
    let chieu = parseInt(record.chieu) || 0;
    
    if (!startDate || !endDate || soNguoiKham === 0) return;
    
    // 🔧 FIX: Xử lý đặc biệt cho công ty 'Đã khám xong' có dữ liệu trống
    const isCompletedCompany = (trangThaiKham || '').toLowerCase().trim() === 'đã khám xong' || 
                              (trangThaiKham || '').toLowerCase().trim() === 'da kham xong';
    
    if (isCompletedCompany) {
      // Tính số ngày làm việc thực tế từ ngày bắt đầu đến ngày kết thúc (loại trừ chủ nhật)
      const workingDays = adjustForWorkingDays(startDate, endDate, 999); // 999 để lấy tất cả ngày
      const workingDaysInTargetMonth = workingDays.filter(day => 
        day.getMonth() + 1 === targetMonth && day.getFullYear() === targetYear
      );
      
      if (workingDaysInTargetMonth.length > 0) {
        // Nếu tongSoNgayKham = 0 hoặc trống, tính lại dựa trên ngày làm việc
        if (tongSoNgayKham === 0) {
          tongSoNgayKham = workingDaysInTargetMonth.length;
        }
        
        // Nếu sang và chieu = 0 hoặc trống, tính lại dựa trên tổng số người
        if (sang === 0 && chieu === 0 && soNguoiKham > 0) {
          // Phân bổ đều số người khám cho ca sáng và chiều
          // Giả sử 60% sáng, 40% chiều nếu không có dữ liệu cụ thể
          const totalDaysForCalculation = tongSoNgayKham > 0 ? tongSoNgayKham : workingDaysInTargetMonth.length;
          sang = Math.ceil(soNguoiKham * 0.6 / totalDaysForCalculation);
          chieu = Math.ceil(soNguoiKham * 0.4 / totalDaysForCalculation);
        }
        
        console.log(`🔧 Tính toán cho công ty đã khám xong '${companyName}': ${tongSoNgayKham} ngày, ${sang} sáng/ngày, ${chieu} chiều/ngày, tổng ${soNguoiKham} người`);
      }
    }
    
    // Thu thập nhân viên và map với công ty - tối ưu với Map
    if (record.tenNhanVien) {
      const employeeName = record.tenNhanVien.trim();
      employees.add(employeeName);
      if (!companyEmployees.has(companyName)) {
        companyEmployees.set(companyName, employeeName);
      }
    }
    
    // Lưu trạng thái công ty và thông tin sáng/chiều - tối ưu với Map
    companyStatus.set(companyName, trangThaiKham);
    
    // Cập nhật thông tin sáng/chiều và cận lâm sàng - tối ưu với Map
    if (!companyDetails.has(companyName)) {
      companyDetails.set(companyName, {
        sang: 0,
        chieu: 0,
        tongNguoi: 0,
        tongSoNgay: 0,
        employee: record.tenNhanVien ? record.tenNhanVien.trim() : '',
        ngayBatDau: formatDate(record.ngayBatDau),
        ngayKetThuc: formatDate(record.ngayKetThuc),
        ngayKham: formatDate(record.ngayBatDau), // Thêm trường ngayKham
        cacNgayKhamThucTe: record.cacNgayKhamThucTe || '', // Thêm trường cacNgayKhamThucTe
        ngayLayMau: record.ngayLayMau || '', // Thêm trường ngayLayMau
        trangThai: trangThaiKham, // Thêm trường trạng thái
        gold: record.gold || '', // Thêm trường gold
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
        sieuAmDauDoAmDaoSang: 0,
        doLoangXuongSang: 0,
        // Cận lâm sàng - Chiều
        sieuAmBungChieu: 0,
        khamPhuKhoaChieu: 0,
        xQuangChieu: 0,
        dienTamDoChieu: 0,
        sieuAmVuChieu: 0,
        sieuAmGiapChieu: 0,
        sieuAmTimChieu: 0,
        sieuAmDongMachCanhChieu: 0,
        sieuAmDanHoiMoGanChieu: 0,
        sieuAmDauDoAmDaoChieu: 0,
        doLoangXuongChieu: 0
      });
    }
    
    // Tối ưu: Get reference một lần để tránh multiple Map lookups
    const companyDetail = companyDetails.get(companyName);
    companyDetail.sang += sang;
    companyDetail.chieu += chieu;
    companyDetail.tongNguoi += soNguoiKham;
    // Tạm thời sử dụng tongSoNgayKham, sẽ cập nhật lại sau khi tính actualWorkingDaysInMonth
    companyDetail.tongSoNgay = Math.max(companyDetail.tongSoNgay, tongSoNgayKham);
    companyDetail.trangThai = trangThaiKham; // Cập nhật trạng thái mới nhất
    
    // Cập nhật dữ liệu cận lâm sàng
    const clinicalFields = [
      'sieuAmBungSang', 'khamPhuKhoaSang', 'xQuangSang', 'dienTamDoSang',
      'sieuAmVuSang', 'sieuAmGiapSang', 'sieuAmTimSang', 'sieuAmDongMachCanhSang', 'sieuAmDanHoiMoGanSang',
      'sieuAmDauDoAmDaoSang', 'doLoangXuongSang',
      'sieuAmBungChieu', 'khamPhuKhoaChieu', 'xQuangChieu', 'dienTamDoChieu',
      'sieuAmVuChieu', 'sieuAmGiapChieu', 'sieuAmTimChieu', 'sieuAmDongMachCanhChieu', 'sieuAmDanHoiMoGanChieu',
      'sieuAmDauDoAmDaoChieu', 'doLoangXuongChieu'
    ];
    
    // Tối ưu: Batch update clinical fields
    for (let i = 0; i < clinicalFields.length; i++) {
      const field = clinicalFields[i];
      if (record[field] !== undefined) {
        companyDetail[field] += record[field];
      }
    }
    
    if (!companyDetail.employee && record.tenNhanVien) {
      companyDetail.employee = record.tenNhanVien.trim();
    }
    
    // Cập nhật cacNgayKhamThucTe nếu có dữ liệu mới
    if (record.cacNgayKhamThucTe && record.cacNgayKhamThucTe.trim() !== '') {
      companyDetail.cacNgayKhamThucTe = record.cacNgayKhamThucTe;
    }
    
    // Cập nhật ngayLayMau nếu có dữ liệu mới
    if (record.ngayLayMau && typeof record.ngayLayMau === 'string' && record.ngayLayMau.trim() !== '') {
      companyDetail.ngayLayMau = record.ngayLayMau;
    }
    
    // Cập nhật thông tin gold nếu có dữ liệu mới
    if (record.gold && record.gold.trim() !== '') {
      companyDetail.gold = record.gold;
    }
    
    if (!companySchedules.has(companyName)) {
      companySchedules.set(companyName, {});
      companyTotals.set(companyName, 0);
    }
    
    // 🔧 FIX: Cross-month logic - chỉ tính ngày trong target month
    const targetMonthStart = new Date(targetYear, targetMonth - 1, 1);
    const targetMonthEnd = new Date(targetYear, targetMonth, 0);
    
    // 🆕 NEW: Ưu tiên sử dụng ngày khám thực tế nếu có dữ liệu
    let actualWorkingDaysInMonth = [];
    
    if (record.cacNgayKhamThucTe && record.cacNgayKhamThucTe.trim() !== '') {
      // Sử dụng ngày khám thực tế từ cột 'cac ngay kham thuc te'
      actualWorkingDaysInMonth = parseActualExamDates(record.cacNgayKhamThucTe, targetYear, targetMonth);
      console.log(`📅 Sử dụng ngày khám thực tế cho ${companyName}: ${record.cacNgayKhamThucTe} -> ${actualWorkingDaysInMonth.length} ngày`);
    } else {
      // Logic cũ: Cắt ngày bắt đầu và kết thúc theo target month
      const effectiveStartDate = startDate < targetMonthStart ? targetMonthStart : startDate;
      const effectiveEndDate = endDate > targetMonthEnd ? targetMonthEnd : endDate;
      
      // Điều chỉnh lịch để tránh chủ nhật - chỉ trong target month
      const workingDays = adjustForWorkingDays(effectiveStartDate, effectiveEndDate, tongSoNgayKham);
      actualWorkingDaysInMonth = workingDays.filter(day => 
        day >= targetMonthStart && day <= targetMonthEnd
      );
      console.log(`📅 Sử dụng logic cũ cho ${companyName}: ${actualWorkingDaysInMonth.length} ngày từ ${formatDate(effectiveStartDate)} đến ${formatDate(effectiveEndDate)}`);
    }
    
    if (actualWorkingDaysInMonth.length === 0) return;
    
    // Cập nhật tongSoNgay với số ngày khám thực tế trong target month
    const actualDaysInTargetMonth = actualWorkingDaysInMonth.filter(workDate => 
      workDate.getMonth() + 1 === targetMonth && workDate.getFullYear() === targetYear
    );
    companyDetail.tongSoNgay = Math.max(companyDetail.tongSoNgay, actualDaysInTargetMonth.length);
    
    // 🔧 FIX: Logic ĐÚNG - hiển thị tổng số người khám trong cả giai đoạn, không phải mỗi ngày
    let totalPeopleForPeriod = 0;
    
    if (shiftFilter === 'morning' || shiftFilter === 'sang') {
      // Tổng số người sáng trong cả giai đoạn = số người sáng mỗi ngày × số ngày khám trong tháng
      totalPeopleForPeriod = sang * actualWorkingDaysInMonth.length;
      console.log(` Sáng - Company: ${companyName}, Per day: ${sang}, Days: ${actualWorkingDaysInMonth.length}, Total: ${totalPeopleForPeriod}`);
    } else if (shiftFilter === 'afternoon' || shiftFilter === 'chieu') {
      // Tổng số người chiều trong cả giai đoạn = số người chiều mỗi ngày × số ngày khám trong tháng
      totalPeopleForPeriod = chieu * actualWorkingDaysInMonth.length;
      console.log(` Chiều - Company: ${companyName}, Per day: ${chieu}, Days: ${actualWorkingDaysInMonth.length}, Total: ${totalPeopleForPeriod}`);
    } else {
      // Tổng: Hiển thị tổng số người khám trong cả giai đoạn (không phải mỗi ngày)
      // Tính số người khám trong tháng target dựa trên tỷ lệ ngày khám
      const ratioInTargetMonth = actualWorkingDaysInMonth.length / tongSoNgayKham;
      totalPeopleForPeriod = Math.ceil(soNguoiKham * ratioInTargetMonth);
      console.log(`📊 Tổng - Company: ${companyName}, Total people: ${soNguoiKham}, Days in month: ${actualWorkingDaysInMonth.length}, Total days: ${tongSoNgayKham}, Period total: ${totalPeopleForPeriod}`);
    }
    
    // Kiểm tra trạng thái công ty để xử lý logic hiển thị
    const companyStatusValue = companyStatus.get(companyName) || '';
    const isCompleted = companyStatusValue.toLowerCase().trim() === 'đã khám xong' || companyStatusValue.toLowerCase().trim() === 'da kham xong';
    
    // Phân bổ số người khám cho các ngày
    if (isCompleted) {
      // Công ty đã khám xong: phân bổ số người thực tế cho từng ngày khám cụ thể
      // sang và chieu là tổng số người cho cả giai đoạn, cần chia cho số ngày khám thực tế
      const actualDaysInTargetMonth = actualWorkingDaysInMonth.filter(workDate => 
        workDate.getMonth() + 1 === targetMonth && workDate.getFullYear() === targetYear
      );
      
      if (actualDaysInTargetMonth.length > 0) {
        // Tính số người cho mỗi ngày dựa trên tổng số người và số ngày khám thực tế
        let peoplePerDayMorning = actualDaysInTargetMonth.length > 0 ? Math.ceil(sang / actualDaysInTargetMonth.length) : 0;
        let peoplePerDayAfternoon = actualDaysInTargetMonth.length > 0 ? Math.ceil(chieu / actualDaysInTargetMonth.length) : 0;
        
        actualDaysInTargetMonth.forEach(workDate => {
          const dateKey = formatDateKey(workDate);
          let peopleForThisDay = 0;
          
          if (shiftFilter === 'morning' || shiftFilter === 'sang') {
            peopleForThisDay = peoplePerDayMorning; // Số người sáng cho ngày này
          } else if (shiftFilter === 'afternoon' || shiftFilter === 'chieu') {
            peopleForThisDay = peoplePerDayAfternoon; // Số người chiều cho ngày này
          } else {
            peopleForThisDay = peoplePerDayMorning + peoplePerDayAfternoon; // Tổng số người cho ngày này
          }
          
          const companyData = companySchedules.get(companyName) || {};
          companyData[dateKey] = (companyData[dateKey] || 0) + peopleForThisDay;
          companySchedules.set(companyName, companyData);
          
          dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + peopleForThisDay;
        });
      }
    } else {
      // Công ty chưa khám xong: phân bổ đều cho tất cả các ngày trong target month
      const peoplePerDay = actualWorkingDaysInMonth.length > 0 ? Math.ceil(totalPeopleForPeriod / actualWorkingDaysInMonth.length) : 0;
      
      actualWorkingDaysInMonth.forEach(workDate => {
        const dateKey = formatDateKey(workDate);
        
        // Đảm bảo ngày thuộc target month
        if (workDate.getMonth() + 1 === targetMonth && workDate.getFullYear() === targetYear) {
          const companyData = companySchedules.get(companyName) || {};
          companyData[dateKey] = (companyData[dateKey] || 0) + peoplePerDay;
          companySchedules.set(companyName, companyData);
          
          dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + peoplePerDay;
        }
      });
    }
    
    // Cập nhật tổng công ty với tổng số người trong cả giai đoạn
    let actualTotalForPeriod = totalPeopleForPeriod;
    
    if (isCompleted) {
      // Đối với công ty đã khám xong, tính tổng dựa trên số người thực tế trong target month
      const actualDaysInTargetMonth = actualWorkingDaysInMonth.filter(workDate => 
        workDate.getMonth() + 1 === targetMonth && workDate.getFullYear() === targetYear
      );
      
      if (shiftFilter === 'morning' || shiftFilter === 'sang') {
        actualTotalForPeriod = sang; // Tổng số người sáng trong target month
      } else if (shiftFilter === 'afternoon' || shiftFilter === 'chieu') {
        actualTotalForPeriod = chieu; // Tổng số người chiều trong target month
      } else {
        actualTotalForPeriod = sang + chieu; // Tổng số người trong target month
      }
    }
    
    const currentTotal = companyTotals.get(companyName) || 0;
    companyTotals.set(companyName, currentTotal + actualTotalForPeriod);
  });
  
  // Convert Maps back to Objects for compatibility
  let companySchedulesObj = Object.fromEntries(companySchedules);
  let companyTotalsObj = Object.fromEntries(companyTotals);
  let companyDetailsObj = Object.fromEntries(companyDetails);
  const companyEmployeesObj = Object.fromEntries(companyEmployees);
  const companyStatusObj = Object.fromEntries(companyStatus);
  
  // Tính thống kê trạng thái
  const statusCounts = { completed: 0, pending: 0 };
  companyStatus.forEach(status => {
    const statusLower = status.toLowerCase().trim();
    if (statusLower === 'đã khám xong' || statusLower === 'da kham xong') {
      statusCounts.completed++;
    } else {
      statusCounts.pending++;
    }
  });
  
  // Không loại bỏ công ty đã khám xong khỏi timeline
  // Tất cả công ty sẽ được hiển thị để đảm bảo tính toán tổng và biểu đồ chính xác

  // Áp dụng time filter (ngày, tuần, tháng)
  const filteredCompanySchedules = applyTimeFilter(companySchedulesObj, timeFilter);

  const timeline = createTimelineData(filteredCompanySchedules, dailyTotals, companyTotalsObj, targetMonth, targetYear, companyEmployeesObj, companyDetailsObj);

  // Tính lại statistics dựa trên filtered data
  const filteredStats = calculateFilteredStats(timeline, shiftFilter);
  
  // Tính lại statusCounts dựa trên filtered companies để tránh số âm
  const filteredStatusCounts = { completed: 0, pending: 0 };
  Object.keys(filteredCompanySchedules).forEach(companyName => {
    const status = companyStatusObj[companyName] || '';
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
    companyDetails: companyDetailsObj,
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
function createTimelineData(companySchedules, dailyTotals, companyTotals, month, year, companyEmployees, companyDetails = {}) {
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
  
  // Sắp xếp công ty: 'Chưa khám xong' trước, 'Đã khám xong' sau, cả hai nhóm sắp xếp theo số người giảm dần
  const sortedCompanies = Object.keys(companySchedules).sort((a, b) => {
    const detailA = companyDetails[a] || {};
    const detailB = companyDetails[b] || {};
    const statusA = (detailA.trangThai || '').toLowerCase().trim();
    const statusB = (detailB.trangThai || '').toLowerCase().trim();
    
    const isCompletedA = statusA === 'đã khám xong' || statusA === 'da kham xong';
    const isCompletedB = statusB === 'đã khám xong' || statusB === 'da kham xong';
    
    // Nếu một bên đã khám xong, một bên chưa khám xong
    if (isCompletedA !== isCompletedB) {
      return isCompletedA ? 1 : -1; // Chưa khám xong (false) lên trước
    }
    
    // Cùng trạng thái thì sắp xếp theo số người giảm dần
    return (companyTotals[b] || 0) - (companyTotals[a] || 0);
  });
  
  sortedCompanies.forEach(companyName => {
    const companyDetail = companyDetails[companyName] || {};
    const row = {
      company: companyName,
      employee: companyEmployees[companyName] || '',
      data: [],
      total: companyTotals[companyName] || 0,
      ngayLayMau: companyDetail.ngayLayMau || '',
      ngayBatDau: companyDetail.ngayBatDau || '',
      ngayKetThuc: companyDetail.ngayKetThuc || '',
      trangThai: companyDetail.trangThai || 'Chưa khám xong'
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
  
  // Tối ưu: Sử dụng Set để tìm kiếm nhanh hơn
  let targetDatesSet;
  
  if (timeFilter === 'today') {
    targetDatesSet = new Set([currentDateKey]);
  } else if (timeFilter === 'week') {
    // Tính ngày đầu tuần (chủ nhật)
    const currentDay = today.getDay(); // 0 = CN, 1 = T2, ...
    const daysSinceSunday = currentDay; // Số ngày từ chủ nhật đến hôm nay
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - daysSinceSunday);
    
    // Tạo Set các ngày trong tuần hiện tại (từ chủ nhật đến thứ 7)
    targetDatesSet = new Set();
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      targetDatesSet.add(formatDateKey(date));
    }
  } else if (timeFilter === 'month') {
    // Tính ngày đầu tháng và cuối tháng hiện tại
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    // Tạo Set các ngày trong tháng hiện tại
    targetDatesSet = new Set();
    const tempDate = new Date(firstDayOfMonth);
    while (tempDate <= lastDayOfMonth) {
      targetDatesSet.add(formatDateKey(tempDate));
      tempDate.setDate(tempDate.getDate() + 1);
    }
  }
  
  const filteredSchedules = {};
  
  // Lọc theo ngày, tuần hoặc tháng với tối ưu hóa
  Object.keys(companySchedules).forEach(companyName => {
    const companyData = companySchedules[companyName];
    
    // Tối ưu: Kiểm tra intersection giữa company dates và target dates
    const hasAppointmentInTimeFilter = Object.keys(companyData).some(dateKey => {
      return targetDatesSet.has(dateKey) && companyData[dateKey] > 0;
    });
    
    // Nếu có lịch khám trong khoảng thời gian được lọc, thêm vào kết quả
    if (hasAppointmentInTimeFilter) {
      filteredSchedules[companyName] = companyData;
    }
  });
  
  console.log(`Lọc theo ${timeFilter}: Từ ${Object.keys(companySchedules).length} công ty còn ${Object.keys(filteredSchedules).length} công ty`);
  
  return filteredSchedules;
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
            // Format yyyy-mm-dd
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          } else {
            // Format mm/dd/yyyy hoặc mm-dd-yyyy (định dạng Google Sheets)
            const part1 = parseInt(match[1]);
            const part2 = parseInt(match[2]);
            year = parseInt(match[3]);
            
            // Coi part1 là tháng, part2 là ngày (định dạng mm/dd/yyyy)
            month = part1;
            day = part2;
            
            // Kiểm tra tính hợp lệ
            if (day > 31 || month > 12 || day < 1 || month < 1) {
              continue; // Bỏ qua format này nếu không hợp lệ
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
 * Định dạng ngày tháng theo mm/dd/yyyy (Google Sheets format)
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  // Kiểm tra nếu dateString đã là định dạng mm/dd/yyyy
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
    
    return `${month}/${day}/${year}`;
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
 * Lấy dữ liệu cận lâm sàng cho bảng hiển thị theo ngày
 */
function getClinicalData(month = null, year = null, searchCompany = '', filterEmployee = '', shiftFilter = 'total', timeFilter = 'all', showGold = false) {
  try {
    // Lấy dữ liệu với tham số showGold được truyền vào
    const scheduleData = getScheduleData(month, year, searchCompany, filterEmployee, shiftFilter, timeFilter, showGold);
    
    if (!scheduleData.success) {
      return scheduleData;
    }
    
    const clinicalData = [];
    const companyDetails = scheduleData.companyDetails || {};
    
    // Định nghĩa thứ tự cột theo yêu cầu (bỏ tổng siêu âm sáng và chiều)
    const clinicalColumns = [
      { key: 'khamPhuKhoaSang', label: 'Khám phụ khoa', shift: 'morning' },
      { key: 'xQuangSang', label: 'X-quang', shift: 'morning' },
      { key: 'dienTamDoSang', label: 'Điện tâm đồ', shift: 'morning' },
      { key: 'sieuAmBungSang', label: 'Siêu âm bụng', shift: 'morning' },
      { key: 'sieuAmVuSang', label: 'Siêu âm vú', shift: 'morning' },
      { key: 'sieuAmGiapSang', label: 'Siêu âm giáp', shift: 'morning' },
      { key: 'sieuAmTimSang', label: 'Siêu âm tim', shift: 'morning' },
      { key: 'sieuAmDongMachCanhSang', label: 'Siêu âm động mạch cảnh', shift: 'morning' },
      { key: 'sieuAmDanHoiMoGanSang', label: 'Siêu âm đàn hồi mô gan', shift: 'morning' },
      { key: 'sieuAmDauDoAmDaoSang', label: 'Siêu âm đầu dò âm đạo', shift: 'morning' },
      { key: 'doLoangXuongSang', label: 'Đo loãng xương', shift: 'morning' },
      { key: 'khamPhuKhoaChieu', label: 'Khám phụ khoa', shift: 'afternoon' },
      { key: 'xQuangChieu', label: 'X-quang', shift: 'afternoon' },
      { key: 'dienTamDoChieu', label: 'Điện tâm đồ', shift: 'afternoon' },
      { key: 'sieuAmBungChieu', label: 'Siêu âm bụng', shift: 'afternoon' },
      { key: 'sieuAmVuChieu', label: 'Siêu âm vú', shift: 'afternoon' },
      { key: 'sieuAmGiapChieu', label: 'Siêu âm giáp', shift: 'afternoon' },
      { key: 'sieuAmTimChieu', label: 'Siêu âm tim', shift: 'afternoon' },
      { key: 'sieuAmDongMachCanhChieu', label: 'Siêu âm động mạch cảnh', shift: 'afternoon' },
      { key: 'sieuAmDanHoiMoGanChieu', label: 'Siêu âm đàn hồi mô gan', shift: 'afternoon' },
      { key: 'sieuAmDauDoAmDaoChieu', label: 'Siêu âm đầu dò âm đạo', shift: 'afternoon' },
      { key: 'doLoangXuongChieu', label: 'Đo loãng xương', shift: 'afternoon' }
    ];
    
    // Tạo dữ liệu theo ngày thay vì theo công ty
    const currentMonth = month || (new Date().getMonth() + 1);
    const currentYear = year || new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // Tối ưu: Sử dụng Map để lưu dữ liệu theo ngày
    const dailyClinicalData = new Map();
    
    // Tạo template object cho việc khởi tạo nhanh
    const createEmptyDayData = (dateKey, dateDisplay) => ({
      date: dateDisplay,
      dateKey: dateKey,
      hasCompanies: false, // Theo dõi xem có công ty nào khám trong ngày này không
      // Khởi tạo tất cả các cột với giá trị 0
      khamPhuKhoaSang: 0,
      xQuangSang: 0,
      dienTamDoSang: 0,
      sieuAmBungSang: 0,
      sieuAmVuSang: 0,
      sieuAmGiapSang: 0,
      sieuAmTimSang: 0,
      sieuAmDongMachCanhSang: 0,
      sieuAmDanHoiMoGanSang: 0,
      sieuAmDauDoAmDaoSang: 0,
      doLoangXuongSang: 0,
      khamPhuKhoaChieu: 0,
      xQuangChieu: 0,
      dienTamDoChieu: 0,
      sieuAmBungChieu: 0,
      sieuAmVuChieu: 0,
      sieuAmGiapChieu: 0,
      sieuAmTimChieu: 0,
      sieuAmDongMachCanhChieu: 0,
      sieuAmDanHoiMoGanChieu: 0,
      sieuAmDauDoAmDaoChieu: 0,
      doLoangXuongChieu: 0
    });
    
    // Khởi tạo dữ liệu cho tất cả các ngày trong tháng (trừ Chủ nhật)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dateDisplay = `${day.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}/${currentYear}`;
      
      // Kiểm tra xem ngày này có phải Chủ nhật không
      const dateObj = new Date(currentYear, currentMonth - 1, day);
      if (isSunday(dateObj)) {
        continue; // Bỏ qua Chủ nhật
      }
      
      dailyClinicalData.set(dateKey, createEmptyDayData(dateKey, dateDisplay));
    }
    
    // Tối ưu: Tổng hợp dữ liệu từ các công ty theo khoảng thời gian khám
    // Nếu có searchCompany, chỉ lấy dữ liệu từ công ty đó
    const searchLower = searchCompany ? searchCompany.toLowerCase().trim() : '';
    
    Object.keys(companyDetails).forEach(companyName => {
      // Tối ưu: Early return cho search filter
      if (searchLower && !companyName.toLowerCase().includes(searchLower)) {
        return; // Bỏ qua công ty này nếu không khớp với tìm kiếm
      }
      
      const details = companyDetails[companyName];
      
      // Ưu tiên sử dụng cột 'cacNgayKhamThucTe' nếu có dữ liệu
      let actualWorkingDaysInMonth = [];
      
      if (details.cacNgayKhamThucTe && details.cacNgayKhamThucTe.trim() !== '') {
        // Sử dụng ngày khám thực tế từ cột 'cacNgayKhamThucTe'
        actualWorkingDaysInMonth = parseActualExamDates(details.cacNgayKhamThucTe, currentYear, currentMonth);
      } else {
        // Fallback: sử dụng logic cũ với ngayBatDau và ngayKetThuc
        const ngayBatDau = details.ngayBatDau;
        const ngayKetThuc = details.ngayKetThuc;
        
        if (ngayBatDau && ngayKetThuc) {
          const startDate = parseDate(ngayBatDau);
          const endDate = parseDate(ngayKetThuc);
          
          if (startDate && endDate) {
            actualWorkingDaysInMonth = adjustForWorkingDays(startDate, endDate, currentMonth, currentYear);
          }
        }
      }
      
      // Tối ưu: Cộng dồn số liệu của công ty vào các ngày khám thực tế
      actualWorkingDaysInMonth.forEach(workingDay => {
        const dateKey = formatDateKey(workingDay);
        const dayData = dailyClinicalData.get(dateKey);
        
        if (dayData) {
          // Đánh dấu có công ty khám trong ngày này
          dayData.hasCompanies = true;
          // Cộng dồn số liệu của công ty vào ngày khám này
          clinicalColumns.forEach(col => {
            dayData[col.key] += details[col.key] || 0;
          });
        }
      });
    });
    
    // Tối ưu: Chuyển đổi Map thành array và tính Max cho mỗi ngày
    dailyClinicalData.forEach((dayData, dateKey) => {
      // Tính giá trị Max của tất cả các hạng mục khám trong ngày
      const maxValue = Math.max(
        ...clinicalColumns.map(col => dayData[col.key] || 0)
      );
      
      // FIX: Sử dụng hasCompanies để quyết định có hiển thị nút hay không
      // Nếu có công ty khám trong ngày này, max sẽ là maxValue hoặc ít nhất là 1
      const effectiveMax = dayData.hasCompanies ? Math.max(maxValue, 1) : maxValue;
      
      const clinicalRow = {
        date: dayData.date,
        dateKey: dateKey,
        max: effectiveMax, // Sử dụng effectiveMax thay vì maxValue
        // Các cột cận lâm sàng
        khamPhuKhoaSang: dayData.khamPhuKhoaSang,
        xQuangSang: dayData.xQuangSang,
        dienTamDoSang: dayData.dienTamDoSang,
        sieuAmBungSang: dayData.sieuAmBungSang,
        sieuAmVuSang: dayData.sieuAmVuSang,
        sieuAmGiapSang: dayData.sieuAmGiapSang,
        sieuAmTimSang: dayData.sieuAmTimSang,
        sieuAmDongMachCanhSang: dayData.sieuAmDongMachCanhSang,
        sieuAmDanHoiMoGanSang: dayData.sieuAmDanHoiMoGanSang,
        sieuAmDauDoAmDaoSang: dayData.sieuAmDauDoAmDaoSang,
        doLoangXuongSang: dayData.doLoangXuongSang,
        khamPhuKhoaChieu: dayData.khamPhuKhoaChieu,
        xQuangChieu: dayData.xQuangChieu,
        dienTamDoChieu: dayData.dienTamDoChieu,
        sieuAmBungChieu: dayData.sieuAmBungChieu,
        sieuAmVuChieu: dayData.sieuAmVuChieu,
        sieuAmGiapChieu: dayData.sieuAmGiapChieu,
        sieuAmTimChieu: dayData.sieuAmTimChieu,
        sieuAmDongMachCanhChieu: dayData.sieuAmDongMachCanhChieu,
        sieuAmDanHoiMoGanChieu: dayData.sieuAmDanHoiMoGanChieu,
        sieuAmDauDoAmDaoChieu: dayData.sieuAmDauDoAmDaoChieu,
        doLoangXuongChieu: dayData.doLoangXuongChieu
      };
      
      // Hiển thị tất cả ngày trong tháng, không chỉ những ngày có dữ liệu
      clinicalData.push(clinicalRow);
    });
    
    // Sắp xếp theo ngày tăng dần
    clinicalData.sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey));
    
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