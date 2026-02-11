// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { AccountService } from './account.service';
import { QuotaService } from './quota.service';
import { LogService, LogLevel } from './log.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { CdpService } from './cdp.service';

/**
 * Dịch vụ tự động hóa - Phiên bản tối ưu chống nháy và chấp nhận mọi lệnh.
 */
export class AutomationService {
    private isEnabled: boolean = false;
    private statusBarItem: vscode.StatusBarItem;
    private pollTimer: NodeJS.Timeout | null = null;
    private lastState: string = '';

    private readonly customCommands: string[] = [
        // Antigravity & Agent High Priorities
        'antigravity.step.accept', 'antigravity.step.run', 'antigravity.step.approve',
        'antigravity.step.apply', 'antigravity.runCommand', 'antigravity.accept',

        // Native VS Code & Chat
        'chat.acceptAction', 'chat.apply', 'chat.runCommand', 'chat.accept',
        'workbench.action.chat.accept', 'editor.action.inlineChat.accept',
        'workbench.action.acceptServiceInvitation', 'workbench.action.terminal.acceptSmartSelect',

        // AI Tools
        'cursor.accept', 'cursor.run', 'continue.accept', 'continue.run', 'cody.accept', 'cody.run'
    ];

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: LogService,
        private notificationService: NotificationService,
        private analyticsService: AnalyticsService,
        private cdpService: CdpService
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'antigravity.toggleAutoAccept';
        this.isEnabled = this.context.globalState.get<boolean>('autoAcceptEnabled', false);

        this.updateStatusBar(true);
        this.statusBarItem.show();

        if (this.isEnabled) {
            this.startAutomating();
        }
    }

    public toggle() {
        this.isEnabled = !this.isEnabled;
        this.context.globalState.update('autoAcceptEnabled', this.isEnabled);
        this.updateStatusBar(true);

        if (this.isEnabled) {
            this.startAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: ON');
        } else {
            this.stopAutomating();
            this.notificationService.notify('Antigravity Auto-Accept: OFF', 'warn');
        }
    }

    private updateStatusBar(force: boolean = false) {
        const newState = `${this.isEnabled}`;
        if (!force && newState === this.lastState) return;
        this.lastState = newState;

        this.statusBarItem.text = this.isEnabled ? `$(zap) Auto: ON` : `$(x) Auto: OFF`;
        // Hạn chế đổi màu nền để tránh nháy UI (lắc thanh trạng thái)
        this.statusBarItem.backgroundColor = undefined;

        if (this.isEnabled) {
            this.statusBarItem.tooltip = "Auto-Accept is running in Hybrid Mode (CDP + Native)";
        } else {
            this.statusBarItem.tooltip = "Auto-Accept is disabled";
        }
    }

    private async startAutomating() {
        if (this.pollTimer) return;

        // 1. CDP Engine (Silent & Targetted)
        await this.cdpService.start();

        // 2. Tần suất 3 giây - Tối ưu cho độ ổn định
        this.pollTimer = setInterval(async () => {
            if (!this.isEnabled) return;

            // Xử lý Quota và chuyển đổi tài khoản
            if (Math.random() > 0.95) await this.checkAndSwitchAccount();

            // Native Commands đã bị loại bỏ để tránh chiếm quyền điều khiển UI (Focus Stealing)
            /*
            for (const cmd of this.customCommands) {
                try {
                    await vscode.commands.executeCommand(cmd);
                } catch (e) { }
            }
            */

            // Giao thức CDP để tương tác mức thấp (Chống treo AI)
            // Chúng ta có thể gửi lệnh Enter định kỳ nếu AI đang chờ input mà không làm gì
        }, 3000);
    }

    private async checkAndSwitchAccount() {
        try {
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
                    }
                }
            }
        } catch (e) { }
    }

    private stopAutomating() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.cdpService.stop();
    }
}
