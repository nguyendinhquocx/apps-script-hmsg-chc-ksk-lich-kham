---
description: Quy tắc cụ thể cho dự án Google Apps Script
globs: **/*
alwaysApply: true
---

# Project Rules - Google Apps Script Specific

## 📋 Dự án hiện tại: Hệ thống quản lý lịch khám bệnh

### Mục tiêu dự án
- Tạo ứng dụng quản lý lịch khám cho phòng khám
- Giao diện web app đơn giản, hiệu quả
- Tích hợp với Google Sheets làm database
- Responsive design cho mọi thiết bị

## 💻 Google Apps Script Specific Rules

### File Structure
- **Code.js**: Main backend logic và API endpoints
- **dashboard.html**: Main UI template
- **dashboard_styles.html**: CSS styles (embedded)
- **dashboard_scripts.html**: Frontend JavaScript (embedded)
- **appsscript.json**: Project configuration

### GAS Performance Optimization
- **Batch operations**: Luôn dùng `getValues()` và `setValues()` thay vì từng cell
- **Caching**: Sử dụng `CacheService` cho data thường xuyên truy cập
- **Minimize Sheets calls**: Gom nhóm operations, tránh loops với SpreadsheetApp
- **Lock Service**: Sử dụng `LockService` cho concurrent access
- **Execution time**: Giữ functions dưới 6 phút execution limit

### Google Workspace Integration
- **Sheets as Database**: Structured data với headers rõ ràng
- **Drive API**: File management và permissions
- **Gmail API**: Email notifications nếu cần
- **Calendar API**: Sync với Google Calendar
- **Forms API**: Tích hợp với Google Forms

### Web App Deployment
- **Permissions**: Chạy as user accessing the web app
- **Access**: Anyone với link (hoặc restricted theo needs)
- **Version management**: Deploy new versions cho updates
- **Error pages**: Custom error handling cho user experience

### Security & Data Protection
- **Input validation**: Sanitize tất cả user inputs
- **SQL injection prevention**: Parameterized queries nếu dùng external DB
- **Access control**: Role-based permissions nếu cần
- **Data backup**: Regular backup strategies cho Sheets data

## 🎯 Development Workflow cho GAS

### Setup Phase
1. Tạo Google Apps Script project
2. Enable necessary APIs (Sheets, Drive, etc.)
3. Setup Sheets structure với proper headers
4. Configure project permissions

### Implementation Phase
1. Backend logic (Code.js) - Data operations
2. Frontend UI (HTML files) - User interface
3. Integration testing với Sheets
4. Web App deployment và testing
5. Performance optimization

### Testing Strategy
- **Unit testing**: Test individual functions
- **Integration testing**: Test với actual Sheets data
- **User testing**: Deploy và test web app
- **Performance testing**: Check execution times
- **Error handling**: Test edge cases và error scenarios

## 🚀 GAS-Specific Feature Suggestions

### Automation Features
- **Auto-backup**: Scheduled backup của Sheets data
- **Email notifications**: Tự động gửi email reminders
- **Calendar sync**: Sync appointments với Google Calendar
- **Report generation**: Tự động tạo reports định kỳ

### Integration Opportunities
- **Google Forms**: Intake forms cho patients
- **Google Drive**: Document storage và sharing
- **Google Sites**: Public website integration
- **Third-party APIs**: SMS notifications, payment processing

### Performance Enhancements
- **Data pagination**: Load data theo chunks
- **Smart caching**: Cache frequently accessed data
- **Lazy loading**: Load UI components on demand
- **Background processing**: Use time-driven triggers

### User Experience Improvements
- **Offline capability**: Cache data for offline viewing
- **Progressive Web App**: PWA features cho mobile
- **Real-time updates**: WebSocket-like functionality
- **Advanced search**: Filter và search capabilities

---

*Những quy tắc này đảm bảo mọi dự án đều có thiết kế nhất quán, hiện đại và user-friendly theo triết lý "Less, but better" của Jony Ive và Steve Jobs.*