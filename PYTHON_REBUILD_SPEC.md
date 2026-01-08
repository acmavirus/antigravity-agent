# Tài liệu Đặc tả Dự án: Antigravity Agent (Python Version)

Tài liệu này mô tả chi tiết các thành phần, chức năng và kiến trúc của dự án Antigravity Agent hiện tại để chuẩn bị cho quá trình xây dựng lại (rebuild) bằng ngôn ngữ Python.

## 1. Tổng quan dự án
Antigravity Agent là một công cụ hỗ trợ cho trình soạn thảo Antigravity (dựa trên VS Code). Nhiệm vụ chính là quản lý đa tài khoản, đồng bộ trạng thái đăng nhập và theo dõi hạn mức (quota) AI.

## 2. Các thành phần lõi cần chuyển đổi

### A. Quản lý Cơ sở dữ liệu (Database Core)
Hiện tại, ứng dụng tương tác trực tiếp với file SQLite của Antigravity:
- **Đường dẫn:** `%AppData%/Antigravity/User/globalStorage/state.vscdb` (Windows).
- **Bảng chính:** `ItemTable` (gồm 2 cột: `key` và `value`).
- **Nhiệm vụ:**
    - Đọc/Ghi key `jetskiStateSync.agentManagerInitState` (Dữ liệu phiên đăng nhập).
    - Xóa key `antigravityAuthStatus` để ép buộc ứng dụng nhận diện trạng thái mới.
    - Theo dõi thay đổi của database (Polling hoặc File Watcher).

### B. Xử lý Protobuf (Protobuf Logic)
Dữ liệu phiên đăng nhập được lưu dưới dạng chuỗi Base64, sau khi giải mã sẽ ra định dạng Protobuf.
- **File định nghĩa:** `antigravity.proto`.
- **Thông tin cần trích xuất:**
    - `access_token` và `id_token` (dùng để refresh).
    - `email` người dùng.
    - Danh sách model AI và hạn mức hiện tại.

### C. Quản lý Tiến trình (Process Control)
Hành động chuyển đổi tài khoản yêu cầu:
1. Tắt tất cả tiến trình `Antigravity.exe`.
2. Ghi đè dữ liệu vào database.
3. Khởi động lại ứng dụng.

### D. Local API Server
Một HTTP Server chạy ngầm để phục vụ Extension của VS Code.
- **Port:** `18888`.
- **Các Endpoint chính:**
    - `GET /api/is_antigravity_running`: Kiểm tra trạng thái.
    - `GET /api/get_antigravity_accounts`: Lấy danh sách tài khoản đã lưu.
    - `POST /api/switch_to_antigravity_account`: Đổi tài khoản.
    - `POST /api/get_account_metrics`: Lấy thông tin hạn mức.

### E. Tương tác Cloud Code API
Sử dụng Token của người dùng để gọi các API của Google:
- **Token Refresh:** Tự động lấy Access Token mới từ Refresh Token (`id_token`).
- **Quota Trigger:** Gửi một query nhỏ (`v1internal:generateContent`) để làm mới hạn mức AI.

## 3. Kiến trúc Python đề xuất

### Stack Công nghệ
- **Backend:** `FastAPI` (Hiệu suất cao, tự động tạo tài liệu API).
- **UI:** `Flet` (Xây dựng GUI chuyên nghiệp bằng Python, hỗ trợ tốt Dark Mode và Animations).
- **DB:** `sqlite3` + `SQLAlchemy`.
- **Process:** `psutil`.
- **API Client:** `httpx` (Hỗ trợ Async tốt cho các tác vụ gọi API song song).
- **Packaging:** `PyInstaller` hoặc `Nuitka`.

### Cấu trúc thư mục dự án (Gợi ý)
```text
antigravity-python/
├── app/
│   ├── api/            # FastAPI routes
│   ├── core/           # Logic xử lý DB, Protobuf, Process
│   ├── models/         # Khai báo cấu trúc dữ liệu
│   ├── services/       # Google API services
│   └── ui/             # Giao diện Flet
├── proto/              # File .proto và code python sinh ra
├── assets/             # Icons, images
├── logs/               # Log files (đã脱敏)
├── main.py             # Điểm khởi đầu ứng dụng
└── requirements.txt    # Danh sách thư viện
```

## 4. Các tính năng cần tái hiện (Feature List)

1. **Dashboard:** Hiển thị tài khoản hiện tại, trạng thái và hạn mức 4 model chính (Gemini Pro, Flash, Image, Claude).
2. **Account Manager:** 
    - Danh sách tài khoản đã lưu kèm email.
    - Nút chuyển đổi (Switch) nhanh.
    - Chức năng Import/Export tài khoản (có mã hóa XOR đơn giản như bản cũ).
3. **Tray Icon:** Chạy ẩn dưới taskbar, hỗ trợ thoát nhanh hoặc mở cửa sổ.
4. **Auto Refresh:** Chạy ngầm định kỳ để cập nhật hạn mức mà không cần mở UI.
5. **Log Sanitizer:** Tự động che giấu thông tin nhạy cảm trong file log để bảo vệ người dùng.

## 5. Lộ trình Migration (Chi tiết)

1. **Giai đoạn 1:** Xây dựng module `Core` (Đọc DB, Giải mã Protobuf, Tắt/Mở tiến trình).
2. **Giai đoạn 2:** Xây dựng `Service` (Tự động Refresh Token, Gọi API Google).
3. **Giai đoạn 3:** Xây dựng `Local API` bằng FastAPI để đảm bảo Extension VS Code vẫn hoạt động.
4. **Giai đoạn 4:** Thiết kế GUI bằng `Flet` theo phong cách hiện tại (Modern UI).
5. **Giai đoạn 5:** Đóng gói và kiểm thử trên môi trường Windows sạch.
