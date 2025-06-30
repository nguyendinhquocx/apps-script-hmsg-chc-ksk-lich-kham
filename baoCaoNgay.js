/**
 * Gửi email báo cáo tổng hợp ngày với tuần thống kê đặc biệt cho Chủ nhật.
 * Thứ 2-7: Giao diện đơn giản như hiện tại
 * Chủ nhật: Weekly Performance Dashboard đơn giản hóa
 * 
 * FIXED: Mobile responsive cho Performance Heatmap
 * FIXED: Simplified text cho Individual Dashboard
 * FIXED: Tuân thủ design system đen/trắng tối giản
 */
function sendDailyReportSummary() {
  const CONFIG = {
    sheetName: 'check bc',

    emailTo: 'luan.tran@hoanmy.com, khanh.tran@hoanmy.com, hong.le@hoanmy.com, quynh.bui@hoanmy.com, thuy.pham@hoanmy.com, anh.ngo@hoanmy.com, truc.nguyen3@hoanmy.com, trang.nguyen9@hoanmy.com, tram.mai@hoanmy.com, vuong.duong@hoanmy.com, phi.tran@hoanmy.com, quoc.nguyen3@hoanmy.com',

    // emailTo: 'quoc.nguyen3@hoanmy.com',

    dateHeaderRanges: ['e3:n3', 'e17:n17', 'e30:o30'],
    dataRanges: ['B4:n12', 'B18:n26', 'B31:o39'],
    
    // ICON mặc định (đen/xám)
    starIconDefault: 'https://cdn-icons-png.flaticon.com/128/2956/2956792.png',
    calendarIconDefault: 'https://cdn-icons-png.flaticon.com/128/3239/3239948.png',
    completedIconDefault: 'https://cdn-icons-png.flaticon.com/128/7046/7046053.png',
    pendingIconDefault: 'https://cdn-icons-png.flaticon.com/128/17694/17694317.png',
    
    // ICON màu xanh khi perfect day
    starIconPerfect: 'https://cdn-icons-png.flaticon.com/128/18245/18245248.png',
    calendarIconPerfect: 'https://cdn-icons-png.flaticon.com/128/15881/15881446.png',
    completedIconPerfect: 'https://cdn-icons-png.flaticon.com/128/10995/10995390.png',
    pendingIconPerfect: 'https://cdn-icons-png.flaticon.com/128/17694/17694222.png',
    
    // Achievement icons
    celebrationIcon: 'https://cdn-icons-png.flaticon.com/128/9422/9422222.png'
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.sheetName);
    
    if (!sheet) {
      Logger.log(`❌ Sheet '${CONFIG.sheetName}' không tồn tại`);
      return;
    }

    const today = new Date();
    const todayStr = Utilities.formatDate(today, ss.getSpreadsheetTimeZone(), "M/d/yyyy");
    const isWeekend = today.getDay() === 0; // Chủ nhật

    // Định dạng ngày chi tiết với thứ
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const dayOfWeek = dayNames[today.getDay()];
    const detailedDate = `${dayOfWeek}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    // Tìm vị trí cột ngày hôm nay trong các vùng header
    let dateColumnIndex = null, dataRange = null, values = null;
    for (let i = 0; i < CONFIG.dateHeaderRanges.length; i++) {
      try {
        const headerRange = sheet.getRange(CONFIG.dateHeaderRanges[i]);
        const headerValues = headerRange.getValues()[0];
        for (let j = 0; j < headerValues.length; j++) {
          const cell = headerValues[j];
          if (cell instanceof Date) {
            const dateStr = Utilities.formatDate(cell, ss.getSpreadsheetTimeZone(), "M/d/yyyy");
            if (dateStr === todayStr) {
              dateColumnIndex = headerRange.getColumn() + j;
              dataRange = sheet.getRange(CONFIG.dataRanges[i]);
              values = dataRange.getValues();
              break;
            }
          }
        }
        if (dateColumnIndex !== null) break;
      } catch (error) {
        Logger.log(`⚠️ Lỗi khi đọc range ${CONFIG.dateHeaderRanges[i]}: ${error.message}`);
        continue;
      }
    }
    
    if (!values) {
      Logger.log("❌ Không tìm thấy cột ngày hôm nay trong bất kỳ vùng tiêu đề nào.");
      return;
    }

    // Lấy danh sách đã báo cáo và chưa báo cáo
    let reported = [], notReported = [];
    for (let row of values) {
      const maNV = row[0];
      const tenNV = row[2];
      const reportMark = row[dateColumnIndex - dataRange.getColumn()];
      if (maNV && tenNV) {
        if (reportMark === 'X') {
          reported.push(tenNV);
        } else {
          notReported.push(tenNV);
        }
      }
    }

    // Kiểm tra perfect day và tính totals
    const totalEmployees = reported.length + notReported.length;
    const isPerfectDay = notReported.length === 0 && reported.length > 0;
    const subject = isWeekend ? 
      `HMSG | P.KD - THỐNG KÊ TUẦN & BÁO CÁO ${todayStr}` :
      `HMSG | P.KD - TỔNG HỢP BÁO CÁO NGÀY ${todayStr}`;

    // Chọn icons theo trạng thái
    const calendarIcon = isPerfectDay ? CONFIG.calendarIconPerfect : CONFIG.calendarIconDefault;
    const completedIcon = isPerfectDay ? CONFIG.completedIconPerfect : CONFIG.completedIconDefault;
    const pendingIcon = isPerfectDay ? CONFIG.pendingIconPerfect : CONFIG.pendingIconDefault;

    // Color scheme
    const colors = isPerfectDay ? {
      border: '#22c55e',
      headerTitle: '#22c55e',
      headerSubtitle: '#16a34a',
      dateText: '#16a34a',
      sectionTitle: '#22c55e',
      namesList: '#15803d',
      footerName: '#16a34a',
      footerLabel: '#22c55e',
      disclaimerColor: '#16a34a'
    } : {
      border: '#000000',
      headerTitle: '#1a1a1a',
      headerSubtitle: '#8e8e93',
      dateText: '#495057',
      sectionTitle: '#1a1a1a',
      pendingTitle: '#dc3545',
      namesList: '#1a1a1a',
      footerName: '#8e8e93',
      footerLabel: '#1a1a1a',
      disclaimerColor: '#8e8e93'
    };

    // Nếu là Chủ nhật, tạo Weekly Performance Dashboard
    let weeklyDashboard = '';
    if (isWeekend) {
      weeklyDashboard = buildWeeklyDashboard(sheet, ss, CONFIG, colors);
    }

    // Smart Badge Function
    const getPerformanceBadgeStyle = (completed, total) => {
      const rate = completed / total;
      if (rate === 1) return 'background: linear-gradient(135deg, #22c55e, #16a34a); color: white;';
      if (rate >= 0.8) return 'background: linear-gradient(135deg, #84cc16, #65a30d); color: white;';
      if (rate >= 0.6) return 'background: linear-gradient(135deg, #eab308, #ca8a04); color: white;';
      return 'background: linear-gradient(135deg, #ef4444, #dc2626); color: white;';
    };

    // Progressive Star Color Function
    const getStarColor = (starCount, totalPossible) => {
      const ratio = starCount / totalPossible;
      if (ratio >= 0.9) return '#22c55e'; // Xanh đậm - Xuất sắc
      if (ratio >= 0.7) return '#84cc16'; // Xanh lime - Tốt  
      if (ratio >= 0.5) return '#eab308'; // Vàng - Trung bình
      return '#94a3b8'; // Xám - Cần cải thiện
    };

    // Tính số ngày làm việc tuần này
    const workDaysThisWeek = isWeekend ? 6 : today.getDay();

    // Build employee lists (chỉ hiển thị nếu không phải weekly dashboard)
    let reportedHtml = '', notReportedHtml = '';
    
    if (!isWeekend) {
      // Danh sách đã báo cáo
      if (reported.length > 0) {
        const reportedWithStars = reported.map(name => ({ 
          name, 
          stars: getWeeklyStars(sheet, name, ss, CONFIG) 
        }));
        reportedWithStars.sort((a, b) => b.stars - a.stars);
        
        reportedHtml = reportedWithStars.map(person => {
          const starColor = getStarColor(person.stars, workDaysThisWeek);
          const starsDisplay = person.stars > 0
            ? `<span style="color: ${starColor}; font-size: 16px;">★</span>`.repeat(person.stars)
            : '';
          
          return `
            <div style="padding: 16px 0; font-size: 15px; font-weight: 400; color: ${colors.namesList}; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center;">
              <span style="flex: 1;">${person.name}</span>
              ${person.stars > 0 ? `<span style="display: flex; gap: 2px;">${starsDisplay}</span>` : ''}
            </div>
          `;
        }).join('');
      } else {
        reportedHtml = `<div style="padding: 16px 0; font-size: 15px; color: #8e8e93; font-style: italic;">Chưa có báo cáo nào</div>`;
      }

      // Danh sách chưa báo cáo
      if (notReported.length > 0) {
        const notReportedWithStars = notReported.map(name => ({ 
          name, 
          stars: getWeeklyStars(sheet, name, ss, CONFIG) 
        }));
        notReportedWithStars.sort((a, b) => b.stars - a.stars);
        
        notReportedHtml = notReportedWithStars.map(person => {
          const starColor = getStarColor(person.stars, workDaysThisWeek);
          const starsDisplay = person.stars > 0
            ? `<span style="color: ${starColor}; font-size: 16px;">★</span>`.repeat(person.stars)
            : '';
          
          return `
            <div style="padding: 16px 0; font-size: 15px; font-weight: 400; color: ${colors.namesList}; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center;">
              <span style="flex: 1;">${person.name}</span>
              ${person.stars > 0 ? `<span style="display: flex; gap: 2px;">${starsDisplay}</span>` : ''}
            </div>
          `;
        }).join('');
      } else {
        notReportedHtml = `<div style="padding: 16px 0; font-size: 15px; color: ${colors.namesList}; font-style: italic;">
          Tất cả đã báo cáo
          <img src="${CONFIG.celebrationIcon}" width="20" height="20" style="margin-left: 8px;" alt="Celebration">
        </div>`;
      }
    }

    // Daily sections for non-weekend days
    const dailySections = !isWeekend ? `
      <!-- Completed Section -->
      <div style="margin-bottom: 32px; background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 12px; overflow: hidden;">
        <div style="padding: 20px 24px 16px; border-bottom: 1px solid #f5f5f5;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 500; color: ${colors.sectionTitle}; display: flex; align-items: center;">
              <img src="${completedIcon}" width="20" height="20" style="margin-right: 12px;" alt="Completed">
              Đã báo cáo
            </h2>
            <span style="${getPerformanceBadgeStyle(reported.length, totalEmployees)} padding: 6px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; min-width: 60px; text-align: center;">
              ${reported.length}/${totalEmployees} ${reported.length === totalEmployees ? '' : ''}
            </span>
          </div>
        </div>
        <div style="padding: 0 24px 8px;">
          ${reportedHtml}
        </div>
      </div>

      <!-- Pending Section -->
      <div style="margin-bottom: 40px; background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 12px; overflow: hidden;">
        <div style="padding: 20px 24px 16px; border-bottom: 1px solid #f5f5f5;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 500; color: ${isPerfectDay ? colors.sectionTitle : colors.pendingTitle}; display: flex; align-items: center;">
              <img src="${pendingIcon}" width="20" height="20" style="margin-right: 12px;" alt="Pending">
              Chưa báo cáo
            </h2>
            <span style="${getPerformanceBadgeStyle(totalEmployees - notReported.length, totalEmployees)} padding: 6px 12px; border-radius: 12px; font-weight: 600; font-size: 13px; min-width: 60px; text-align: center;">
              ${notReported.length}/${totalEmployees} ${notReported.length === 0 ? '' : ''}
            </span>
          </div>
        </div>
        <div style="padding: 0 24px 8px;">
          ${notReportedHtml}
        </div>
      </div>
    ` : '';

    // HTML Email Template
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isWeekend ? 'Thống kê tuần' : 'Báo cáo ngày'} ${todayStr}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        
        <!-- Main Container -->
        <div style="max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid ${colors.border}; border-radius: 12px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 48px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: ${colors.headerTitle}; letter-spacing: -0.5px;">
              ${isWeekend ? 'Thống kê tuần' : `Báo cáo tổng hợp ${isPerfectDay ? '🎉' : ''}`}
            </h1>
            <p style="margin: 8px 0 0; font-size: 16px; font-weight: 400; color: ${colors.headerSubtitle};">
              Phòng Kinh Doanh HMSG
            </p>
          </div>

          <!-- Date -->
          <div style="margin-bottom: 32px;">
            <span style="font-size: 14px; font-weight: 500; color: ${colors.dateText};">
              <img src="${calendarIcon}" width="16" height="16" style="vertical-align: middle; margin-right: 8px;" alt="Calendar">
              ${detailedDate}
            </span>
          </div>

          <!-- Weekly Dashboard (chỉ Chủ nhật) -->
          ${weeklyDashboard}

          <!-- Daily Sections (Thứ 2-7) -->
          ${dailySections}

          <!-- Footer -->
          <div style="text-align: center; padding-top: 32px; border-top: 1px solid #f5f5f5;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 400; color: ${colors.footerLabel};">
              Trân trọng
            </p>
            <p style="margin: 0; font-size: 12px; font-weight: 500; color: ${colors.footerName};">
              Nguyen Dinh Quoc
            </p>
          </div>

          <!-- Disclaimer -->
          <div style="margin-top: 40px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: ${colors.disclaimerColor}; line-height: 1.4; font-style: italic;">
              ${isWeekend ? 'Báo cáo thống kê tuần tự động' : 'Đây là báo cáo tự động'}. Vui lòng không trả lời email này.<br>
              Liên hệ: quoc.nguyen3@hoanmy.com
            </p>
          </div>

        </div>
        
      </body>
      </html>
    `;

    // Gửi email với retry mechanism
    sendEmailWithRetry({
      to: CONFIG.emailTo,
      subject: subject,
      htmlBody: htmlBody
    });

    Logger.log(`✅ Email báo cáo ${isWeekend ? 'tuần' : 'ngày'} đã được gửi thành công`);

  } catch (error) {
    Logger.log(`❌ Lỗi khi gửi email báo cáo: ${error.message}`);
    Logger.log(`Stack trace: ${error.stack}`);
  }
}

/**
 * FIXED: Gửi email với retry mechanism
 */
function sendEmailWithRetry(emailConfig, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      MailApp.sendEmail(emailConfig);
      Logger.log(`✅ Email sent successfully on attempt ${i + 1}`);
      return true;
    } catch (error) {
      Logger.log(`❌ Email attempt ${i + 1} failed: ${error.message}`);
      if (i === maxRetries - 1) throw error;
      Utilities.sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
  return false;
}

/**
 * Xây dựng Weekly Performance Dashboard cho Chủ nhật (Đơn giản hóa)
 */
function buildWeeklyDashboard(sheet, ss, CONFIG, colors) {
  try {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - 6); // Thứ 2 tuần này
    
    // Lấy tất cả nhân viên và performance tuần
    const allEmployees = getAllEmployeesWeeklyData(sheet, ss, CONFIG, monday);
    
    // Daily Performance Heatmap (FIXED: mobile responsive)
    const heatmap = buildMobileResponsiveHeatmap(allEmployees, monday, ss, CONFIG);
    
    // Individual Performance Dashboard (FIXED: simplified text)
    const leaderboard = buildSimplifiedLeaderboard(allEmployees, CONFIG);
    
    return `
      ${heatmap}
      ${leaderboard}
    `;
  } catch (error) {
    Logger.log(`❌ Lỗi khi tạo Weekly Dashboard: ${error.message}`);
    return `<div style="color: #dc3545; text-align: center; padding: 20px;">Không thể tải thống kê tuần</div>`;
  }
}

/**
 * FIXED: Mobile Responsive Heatmap (không bị tràn trên mobile)
 */
function buildMobileResponsiveHeatmap(employees, monday, ss, CONFIG) {
  const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  let heatmapHtml = '';
  
  // Tính tỷ lệ cho từng ngày để xác định ngày thấp nhất
  const dayRates = [];
  for (let day = 0; day < 6; day++) {
    const dayReports = employees.filter(emp => emp.dailyReports[day]).length;
    const totalEmployees = employees.length;
    const dayRate = dayReports / totalEmployees;
    dayRates.push(dayRate);
  }
  
  // Tìm tỷ lệ thấp nhất
  const minRate = Math.min(...dayRates);
  
  for (let day = 0; day < 6; day++) {
    const dayRate = dayRates[day];
    const percentage = Math.round(dayRate * 100);
    
    // Thiết kế minimalist: chỉ trắng với viền, tô đỏ cho ngày thấp nhất
    let boxStyle = '';
    let textColor = '#1a1a1a';
    
    if (dayRate === minRate && dayRate < 1) {
      // Ngày có tỷ lệ thấp nhất -> tô đỏ
      boxStyle = 'background-color: #fef2f2; border: 2px solid #ef4444; color: #dc2626;';
      textColor = '#dc2626';
    } else if (dayRate === 1) {
      // Perfect day -> viền xanh
      boxStyle = 'background-color: #ffffff; border: 2px solid #22c55e; color: #22c55e;';
      textColor = '#22c55e';
    } else {
      // Normal day -> viền xám nhạt
      boxStyle = 'background-color: #ffffff; border: 1px solid #e5e7eb; color: #1a1a1a;';
    }
    
    heatmapHtml += `
      <div style="text-align: center; flex: 1; min-width: 0;">
        <div style="${boxStyle} padding: 12px 4px; border-radius: 8px; margin: 0 2px;">
          <div style="font-size: 10px; font-weight: 600; margin-bottom: 6px; color: ${textColor};">${dayNames[day]}</div>
          <div style="font-size: 14px; font-weight: 700; color: ${textColor};">${percentage}%</div>
        </div>
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom: 32px; background-color: #ffffff; border-radius: 12px; padding: 20px;">
      <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #374151; text-align: center;">
        Performance Heatmap Tuần Này
      </h3>
      <div style="display: flex; gap: 0; overflow-x: auto;">
        ${heatmapHtml}
      </div>
    </div>
  `;
}

/**
 * FIXED: Simplified Leaderboard (rút gọn text "Streak: 6 báo cáo")
 */
function buildSimplifiedLeaderboard(employees, CONFIG) {
  // Remove duplicates by name (keep highest performance version)
  const uniqueEmployees = [];
  const employeeMap = new Map();
  
  employees.forEach(emp => {
    const existing = employeeMap.get(emp.name);
    if (!existing || emp.totalReports > existing.totalReports) {
      employeeMap.set(emp.name, emp);
    }
  });
  
  // Convert map back to array
  employeeMap.forEach(emp => uniqueEmployees.push(emp));
  
  // Group unique employees by star count
  const starGroups = {};
  uniqueEmployees.forEach(emp => {
    const stars = emp.totalReports;
    if (!starGroups[stars]) {
      starGroups[stars] = [];
    }
    starGroups[stars].push(emp);
  });
  
  // Sort star levels descending (6, 5, 4, 3, 2, 1, 0)
  const sortedStarLevels = Object.keys(starGroups)
    .map(Number)
    .sort((a, b) => b - a);
  
  // Assign medals to top 3 star groups only
  const medalMap = {
    0: '🥇', // Highest star group gets gold
    1: '🥈', // Second highest gets silver  
    2: '🥉'  // Third highest gets bronze
  };
  
  let leaderboardHtml = '';
  let currentRank = 1;
  
  sortedStarLevels.forEach((starLevel, groupIndex) => {
    const employeesInGroup = starGroups[starLevel];
    const medal = medalMap[groupIndex] || ''; // No medal for 4th+ groups
    
    // Sort employees within same star group by name alphabetically
    employeesInGroup.sort((a, b) => a.name.localeCompare(b.name));
    
    employeesInGroup.forEach(emp => {
      const starColor = getStarColor(emp.totalReports);
      const starsDisplay = emp.totalReports > 0
        ? `<span style="color: ${starColor}; font-size: 16px;">★</span>`.repeat(emp.totalReports)
        : '<span style="color: #94a3b8; font-size: 14px;">Chưa báo cáo</span>';
      
      leaderboardHtml += `
        <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="width: 40px; text-align: center; font-size: 16px;">
            ${medal || currentRank}
          </div>
          <div style="flex: 1; margin-left: 12px;">
            <div style="font-size: 14px; font-weight: 500; color: #374151;">${emp.name}</div>
            <div style="font-size: 12px; color: #6b7280;">
              Streak: ${emp.totalReports} báo cáo
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: flex; gap: 2px; justify-content: flex-end;">
              ${starsDisplay}
            </div>
          </div>
        </div>
      `;
      currentRank++;
    });
  });
  
  return `
    <div style="margin-bottom: 32px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
      <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #374151; text-align: center;">
        Individual Performance Dashboard
      </h3>
      ${leaderboardHtml}
    </div>
  `;
}

/**
 * Lấy dữ liệu hiệu suất tuần của tất cả nhân viên
 */
function getAllEmployeesWeeklyData(sheet, ss, CONFIG, monday) {
  const employees = [];
  
  try {
    // Lấy tất cả nhân viên từ data ranges
    for (let i = 0; i < CONFIG.dataRanges.length; i++) {
      try {
        const dataRange = sheet.getRange(CONFIG.dataRanges[i]);
        const values = dataRange.getValues();
        
        for (let row of values) {
          const maNV = row[0];
          const tenNV = row[2];
          if (maNV && tenNV) {
            const weeklyData = getEmployeeWeeklyPerformance(sheet, tenNV, ss, CONFIG, monday);
            employees.push({
              name: tenNV,
              id: maNV,
              dailyReports: weeklyData.dailyReports,
              totalReports: weeklyData.totalReports,
              completionRate: weeklyData.completionRate,
              streak: weeklyData.streak,
              trend: weeklyData.trend
            });
          }
        }
      } catch (error) {
        Logger.log(`⚠️ Lỗi khi đọc data range ${CONFIG.dataRanges[i]}: ${error.message}`);
        continue;
      }
    }
  } catch (error) {
    Logger.log(`❌ Lỗi khi lấy dữ liệu nhân viên: ${error.message}`);
  }
  
  return employees;
}

/**
 * Lấy performance tuần của một nhân viên cụ thể
 */
function getEmployeeWeeklyPerformance(sheet, employeeName, ss, CONFIG, monday) {
  const dailyReports = [];
  let totalReports = 0;
  
  try {
    for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
      const checkDate = new Date(monday);
      checkDate.setDate(monday.getDate() + dayOffset);
      const checkDateStr = Utilities.formatDate(checkDate, ss.getSpreadsheetTimeZone(), "M/d/yyyy");
      
      let reported = false;
      
      // Tìm trong tất cả ranges
      for (let i = 0; i < CONFIG.dateHeaderRanges.length; i++) {
        try {
          const headerRange = sheet.getRange(CONFIG.dateHeaderRanges[i]);
          const headerValues = headerRange.getValues()[0];
          
          for (let j = 0; j < headerValues.length; j++) {
            const cell = headerValues[j];
            if (cell instanceof Date) {
              const dateStr = Utilities.formatDate(cell, ss.getSpreadsheetTimeZone(), "M/d/yyyy");
              if (dateStr === checkDateStr) {
                const dateColumnIndex = headerRange.getColumn() + j;
                const dataRange = sheet.getRange(CONFIG.dataRanges[i]);
                const values = dataRange.getValues();
                
                for (let row of values) {
                  const tenNV = row[2];
                  const reportMark = row[dateColumnIndex - dataRange.getColumn()];
                  
                  if (tenNV === employeeName && reportMark === 'X') {
                    reported = true;
                    totalReports++;
                    break;
                  }
                }
                break;
              }
            }
          }
          if (reported) break;
        } catch (error) {
          Logger.log(`⚠️ Lỗi khi kiểm tra ngày ${checkDateStr} cho ${employeeName}: ${error.message}`);
          continue;
        }
      }
      
      dailyReports.push(reported);
    }
  } catch (error) {
    Logger.log(`❌ Lỗi khi lấy performance của ${employeeName}: ${error.message}`);
  }
  
  const completionRate = totalReports / 6;
  const streak = calculateStreak(dailyReports);
  const trend = calculateTrend(dailyReports);
  
  return {
    dailyReports,
    totalReports,
    completionRate,
    streak,
    trend
  };
}

/**
 * Utility functions
 */
function calculateStreak(dailyReports) {
  let streak = 0;
  for (let i = dailyReports.length - 1; i >= 0; i--) {
    if (dailyReports[i]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function calculateTrend(dailyReports) {
  const firstHalf = dailyReports.slice(0, 3).filter(Boolean).length;
  const secondHalf = dailyReports.slice(3, 6).filter(Boolean).length;
  
  if (secondHalf > firstHalf) return 'up';
  if (secondHalf < firstHalf) return 'down';
  return 'stable';
}

/**
 * Progressive Star Color Function (Helper)
 */
function getStarColor(starCount) {
  const ratio = starCount / 6;
  if (ratio >= 0.9) return '#22c55e'; // Xanh đậm - Xuất sắc
  if (ratio >= 0.7) return '#84cc16'; // Xanh lime - Tốt  
  if (ratio >= 0.5) return '#eab308'; // Vàng - Trung bình
  return '#94a3b8'; // Xám - Cần cải thiện
}

/**
 * Helper function for daily reports (existing function)
 */
function getWeeklyStars(sheet, employeeName, ss, CONFIG) {
  try {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    let stars = 0;
    const daysToCheck = currentDay === 0 ? 6 : currentDay;
    
    for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
      const checkDate = new Date(monday);
      checkDate.setDate(monday.getDate() + dayOffset);
      const checkDateStr = Utilities.formatDate(checkDate, ss.getSpreadsheetTimeZone(), "M/d/yyyy");
      
      for (let i = 0; i < CONFIG.dateHeaderRanges.length; i++) {
        try {
          const headerRange = sheet.getRange(CONFIG.dateHeaderRanges[i]);
          const headerValues = headerRange.getValues()[0];
          
          for (let j = 0; j < headerValues.length; j++) {
            const cell = headerValues[j];
            if (cell instanceof Date) {
              const dateStr = Utilities.formatDate(cell, ss.getSpreadsheetTimeZone(), "M/d/yyyy");
              if (dateStr === checkDateStr) {
                const dateColumnIndex = headerRange.getColumn() + j;
                const dataRange = sheet.getRange(CONFIG.dataRanges[i]);
                const values = dataRange.getValues();
                
                for (let row of values) {
                  const tenNV = row[2];
                  const reportMark = row[dateColumnIndex - dataRange.getColumn()];
                  
                  if (tenNV === employeeName && reportMark === 'X') {
                    stars++;
                    break;
                  }
                }
                break;
              }
            }
          }
        } catch (error) {
          Logger.log(`⚠️ Lỗi khi đếm sao cho ${employeeName} ngày ${checkDateStr}: ${error.message}`);
          continue;
        }
      }
    }
    
    return stars;
  } catch (error) {
    Logger.log(`❌ Lỗi khi lấy weekly stars cho ${employeeName}: ${error.message}`);
    return 0;
  }
}