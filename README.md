# Antigravity Agent - VS Code Extension

**Antigravity Agent** là một tiện ích mở rộng mạnh mẽ giúp quản lý tài khoản AI, giám sát hạn mức (quota) thời gian thực và tự động kích hoạt chu kỳ reset hạn mức.

## 🚀 Tính năng chính

### 1. Quản lý Tài khoản & Ủy quyền (Account & Auth)
- **Hỗ trợ đa nguồn**: Nhập từ JSON, API Key, hoặc đồng bộ từ Antigravity Desktop.
- **Trạng thái thông minh**: Tự động phát hiện lỗi 403 Forbidden hoặc hết hạn.
- **Chuyển đổi nhanh**: Quản lý tập trung tại Sidebar Dashboard.

### 2. Giám sát Hạn mức (Quota Monitoring)
- **Dashboard trực quan**: Giao diện Glassmorphism hiển thị tiến trình sử dụng.
- **Status Bar**: Theo dõi nhanh phần trăm hạn mức ngay trên thanh trạng thái VS Code.
- **Cache**: Tối ưu hóa yêu cầu mạng với bộ nhớ đệm 60 giây.

### 3. Tự động "Thức tỉnh" (Auto Wake-up)
- **Lập lịch thông minh**: Tự động gửi request kích hoạt chu kỳ reset.
- **Khung giờ làm việc**: Tránh chạy tự động ngoài giờ cấu hình (mặc định 08:00-22:00).
- **Lịch sử**: Ghi lại chi tiết các lần kích hoạt thành công/thất bại.

### 4. Hiệu suất & Bảo mật
- **Concurrency Control**: Sử dụng Mutex Lock để bảo vệ dữ liệu khi thao tác đồng thời.
- **Tối ưu tài nguyên**: Webview được tinh gọn để giảm dấu chân bộ nhớ.

### 5. Cá nhân hóa & Quốc tế hóa
- **Đa ngôn ngữ**: Hỗ trợ Tiếng Việt (mặc định), Tiếng Anh, Tiếng Trung...
- **Privacy Mode**: Ẩn dữ liệu nhạy cảm.

## 🛠️ Cài đặt & Phát triển

1. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```
2. Biên dịch mã nguồn:
   ```bash
   npm run compile
   ```
3. Nhấn `F5` để chạy thử trong cửa sổ **Extension Development Host**.

---
**Copyright by AcmaTvirus**
