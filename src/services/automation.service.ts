import * as vscode from 'vscode';
import { AccountService } from './account.service';
import { QuotaService } from './quota.service';
import { LogService, LogLevel } from './log.service';
import { NotificationService } from './notification.service';

export class AutomationService {
    private isEnabled: boolean = true;
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | null = null;
    private customCommands: string[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: LogService,
        private notificationService: NotificationService
    ) {
        // Khởi tạo Status Bar Item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'antigravity.toggleAutoAccept';

        // Load cấu hình
        this.isEnabled = this.context.globalState.get<boolean>('autoAcceptEnabled', true);
        this.customCommands = this.context.globalState.get<string[]>('customAutoCommands', [
            'antigravity.step.accept',
            'antigravity.step.run',
            'antigravity.step.approve',
            'antigravity.step.apply',
            'antigravity.acceptAll',
            'antigravity.accept',
            'antigravity.agent.acceptStep',
            'aipr.accept',
            'aipr.continue',
            'cortex.acceptAll',
            'cortex.runCommand'
        ]);

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
            this.notificationService.notify('Antigravity Auto-Accept: BẬT');
            this.logService.addLog(LogLevel.Info, 'Bật chế độ tự động chấp nhận', 'Automation');
        } else {
            this.stopAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: TẮT', 'warn');
            this.logService.addLog(LogLevel.Warning, 'Tắt chế độ tự động chấp nhận', 'Automation');
        }
    }

    private updateStatusBar() {
        if (this.isEnabled) {
            this.statusBarItem.text = `$(check) Auto: ON`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.remoteBackground');
        } else {
            this.statusBarItem.text = `$(x) Auto: OFF`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    private startAutomating() {
        if (this.timer) return;

        this.timer = setInterval(async () => {
            if (!this.isEnabled) return;

            // 1. Kiểm tra Quota và tự động chuyển tài khoản
            await this.checkAndSwitchAccount();

            // 2. Thực thi các lệnh Auto-Accept
            for (const cmd of this.customCommands) {
                try {
                    await vscode.commands.executeCommand(cmd);
                } catch (e) { }
            }
        }, 2000); // Tăng lên 2s để tránh quá tải
    }

    private async checkAndSwitchAccount() {
        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts();
        const currentAccount = accounts.find(a => a.name === activeEmail);

        if (currentAccount) {
            const quotas = this.quotaService.getCachedQuotas(currentAccount.id);
            // Nếu model đầu tiên hết quota (dưới 1%)
            if (quotas && quotas.length > 0 && (quotas[0].percent || 0) < 1) {
                this.logService.addLog(LogLevel.Warning, `Tài khoản ${activeEmail} đã hết hạn mức. Đang tìm tài khoản thay thế...`, 'Automation');

                // Tìm tài khoản khác còn quota
                const replacement = accounts.find(a => {
                    if (a.id === currentAccount.id) return false;
                    const q = this.quotaService.getCachedQuotas(a.id);
                    return q && q.length > 0 && (q[0].percent || 0) > 10;
                });

                if (replacement) {
                    await this.accountService.switchAccount(replacement.id);
                    this.logService.addLog(LogLevel.Success, `Đã tự động chuyển sang tài khoản: ${replacement.name}`, 'Automation');
                    this.notificationService.notify(`Đã đổi sang ${replacement.name} do tài khoản cũ hết hạn mức.`);
                } else {
                    this.notificationService.notify('Tất cả tài khoản đã hết hạn mức!', 'error');
                }
            }
        }
    }

    private stopAutomating() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
