// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import * as cron from 'node-cron';
import { QuotaService } from './quota.service';

export interface WakeUpTask {
    id: string;
    accountId: string;
    modelId: string;
    schedule: string; // Cron expression
    enabled: boolean;
}

export class SchedulerService {
    private tasks: Map<string, cron.ScheduledTask> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private quotaService: QuotaService
    ) { }

    public start() {
        // Load configurations and start internal cron jobs
        this.initializeDefaultJobs();
    }

    private initializeDefaultJobs() {
        // Ví dụ: Mỗi 1 giờ kiểm tra và wake-up nếu cần
        cron.schedule('0 * * * *', () => {
            if (this.isWithinTimeWindow()) {
                this.performWakeUp();
            }
        });
    }

    private isWithinTimeWindow(): boolean {
        const config = vscode.workspace.getConfiguration('antigravity');
        const workHours = config.get<string>('workHours', '08:00-22:00');
        const [start, end] = workHours.split('-').map(t => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        });

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        return currentMins >= start && currentMins <= end;
    }

    private async performWakeUp() {
        console.log('Performing Auto Wake-up...');
        // logic call API dummy to reset quota
        // log history
        const history = this.context.globalState.get<any[]>('antigravity.wakeUpHistory') || [];
        history.push({
            timestamp: Date.now(),
            status: 'success',
            message: 'Tự động thức tỉnh chu kỳ reset.'
        });
        await this.context.globalState.update('antigravity.wakeUpHistory', history.slice(-50));
    }
}
