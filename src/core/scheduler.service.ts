/* Copyright by AcmaTvirus */
import * as vscode from 'vscode';
import * as cron from 'node-cron';
import { QuotaService, ModelQuota } from './quota.service';
import { AccountService } from './account.service';

import { LogService, LogLevel } from './log.service';

export class SchedulerService {
    private processedResets: Set<string> = new Set();
    private isWakingUp: boolean = false;

    constructor(
        private context: vscode.ExtensionContext,
        private quotaService: QuotaService,
        private accountService: AccountService,
        private logService: LogService
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
        if (this.isWakingUp) return;
        this.isWakingUp = true;

        try {
            console.log('[Scheduler] Checking Auto Wake-up schedule...');
            const accounts = this.accountService.getAccounts();
            let wakeUpCount = 0;

            for (const account of accounts) {
                const quotas = this.quotaService.getCachedQuotas(account.id);
                if (!quotas || quotas.length === 0) continue;

                for (const model of quotas) {
                    const resetKey = `${account.id}-${model.modelId}-${model.resetTime}`;
                    if (this.processedResets.has(resetKey)) continue;

                    if (this.isResetTimePassed(model)) {
                        console.log(`[Scheduler] Activating model ${model.displayName} for account ${account.name} (Reset time: ${model.resetTime})`);

                        await this.quotaService.refreshAll(true);
                        this.processedResets.add(resetKey);
                        wakeUpCount++;

                        this.logService.addLog(LogLevel.Success, `Auto-activation successful: ${model.displayName} (${model.resetTime})`, 'Scheduler');
                        break;
                    }
                }
            }

            if (wakeUpCount > 0) {
                vscode.window.showInformationMessage(`🚀 Auto Wake-up: Awakened ${wakeUpCount} models that just reset.`);
            }

            if (this.processedResets.size > 200) {
                this.processedResets.clear();
            }
        } catch (e: any) {
            console.error('[Scheduler] Wake-up error:', e.message);
        } finally {
            this.isWakingUp = false;
        }
    }

    private isResetTimePassed(model: ModelQuota): boolean {
        const resetTimeRaw = model.resetTimeRaw;
        const resetTimeStr = model.resetTime;

        if (resetTimeRaw) {
            const now = Date.now();
            const diffMs = now - resetTimeRaw;
            return diffMs >= 0 && diffMs < 30 * 60 * 1000;
        }

        if (!resetTimeStr || resetTimeStr === "Never" || resetTimeStr === "Unknown") return false;
        try {
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
}
