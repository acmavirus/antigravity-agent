// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { AccountService } from './account.service';
import { QuotaService } from './quota.service';
import { LogService, LogLevel } from './log.service';
import { NotificationService } from './notification.service';

/**
 * Dịch vụ tự động hóa - Chịu trách nhiệm tự động nhấn "Accept" cho các bước thực thi
 */
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
        // Khởi tạo mục hiển thị trên thanh trạng thái
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'antigravity.toggleAutoAccept';

        // Tải trạng thái và danh sách lệnh từ bộ nhớ
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

    /**
     * Bật/Tắt chế độ tự động chấp nhận hoàn toàn
     */
    public toggle() {
        this.isEnabled = !this.isEnabled;
        this.context.globalState.update('autoAcceptEnabled', this.isEnabled);
        this.updateStatusBar();

        if (this.isEnabled) {
            this.startAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: ĐÃ BẬT (Bao gồm SSH)');
            this.logService.addLog(LogLevel.Info, 'Đã bật chế độ tự động chấp nhận tất cả', 'Automation');
        } else {
            this.stopAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: ĐÃ TẮT', 'warn');
            this.logService.addLog(LogLevel.Warning, 'Đã tắt chế độ tự động chấp nhận', 'Automation');
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

    /**
     * Bắt đầu vòng lặp tự động hóa
     */
    private startAutomating() {
        if (this.timer) return;

        // Tần suất kiểm tra: 1 giây để đảm bảo phản hồi nhanh nhất
        this.timer = setInterval(async () => {
            if (!this.isEnabled) return;

            // 1. Kiểm tra Quota và tự động chuyển đổi tài khoản
            await this.checkAndSwitchAccount();

            // 2. Duyệt và thực thi tất cả các lệnh chấp nhận (bao gồm cả các bước chứa SSH)
            for (const cmd of this.customCommands) {
                try {
                    // Thực thi lệnh không cần kiểm tra nội dung để đảm bảo tính tự động hoàn toàn
                    await vscode.commands.executeCommand(cmd);
                } catch (e) { }
            }
        }, 1000);
    }

    /**
     * Tự động kiểm tra và chuyển tài khoản khi hết Quota (dưới 1%)
     */
    private async checkAndSwitchAccount() {
        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts();
        const currentAccount = accounts.find(a => a.name === activeEmail);

        if (currentAccount) {
            const quotas = this.quotaService.getCachedQuotas(currentAccount.id);
            if (quotas && quotas.length > 0 && (quotas[0].percent || 0) < 1) {
                this.logService.addLog(LogLevel.Warning, `Tài khoản ${activeEmail} hết quota. Đang tìm tài khoản thay thế...`, 'Automation');

                const replacement = accounts.find(a => {
                    if (a.id === currentAccount.id) return false;
                    const q = this.quotaService.getCachedQuotas(a.id);
                    return q && q.length > 0 && (q[0].percent || 0) > 10;
                });

                if (replacement) {
                    await this.accountService.switchAccount(replacement.id);
                    this.logService.addLog(LogLevel.Success, `Đã tự động chuyển sang: ${replacement.name}`, 'Automation');
                    this.notificationService.notify(`Đã chuyển sang ${replacement.name} do hết quota.`);
                }
            }
        }
    }

    /**
     * Dừng vòng lặp tự động hóa
     */
    private stopAutomating() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

