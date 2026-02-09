// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { QuotaService } from '../services/quota.service';
import { AccountService } from '../services/account.service';

export class DashboardProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly quotaService: QuotaService,
        private readonly accountService: AccountService
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
            }
        });

        // Initial update
        this.updateWebview(webviewView);

        // Interval update webview
        setInterval(() => this.updateWebview(webviewView), 10000);
    }

    private async updateWebview(webviewView: vscode.WebviewView) {
        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts().map(acc => ({
            ...acc,
            isActive: acc.name === activeEmail,
            quotas: this.quotaService.getCachedQuotas(acc.id) || []
        })).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

        webviewView.webview.postMessage({ type: 'update', accounts });
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
                <button id="autoImportBtn" title="Tự động nhập"><i class="codicon codicon-cloud-download"></i></button>
                <button id="addBtn" title="Thêm tài khoản"><i class="codicon codicon-add"></i></button>
                <button id="refreshBtn" title="Làm mới"><i class="codicon codicon-refresh"></i></button>
                <button id="settingsBtn" title="Tùy chỉnh giao diện"><i class="codicon codicon-settings"></i></button>
            </div>
        </header>

        <div id="settings-panel" class="settings-panel hidden">
            <div class="settings-header">
                <h3>Tùy chỉnh giao diện</h3>
                <button id="closeSettingsBtn"><i class="codicon codicon-close"></i></button>
            </div>
            <div class="settings-content">
                <div class="setting-group">
                    <label>Chủ đề</label>
                    <div class="theme-options">
                        <button class="theme-opt active" data-theme="auto" title="Tự động (VS Code)">🖥️</button>
                        <button class="theme-opt" data-theme="dark" title="Tối">🌑</button>
                        <button class="theme-opt" data-theme="light" title="Sáng">☀️</button>
                        <button class="theme-opt" data-theme="cyber" title="Cyberpunk">🔮</button>
                    </div>
                </div>
                <div class="setting-group">
                    <label>Màu nhấn (Accent)</label>
                    <div class="color-options">
                        <button class="color-opt active" data-color="#38bdf8" style="background: #38bdf8;"></button>
                        <button class="color-opt" data-color="#10b981" style="background: #10b981;"></button>
                        <button class="color-opt" data-color="#f59e0b" style="background: #f59e0b;"></button>
                        <button class="color-opt" data-color="#ef4444" style="background: #ef4444;"></button>
                        <button class="color-opt" data-color="#818cf8" style="background: #818cf8;"></button>
                        <button class="color-opt" data-color="#f472b6" style="background: #f472b6;"></button>
                    </div>
                </div>
                <div class="setting-group">
                    <label>Chế độ hiển thị</label>
                    <select id="layoutSelect">
                        <option value="comfortable">Thoải mái</option>
                        <option value="compact">Gọn gàng</option>
                    </select>
                </div>
                <div class="setting-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="glassEffect" checked> Hiệu ứng kính (Glassmorphism)
                    </label>
                </div>
            </div>
        </div>
        
        <div id="account-list" class="account-grid">
            <!-- Dynamic Content -->
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
