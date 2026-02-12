# 🌌 Cấu Trúc Dự Án Antigravity Agent

Tài liệu này mô tả chi tiết cấu trúc thư mục và kiến trúc kỹ thuật của dự án **Antigravity Agent** - một VS Code Extension quản lý tài khoản và định mức AI.

## 1. Tổng Quan
- **Loại dự án**: VS Code Extension.
- **Ngôn ngữ chính**: TypeScript.
- **Mục tiêu**: Quản lý tài khoản AI, giám sát quota thời gian thực, tự động hóa (CDP), và điều khiển từ xa qua Mobile Dashboard.

## 2. Cấu Trúc Thư Mục

```
antigravity-agent/
├── .vscode/                # Cấu hình debug và tasks của VS Code
├── resources/              # Tài nguyên tĩnh (UI Dashboard)
│   ├── mobile/             # Giao diện cho Mobile Dashboard (HTML/JS/CSS)
│   ├── dashboard.css       # Style cho Sidebar Dashboard
│   ├── dashboard.js        # Logic cho Sidebar Dashboard
│   └── icon.svg, logo.png  # Assets hình ảnh
├── src/                    # Mã nguồn chính (TypeScript)
│   ├── automation/         # Module tự động hóa
│   │   └── cdp.service.ts  # Dịch vụ Chrome DevTools Protocol (CDP) để tương tác sâu
│   ├── core/               # Business Logic cốt lõi
│   │   ├── account.service.ts      # Quản lý tài khoản (Thêm, Xóa, Active)
│   │   ├── analytics.service.ts    # Phân tích dữ liệu sử dụng
│   │   ├── log.service.ts          # Hệ thống logging tập trung
│   │   ├── notification.service.ts # Quản lý thông báo người dùng
│   │   ├── protobuf.decoder.ts     # Giải mã dữ liệu binary từ AI Providers
│   │   ├── quota.service.ts        # Logic tính toán và cache quota
│   │   └── scheduler.service.ts    # Lập lịch tự động (Auto Wake-up)
│   ├── server/             # Backend server nhúng
│   │   └── webserver.service.ts    # Express Server + WebSocket + Localtunnel (cho Mobile)
│   ├── views/              # Quản lý giao diện VS Code
│   │   └── dashboard.provider.ts   # Webview Provider cho Sidebar
│   └── extension.ts        # Entry point: Khởi tạo và kết nối các dịch vụ
├── package.json            # Khai báo dependencies và cấu hình Extension (Commands, Views)
├── tsconfig.json           # Cấu hình TypeScript Compiler
└── README.md               # Tài liệu hướng dẫn sử dụng
```

## 3. Các Module Chính

### A. Core Services (`src/core/`)
- **AccountService**: Chịu trách nhiệm lưu trữ và quản lý thông tin đăng nhập. Sử dụng `globalState` của VS Code để bảo mật.
- **QuotaService**: Trái tim của hệ thống. Gọi API (thường được giải mã qua `protobuf`) để lấy thông tin giới hạn sử dụng của các model (GPT-4, Claude...).
- **SchedulerService**: Quản lý các tác vụ chạy ngầm, ví dụ như tự động "đánh thức" model khi sang ngày mới hoặc giờ làm việc.

### B. Automation & Server
- **CdpService (`src/automation`)**: Sử dụng giao thức CDP để kết nối với các phiên bản trình duyệt hoặc IDE khác (như Cursor), cho phép inject lệnh.
- **WebServerService (`src/server`)**: Chạy một Express server nhỏ ngay trong VS Code. Kết hợp với `localtunnel` để public ra internet, cho phép người dùng truy cập dashboard từ điện thoại.

### C. UI/UX
- **Extension UI**: Sidebar view được định nghĩa trong `package.json` và render bởi `DashboardProvider`.
- **Mobile UI**: Nằm trong `resources/mobile/`, phục vụ giao diện điều khiển từ xa.

## 4. Quy Trình Hoạt Động (Lifecycle)
1. **Activation (`extension.ts`)**: Khi VS Code khởi động, hàm `activate` được gọi.
2. **Initialization**: Khởi tạo lần lượt: `Log` -> `Account` -> `Quota` -> `Scheduler` -> `WebServer`.
3. **Background Tasks**: `QuotaService` bắt đầu loop kiểm tra định mức; `WebServer` mở port lắng nghe kết nối Mobile.
4. **Interaction**: Người dùng tương tác qua Sidebar hoặc Command Palette (`Ctrl+Shift+P`), các lệnh này gọi vào method tương ứng của Service.
