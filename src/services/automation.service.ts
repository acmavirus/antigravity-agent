// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { AccountService } from './account.service';
import { QuotaService } from './quota.service';
import { LogService, LogLevel } from './log.service';
import { NotificationService } from './notification.service';
import { CdpService } from './cdp.service';

/**
 * Dịch vụ tự động hóa - Chế độ "Full Auto" chấp nhận mọi lệnh kể cả SSH
 */
export class AutomationService {
    private isEnabled: boolean = true;
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | null = null;
    private cdpService: CdpService;
    private customCommands: string[] = [
        // Antigravity & Agent CIW Patterns
        'antigravity.step.accept',
        'antigravity.step.run',
        'antigravity.step.approve',
        'antigravity.step.apply',
        'antigravity.runCommand',
        'antigravity.accept',
        'antigravity.agent.acceptStep',
        'antigravity.agent.runCommand',
        'antigravity.agent.approveCommand',
        'antigravity.agent.execute',

        // VS Code Native & Copilot Patterns
        'chat.acceptAction',
        'chat.apply',
        'chat.runCommand',
        'chat.accept',
        'workbench.action.chat.accept',
        'workbench.chat.action.accept',
        'editor.action.inlineChat.accept',
        'editor.action.inlineChat.run',
        'interactive.accept',

        // Other Popular Agents (Cortex, AIPR, Continue, etc.)
        'aipr.accept',
        'aipr.run',
        'aipr.continue',
        'cortex.acceptAll',
        'cortex.runCommand',
        'cortex.approve',
        'cortex.execute',
        'continue.accept',
        'continue.run',
        'continue.approve',
        'cody.accept',
        'cody.run',
        'cursor.accept',
        'cursor.run',
        'tabnine.accept'
    ];

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: LogService,
        private notificationService: NotificationService
    ) {
        // Khởi tạo CDP Service
        this.cdpService = new CdpService(context);

        // Thanh trạng thái
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'antigravity.toggleAutoAccept';

        this.isEnabled = this.context.globalState.get<boolean>('autoAcceptEnabled', true);

        this.updateStatusBar();
        this.statusBarItem.show();

        if (this.isEnabled) {
            this.startAutomating();
        }
    }

    public toggle() {
        this.isEnabled = !this.isEnabled;
        this.context.globalState.update('autoAcceptEnabled', this.isEnabled);
        this.updateStatusBar();

        if (this.isEnabled) {
            this.startAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: BẬT SIÊU TỐC (Dual Engine)');
            this.logService.addLog(LogLevel.Info, 'Bật chế độ tự động chấp nhận SIÊU TỐC', 'Automation');
        } else {
            this.stopAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: ĐÃ TẮT', 'warn');
            this.logService.addLog(LogLevel.Warning, 'Tắt chế độ tự động chấp nhận', 'Automation');
        }
    }

    private updateStatusBar() {
        if (this.isEnabled) {
            this.statusBarItem.text = `$(zap) Auto: ON (Max)`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.remoteBackground');
        } else {
            this.statusBarItem.text = `$(x) Auto: OFF`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    private async startAutomating() {
        if (this.timer) return;

        // 1. Khởi động CDP Service (Advanced Auto Accept)
        await this.cdpService.start();

        // Kiểm tra xem debug port có hoạt động không
        const isCdpActive = await this.cdpService.isDebuggingEnabled();
        if (!isCdpActive) {
            // Chỉ log cảnh báo, không làm phiền người dùng
            this.logService.addLog(LogLevel.Warning, 'CDP Debug Port không hoạt động. Chạy chế độ tương thích cơ bản.', 'Automation');
        } else {
            this.logService.addLog(LogLevel.Info, 'CDP Engine đã kích hoạt. Hiệu suất tối đa.', 'Automation');
        }

        // 2. Chạy polling lệnh truyền thống (200ms)
        this.timer = setInterval(async () => {
            if (!this.isEnabled) return;

            // Quản lý Quota
            await this.checkAndSwitchAccount();

            // Tự động chấp nhận - Thử mọi command có thể
            for (const cmd of this.customCommands) {
                try {
                    await vscode.commands.executeCommand(cmd);
                } catch (e) {
                    // Bỏ qua lỗi
                }
            }
        }, 200);
    }

    private async checkAndSwitchAccount() {
        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts();
        const currentAccount = accounts.find(a => a.name === activeEmail);

        if (currentAccount) {
            const quotas = this.quotaService.getCachedQuotas(currentAccount.id);
            if (quotas && quotas.length > 0 && (quotas[0].percent || 0) < 1) {
                const replacement = accounts.find(a => {
                    if (a.id === currentAccount.id) return false;
                    const q = this.quotaService.getCachedQuotas(a.id);
                    return q && q.length > 0 && (q[0].percent || 0) > 10;
                });

                if (replacement) {
                    await this.accountService.switchAccount(replacement.id);
                    this.logService.addLog(LogLevel.Success, `Auto-Switch: ${replacement.name}`, 'Automation');
                }
            }
        }
    }

    private stopAutomating() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Dừng CDP
        this.cdpService.stop();
    }
}
