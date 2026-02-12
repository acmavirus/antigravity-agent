/* Copyright by AcmaTvirus */
import * as vscode from 'vscode';

export interface UsageData {
    timestamp: number;
    accountId: string;
    tokens: number;
    requests: number;
}

export class AnalyticsService {
    private storage: UsageData[] = [];
    private readonly STORAGE_KEY = 'antigravity.analytics';

    constructor(private context: vscode.ExtensionContext) {
        this.loadData();
    }

    private loadData() {
        const data = this.context.globalState.get<string>(this.STORAGE_KEY);
        if (data) {
            try {
                this.storage = JSON.parse(data);
            } catch (e) {
                this.storage = [];
            }
        }
    }

    private async saveData() {
        await this.context.globalState.update(this.STORAGE_KEY, JSON.stringify(this.storage));
    }

    public async trackUsage(accountId: string, tokens: number, requests: number = 1) {
        const entry: UsageData = {
            timestamp: Date.now(),
            accountId,
            tokens,
            requests
        };

        this.storage.push(entry);

        // Giữ lại dữ liệu trong vòng 30 ngày (ví dụ)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        this.storage = this.storage.filter(d => d.timestamp > thirtyDaysAgo);

        await this.saveData();
    }

    public getUsageByAccount(accountId: string): UsageData[] {
        return this.storage.filter(d => d.accountId === accountId);
    }

    public getAllUsage(): UsageData[] {
        return this.storage;
    }

    /**
     * Tổng hợp dữ liệu theo ngày để vẽ biểu đồ
     */
    public getUsageHistory(days: number = 7) {
        const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filtered = this.storage.filter(d => d.timestamp > threshold);

        const map = new Map<string, { tokens: number, requests: number }>();

        filtered.forEach(d => {
            const dateObj = new Date(d.timestamp);
            // Sử dụng định dạng YYYY-MM-DD để đồng bộ
            const date = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

            const current = map.get(date) || { tokens: 0, requests: 0 };
            map.set(date, {
                tokens: current.tokens + d.tokens,
                requests: current.requests + d.requests
            });
        });

        // Sắp xếp theo ngày
        return Array.from(map.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
