# 🌌 Antigravity Agent - Trợ Lý AI Tối Thượng Cho VS Code

> **Antigravity Agent** không chỉ là một tiện ích mở rộng thông thường, đây là một hệ sinh thái mạnh mẽ giúp tối ưu hóa, quản lý và tự động hóa toàn bộ trải nghiệm AI của bạn trên VS Code và các trình biên tập mã nguồn dựa trên AI khác (như Cursor).

---

## 🚀 Tính Năng Cốt Lõi

### 1. 📂 Quản Lý Tài Khoản Thông Minh (Smart Account Engine)
- **Hỗ trợ đa nguồn**: Nhập tài khoản từ JSON, API Keys hoặc đồng bộ trực tiếp từ Antigravity Desktop.
- **Tự động phát hiện trạng thái**: Hệ thống tự động nhận biết tài khoản bị 403 Forbidden, hết hạn session hoặc lỗi xác thực.
- **Chuyển đổi tức thì**: Quản lý tập trung tại Sidebar Dashboard với khả năng chuyển đổi tài khoản theo thời gian thực.

### 2. 📊 Giám Sát Định Mức Theo Thời Gian Thực (Real-time Quota Intelligence)
- **Visual Dashboard**: Giao diện Glassmorphism độc đáo hiển thị tiến độ sử dụng của từng model (GPT-4o, Claude 3.5 Sonnet, etc.).
- **Live Status Bar**: Theo dõi phần trăm quota trực tiếp ngay trên thanh trạng thái của VS Code mà không cần mở Dashboard.
- **Cơ chế Cache thông minh**: Tối ưu hóa yêu cầu mạng với bộ nhớ đệm 60 giây, đảm bảo hiệu suất cực cao.

### 3. 🤖 Tự Động Hóa Lai (Hybrid Automation Engine)
- **Auto-Accept 2.0**: Tự động chấp nhận các đề xuất code từ AI (Apply, Run, Accept).
- **Cơ chế CDP (Chrome DevTools Protocol)**: Khả năng "inject" lệnh và tương tác trực tiếp với các IDE AI khác (Cursor/Antigravity Desktop) thông qua giao thức debugger.
- **Chống Treo AI**: Định kỳ gửi các lệnh giả lập để giữ cho AI luôn trong trạng thái sẵn sàng, tối ưu hóa tốc độ phản hồi.

### 4. 📱 Trung Tâm Điều Khiển Di Động (Remote Command Center)
- **Mobile Dashboard**: Truy cập dashboard từ điện thoại hoặc bất kỳ thiết bị nào qua đường truyền bảo mật của `localtunnel`.
- **Surveillance Mode**: Xem nội dung chat của AI, lịch sử logs và thậm chí là **chụp ảnh màn hình (screenshot)** IDE từ xa.
- **Remote Control**: Chạy lệnh, đổi tài khoản hoặc yêu cầu AI thực hiện tác vụ ngay từ điện thoại mà không cần chạm vào máy tính.

### 5. ⏰ Tự Động Đánh Thức & Lập Lịch (Smart Scheduler)
- **Auto Wake-up**: Tự động gửi yêu cầu kích hoạt chu kỳ reset quota ngay khi đến thời điểm cho phép.
- **Working Hours**: Chế độ làm việc thông minh, chỉ chạy trong khung giờ cấu hình (mặc định 08:00-22:00) để tiết kiệm tài nguyên.
- **Lịch sử hoạt động**: Ghi lại chi tiết các lần đánh thức thành công/thất bại để theo dõi hiệu quả.

---

## 🛠️ Kiến Trúc Kỹ Thuật (Tech Stack)

Hệ thống được xây dựng trên nền tảng cực kỳ hiện đại và tối ưu:
- **Core**: VS Code Extenstion API (TypeScript).
- **Backend-in-IDE**: Express.js server tích hợp sẵn bên trong extension.
- **Networking**: WebSocket, Localtunnel, Axios.
- **Data Handling**: ProtobufJS (giải mã dữ liệu mức thấp từ các nhà cung cấp AI), Node-cache, Async-mutex.
- **Automation**: Chrome DevTools Protocol (CDP) cho phép tương tác mức sâu vào các tiến trình browser-based.

---

## 💻 Hướng Dẫn Phát Triển

1. **Cài đặt phụ thuộc**:
   ```powershell
   npm install
   ```
2. **Biên dịch mã nguồn**:
   ```powershell
   npm run compile
   ```
3. **Chạy thử**:
   Nhấn `F5` để mở cửa sổ **Extension Development Host**.

---

## 🛡️ Bảo Mật & Bảo Trì
- **Duy nhất cho bạn**: Mọi dữ liệu tài khoản được lưu trữ cục bộ tại `globalState` của VS Code, không đẩy lên cloud bên thứ ba.
- **Concurrency Control**: Sử dụng Mutex Locks để bảo vệ dữ liệu khi thực hiện nhiều thao tác đồng thời.

---
**Copyright by AcmaTvirus**
