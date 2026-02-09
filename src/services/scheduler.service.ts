/* Copyright by AcmaTvirus */
import * as vscode from 'vscode';
import * as cron from 'node-cron';
import { QuotaService, ModelQuota } from './quota.service';
import { AccountService } from './account.service';

export class SchedulerService {
    private processedResets: Set<string> = new Set();

    constructor(
        private context: vscode.ExtensionContext,
        private quotaService: QuotaService,
        private accountService: AccountService
    ) { }

    public start() {
        // Kiểm tra mỗi phút
        cron.schedule('* * * * *', () => {
            if (this.isAutoWakeupEnabled()) {
                this.performWakeUp();
            }
        });

        // Chạy thử ngay khi khởi động
        if (this.isAutoWakeupEnabled()) {
            this.performWakeUp();
        }
    }

    private isAutoWakeupEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('antigravity');
        const enabled = config.get<boolean>('enableAutoWakeup', true);
        if (!enabled) return false;

        const workHoursOnly = config.get<boolean>('workHoursOnly', false);
        if (!workHoursOnly) return true;

        return this.isWithinTimeWindow();
    }

    private isWithinTimeWindow(): boolean {
        const config = vscode.workspace.getConfiguration('antigravity');
        const workHours = config.get<string>('workHours', '08:00-22:00');
        try {
            const [start, end] = workHours.split('-').map(t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            });

            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            return currentMins >= start && currentMins <= end;
        } catch (e) {
            return true;
        }
    }

    private async performWakeUp() {
        console.log('[Scheduler] Đang kiểm tra lịch trình Auto Wake-up...');
        const accounts = this.accountService.getAccounts();
        let wakeUpCount = 0;

        for (const account of accounts) {
            const quotas = this.quotaService.getCachedQuotas(account.id);
            if (!quotas || quotas.length === 0) continue;

            for (const model of quotas) {
                // Key định danh cho mốc reset này: accountId + modelId + resetTime
                const resetKey = `${account.id}-${model.modelId}-${model.resetTime}`;

                if (this.processedResets.has(resetKey)) continue;

                if (this.isResetTimePassed(model)) {
                    console.log(`[Scheduler] Kích hoạt model ${model.displayName} cho tài khoản ${account.name} (Reset time: ${model.resetTime})`);

                    await this.quotaService.refreshAll(true);
                    this.processedResets.add(resetKey);
                    wakeUpCount++;

                    this.logHistory(account.name, model.displayName, `Kích hoạt tự động thành công: ${model.resetTime}`);

                    // Giới hạn chỉ log 1 lần cho mỗi đợt quét của tài khoản
                    break;
                }
            }
        }

        if (wakeUpCount > 0) {
            vscode.window.showInformationMessage(`🚀 Auto Wake-up: Đã thức tỉnh ${wakeUpCount} model vừa reset.`);
        }

        // Dọn dẹp bộ nhớ đệm resetKey cũ (quá 24h)
        if (this.processedResets.size > 100) {
            this.processedResets.clear();
        }
    }

    private isResetTimePassed(model: ModelQuota): boolean {
        const resetTimeRaw = model.resetTimeRaw;
        const resetTimeStr = model.resetTime;

        if (resetTimeRaw) {
            const now = Date.now();
            const diffMs = now - resetTimeRaw;
            // Chấp nhận nếu đã qua ít nhất 0ms và không quá 30 phút
            return diffMs >= 0 && diffMs < 30 * 60 * 1000;
        }

        if (!resetTimeStr || resetTimeStr === "Never" || resetTimeStr === "Không rõ") return false;
        try {
            // Fallback parsing logic
            const parts = resetTimeStr.split(' ');
            if (parts.length < 2) return false;

            const [time, date] = parts;
            const [hh, mm] = time.split(':').map(Number);
            const [dd, month, yyyy] = date.split('/').map(Number);

            const resetDate = new Date(yyyy, month - 1, dd, hh, mm);
            const now = new Date();

            const diffMs = now.getTime() - resetDate.getTime();
            return diffMs >= 0 && diffMs < 30 * 60 * 1000;
        } catch (e) {
            return false;
        }
    }

    private async logHistory(account: string, model: string, message: string) {
        const history = this.context.globalState.get<any[]>('antigravity.wakeUpHistory') || [];
        history.push({
            timestamp: Date.now(),
            account,
            model,
            status: 'success',
            message
        });
        await this.context.globalState.update('antigravity.wakeUpHistory', history.slice(-50));
    }
}
