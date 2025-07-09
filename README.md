# Hệ thống quản lý lịch khám bệnh

Ứng dụng Google Apps Script để quản lý lịch khám bệnh cho phòng khám với thiết kế tối giản và hiện đại.

## Tính năng chính
- Quản lý lịch khám bệnh
- Quản lý thông tin bệnh nhân
- Thống kê và báo cáo
- Giao diện responsive (mobile-first)
- Thiết kế tối giản (chỉ trắng đen)

## Cài đặt
1. Tạo Google Apps Script project mới
2. Copy code từ repository này
3. Tạo Google Sheet để lưu dữ liệu
4. Cập nhật Sheet ID trong `Code.js`
5. Deploy as Web App

## Công nghệ
- Google Apps Script
- HTML/CSS/JavaScript
- Google Sheets API
- Responsive Design

## Cấu trúc dự án
- `Code.js` - Backend logic và API endpoints
- `dashboard.html` - Main UI template
- `dashboard_styles.html` - CSS styles
- `dashboard_scripts.html` - Frontend JavaScript
- `appsscript.json` - Project configuration

## Thiết kế
Tuân thủ triết lý **"Less, but better"** của Jony Ive:
- Màu sắc: Chỉ trắng (#FFFFFF) và đen (#000000)
- Typography: Inter, SF Pro Display
- Layout: 8-point grid system
- Components: Bo tròn tinh tế, đổ bóng minimal