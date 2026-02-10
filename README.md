# Antigravity Agent - VS Code Extension

**Antigravity Agent** is a powerful extension that helps manage AI accounts, monitor quotas in real-time, and automatically activate quota reset cycles.

## 🚀 Key Features

### 1. Account & Auth Management
- **Multi-source Support**: Import from JSON, API Keys, or sync from Antigravity Desktop.
- **Smart Status**: Automatically detects 403 Forbidden or expired sessions.
- **Quick Switching**: Centralized management via Sidebar Dashboard.

### 2. Quota Monitoring
- **Visual Dashboard**: Glassmorphism interface displaying usage progress.
- **Status Bar**: Quickly track quota percentages directly on the VS Code status bar.
- **Caching**: Optimizes network requests with a 60-second cache.

### 3. Auto Wake-up
- **Smart Scheduling**: Automatically sends requests to trigger reset cycles.
- **Working Hours**: Avoids running outside of configured hours (default 08:00-22:00).
- **History**: Logs successful and failed activation attempts.

### 4. Performance & Security
- **Concurrency Control**: Uses Mutex Locks to protect data during simultaneous operations.
- **Resource Optimization**: Lightweight Webview to reduce memory footprint.

### 5. Personalization & Internationalization
- **Multi-language**: Supports Vietnamese, English, Chinese, etc.
- **Privacy Mode**: Hide sensitive data.

## 🛠️ Installation & Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile source code:
   ```bash
   npm run compile
   ```
3. Press `F5` to run in the **Extension Development Host** window.

---
**Copyright by AcmaTvirus**
