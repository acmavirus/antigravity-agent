import * as vscode from 'vscode';
import { QuotaService } from '../services/quota.service';
import { AccountService } from '../services/account.service';
import { LogService } from '../services/log.service';
import { AnalyticsService } from '../services/analytics.service';

export class DashboardProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly quotaService: QuotaService,
        private readonly accountService: AccountService,
        private readonly logService: LogService,
        private readonly analyticsService: AnalyticsService
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'refresh':
                    await this.quotaService.refreshAll(true);
                    await this.updateWebview(webviewView);
                    break;
                case 'addAccount':
                    await vscode.commands.executeCommand('antigravity.addAccount');
                    await this.updateWebview(webviewView);
                    break;
                case 'autoImport':
                    await this.accountService.autoImport();
                    await this.updateWebview(webviewView);
                    break;
                case 'deleteAccount':
                    await this.accountService.removeAccount(data.id);
                    await this.updateWebview(webviewView);
                    break;
                case 'switchAccount':
                    await this.accountService.switchAccount(data.id);
                    await this.updateWebview(webviewView);
                    break;
                case 'clearLogs':
                    await this.logService.clearLogs();
                    await this.updateWebview(webviewView);
                    break;
            }
        });

        // Lắng nghe sự thay đổi của Log
        this.logService.onDidChangeLogs(() => {
            this.updateWebview(webviewView);
        });

        // Initial update
        this.updateWebview(webviewView);

        // Định kỳ cập nhật dữ liệu nhưng chỉ gửi nếu có thay đổi thực sự (tránh nháy UI)
        const updateInterval = setInterval(() => {
            if (webviewView.visible) {
                this.updateWebview(webviewView);
            }
        }, 3000);

        webviewView.onDidDispose(() => {
            clearInterval(updateInterval);
        });
    }

    private lastDataSnapshot: string = '';

    private async updateWebview(webviewView: vscode.WebviewView) {
        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts().map(acc => ({
            ...acc,
            isActive: acc.name === activeEmail,
            quotas: this.quotaService.getCachedQuotas(acc.id) || []
        })).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

        const logs = this.logService.getLogs();
        const analytics = this.analyticsService.getUsageHistory();

        // Tạo snapshot để so sánh
        const currentData = {
            accounts,
            logs,
            analytics
        };

        const currentSnapshot = JSON.stringify(currentData);

        // CHỈ gửi tin nhắn nếu dữ liệu thực sự thay đổi
        // Điều này ngăn chặn việc Webview nhận message liên tục gây re-render làm nháy màn hình
        if (currentSnapshot !== this.lastDataSnapshot) {
            this.lastDataSnapshot = currentSnapshot;
            webviewView.webview.postMessage({
                type: 'update',
                ...currentData
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'dashboard.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'dashboard.js'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'logo.png'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'))}" rel="stylesheet">
    <title>Antigravity Dashboard</title>
</head>
<body>
    <div id="app">
        <header>
            <div class="brand">
                <img src="${logoUri}" class="logo" alt="Logo">
                <h1>Antigravity</h1>
            </div>
            <div class="actions">
                <button id="autoImportBtn" title="Auto Import"><i class="codicon codicon-cloud-download"></i></button>
                <button id="addBtn" title="Add Account"><i class="codicon codicon-add"></i></button>
                <button id="refreshBtn" title="Refresh"><i class="codicon codicon-refresh"></i></button>
                <button id="settingsBtn" title="Interface Settings"><i class="codicon codicon-settings"></i></button>
            </div>
        </header>

        <nav class="tabs">
            <button class="tab-item active" data-tab="accounts">Accounts</button>
            <button class="tab-item" data-tab="analytics">Analytics</button>
            <button class="tab-item" data-tab="logs">Logs</button>
        </nav>

        <main id="tab-content">
            <!-- ACCOUNT TAB -->
            <div id="accounts-tab" class="tab-pane active">
                <div id="account-list" class="account-grid">
                    <div class="loading">Loading data...</div>
                </div>
            </div>

            <!-- ANALYTICS TAB -->
            <div id="analytics-tab" class="tab-pane">
                <div class="analytics-container">
                    <h3>Usage Stats (7 days)</h3>
                    <div id="analytics-chart" class="chart-container">
                        <!-- Chart will be injected here -->
                    </div>
                </div>
            </div>

            <!-- LOGS TAB -->
            <div id="logs-tab" class="tab-pane">
                <div class="logs-header">
                    <h3>System Activities</h3>
                    <button id="clearLogsBtn" title="Clear Logs"><i class="codicon codicon-trash"></i></button>
                </div>
                <div id="log-list" class="log-timeline">
                    <!-- Logs will be injected here -->
                </div>
            </div>
        </main>

        <div id="settings-panel" class="settings-panel hidden">
            <div class="settings-header">
                <h3>Advanced Configuration</h3>
                <button id="closeSettingsBtn"><i class="codicon codicon-close"></i></button>
            </div>
            <div class="settings-content">
                <div class="setting-group">
                    <label>Telegram Token</label>
                    <input type="password" id="tgToken" placeholder="Bot token...">
                </div>
                <div class="setting-group">
                    <label>Telegram Chat ID</label>
                    <input type="text" id="tgChatId" placeholder="Chat ID...">
                </div>
                <hr>
                <div class="setting-group">
                    <label>Theme</label>
                    <div class="theme-options">
                        <button class="theme-opt active" data-theme="auto" title="Auto (VS Code)">🖥️</button>
                        <button class="theme-opt" data-theme="dark" title="Dark">🌑</button>
                        <button class="theme-opt" data-theme="light" title="Light">☀️</button>
                        <button class="theme-opt" data-theme="cyber" title="Cyberpunk">🔮</button>
                    </div>
                </div>
                <div class="setting-group">
                    <label>Accent Color</label>
                    <div class="color-options">
                        <button class="color-opt active" data-color="#38bdf8" style="background: #38bdf8;"></button>
                        <button class="color-opt" data-color="#10b981" style="background: #10b981;"></button>
                        <button class="color-opt" data-color="#f59e0b" style="background: #f59e0b;"></button>
                        <button class="color-opt" data-color="#ef4444" style="background: #ef4444;"></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
