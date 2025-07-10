# Hệ thống quản lý lịch khám bệnh

Ứng dụng Google Apps Script để quản lý lịch khám bệnh cho phòng khám với thiết kế tối giản và hiện đại.

## Tính năng chính
- **Dashboard tổng quan**: Thống kê tổng số người khám theo ngày
- **Lịch khám timeline**: Hiển thị lịch khám theo tuần với filter thông minh
- **Bảng khám cận lâm sàng**: Theo dõi số lượng khám sáng/chiều
- **Biểu đồ thống kê**: Line chart "Lịch khám" và "Khám cận lâm sàng" (loại bỏ Chủ nhật)
- **Tương tác thông minh**: Click vào Chủ nhật hiển thị câu nói vui thay vì dữ liệu
- **Filter đa dạng**: Theo thời gian, ca làm việc, công ty
- **Giao diện responsive**: Mobile-first design
- **Thiết kế tối giản**: Chỉ sử dụng màu trắng đen

## Cài đặt
1. Tạo Google Apps Script project mới
2. Copy code từ repository này
3. Tạo Google Sheet để lưu dữ liệu
4. Cập nhật Sheet ID trong `Code.js`
5. Deploy as Web App

## Công nghệ
- **Backend**: Google Apps Script
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: Google Sheets API
- **Charts**: Chart.js library
- **Design**: Mobile-first responsive design
- **Architecture**: Single Page Application (SPA)

## Cấu trúc dự án
- `Code.js` - Backend logic và API endpoints
- `dashboard.html` - Main UI template
- `dashboard_styles.html` - CSS styles
- `dashboard_scripts.html` - Frontend JavaScript
- `appsscript.json` - Project configuration

## Thiết kế
Tuân thủ triết lý **"Less, but better"** của Jony Ive:
- **Màu sắc**: Chỉ trắng (#FFFFFF) và đen (#000000)
- **Typography**: Inter, SF Pro Display, system-ui
- **Layout**: 8-point grid system (8px, 16px, 24px, 32px)
- **Components**: Border radius 8px, minimal shadows
- **Accessibility**: WCAG AA compliance, keyboard navigation
- **No icons policy**: Tập trung vào nội dung, tránh phân tâm thị giác

## Tính năng đặc biệt
- **Sunday Logic**: Tự động loại bỏ Chủ nhật khỏi biểu đồ để hiển thị dữ liệu liên tục
- **Fun Quotes**: Click vào ngày Chủ nhật hiển thị câu nói vui thay vì dữ liệu
- **Smart Filtering**: Filter theo thời gian, ca làm việc, tìm kiếm công ty
- **Real-time Updates**: Dữ liệu cập nhật tự động từ Google Sheets

## Performance
- **Caching**: Implement caching cho API calls
- **Lazy Loading**: Tải dữ liệu theo yêu cầu
- **Optimized Charts**: Chart.js với cấu hình tối ưu
- **Minimal Dependencies**: Chỉ sử dụng thư viện cần thiết

## Development
- **Code Quality**: Single responsibility, modular design
- **Security**: Input validation, try-catch error handling
- **Maintainability**: Clean code, documented functions
- **Testing**: Manual testing trên multiple devices