import * as vscode from 'vscode';
import axios from 'axios';
import NodeCache from 'node-cache';
import { AccountService, AccountStatus } from './account.service';
import { ProtobufDecoder } from './protobuf.decoder';
import { LogService, LogLevel } from './log.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';

export interface ModelQuota {
    modelId: string;
    displayName: string;
    used: number;
    limit: number;
    percent?: number;
    resetTime: string;
    resetTimeRaw?: number;
    groupLabel?: string;
    isPinned?: boolean;
}

export class QuotaService {
    private cache: NodeCache;
    private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
    private readonly STORAGE_KEY_PINNED = 'antigravity.pinnedModelId';

    // ... (URL và ID giữ nguyên)
    private readonly BASE_URL = "https://daily-cloudcode-pa.sandbox.googleapis.com";
    private readonly TOKEN_URL = "https://oauth2.googleapis.com/token";
    private readonly CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
    private readonly CLIENT_SECRET = "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";

    private readonly TARGET_MODELS: Record<string, string> = {
        "gemini-3-pro-high": "Gemini 3 Pro (High)",
        "gemini-3-pro-low": "Gemini 3 Pro (Low)",
        "gemini-3-flash": "Gemini 3 Flash",
        "claude-sonnet-4-5": "Claude Sonnet 4.5",
        "claude-sonnet-4-5-thinking": "Claude Sonnet 4.5 (Thinking)",
        "claude-opus-4-5-thinking": "Claude Opus 4.5 (Thinking)",
        "gpt-oss-120b-medium": "GPT-OSS 120B (Medium)",
    };

    private readonly STORAGE_KEY_QUOTAS = 'antigravity.quotas';

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private logService: LogService,
        private notificationService: NotificationService,
        private analyticsService: AnalyticsService
    ) {
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
        this.loadPersistentQuotas();
    }

    private loadPersistentQuotas() {
        const data = this.context.globalState.get<Record<string, ModelQuota[]>>(this.STORAGE_KEY_QUOTAS);
        if (data) {
            for (const [accountId, quotas] of Object.entries(data)) {
                this.cache.set(accountId, quotas);
            }
        }
    }

    private async savePersistentQuotas() {
        const allQuotas: Record<string, ModelQuota[]> = {};
        const keys = this.cache.keys();
        for (const key of keys) {
            const val = this.cache.get<ModelQuota[]>(key);
            if (val) allQuotas[key] = val;
        }
        await this.context.globalState.update(this.STORAGE_KEY_QUOTAS, allQuotas);
    }

    public async refreshAll(forceAll: boolean = false) {
        const accounts = this.accountService.getAccounts();
        const activeEmail = forceAll ? null : await this.accountService.getActiveEmail();

        for (const account of accounts) {
            if (account.status === AccountStatus.Forbidden) continue;

            // Nếu không phải forceAll, chỉ cập nhật tài khoản đang active
            if (!forceAll && activeEmail && account.name !== activeEmail) {
                continue;
            }

            try {
                const freshQuotas = await this.fetchQuotaRealtime(account);
                if (freshQuotas && freshQuotas.length > 0) {
                    const existingQuotas = this.getCachedQuotas(account.id) || [];

                    // Thực hiện UPDATE thay vì xóa đi tạo lại
                    const updatedQuotas = [...existingQuotas];
                    freshQuotas.forEach(newQ => {
                        const index = updatedQuotas.findIndex(q => q.modelId === newQ.modelId);
                        if (index !== -1) {
                            // Cập nhật các trường dữ liệu mới
                            updatedQuotas[index] = { ...updatedQuotas[index], ...newQ };
                        } else {
                            // Nếu model mới thì thêm vào
                            updatedQuotas.push(newQ);
                        }

                        // Track usage nếu có sự thay đổi (giả định dùng tokens)
                        this.analyticsService.trackUsage(account.id, 10); // Mock 10 tokens mỗi lần cập nhật
                    });

                    this.cache.set(account.id, updatedQuotas);
                    await this.savePersistentQuotas();

                    if (!forceAll || account.name === activeEmail) {
                        this.updateStatusBar(updatedQuotas);
                    }

                    this.logService.addLog(LogLevel.Info, `Updated quotas for ${account.name}`, 'Quota');
                }
            } catch (error: any) {
                this.logService.addLog(LogLevel.Error, `Error refreshing quota for ${account.name}: ${error.message}`, 'Quota');
                if (error.response?.status === 403) {
                    await this.accountService.updateStatus(account.id, AccountStatus.Forbidden);
                    this.notificationService.notify(`Account ${account.name} access denied (403)!`, 'error');
                }
            }
        }
    }

    private async fetchQuotaRealtime(account: any): Promise<ModelQuota[]> {
        if (!account.data || !account.data.raw) {
            return this.getMockQuotas();
        }

        const session = ProtobufDecoder.decode(account.data.raw);
        if (!session || !session.auth) return [];

        let accessToken = session.auth.access_token;
        const idToken = session.auth.id_token;

        try {
            let projectId = await this.fetchProjectId(accessToken);
            if (!projectId) {
                accessToken = await this.refreshAccessToken(idToken);
                if (accessToken) {
                    projectId = await this.fetchProjectId(accessToken);
                }
            }

            if (!projectId || !accessToken) return [];

            const response = await axios.post(
                `${this.BASE_URL}/v1internal:fetchAvailableModels`,
                { project: projectId },
                {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                        "User-Agent": "antigravity/windows/amd64",
                    }
                }
            );

            const rawModels = response.data.models || {};
            const result: ModelQuota[] = [];

            for (const [key, displayName] of Object.entries(this.TARGET_MODELS)) {
                const modelInfo = rawModels[key];
                if (modelInfo && modelInfo.quotaInfo) {
                    const qi = modelInfo.quotaInfo;
                    const fraction = typeof qi.remainingFraction === 'number' ? qi.remainingFraction : 0;
                    const resetTimeRaw = qi.resetTime || "";

                    const remainingPercent = Math.floor(fraction * 100);

                    result.push({
                        modelId: key,
                        displayName: displayName,
                        used: 100 - remainingPercent,
                        limit: 100,
                        percent: remainingPercent,
                        resetTime: this.formatResetTime(resetTimeRaw),
                        resetTimeRaw: resetTimeRaw ? new Date(resetTimeRaw).getTime() : undefined
                    });
                }
            }
            return result;
        } catch (e) {
            return [];
        }
    }

    private async refreshAccessToken(idToken: string): Promise<string | null> {
        try {
            const response = await axios.post(this.TOKEN_URL, {
                client_id: this.CLIENT_ID,
                client_secret: this.CLIENT_SECRET,
                refresh_token: idToken,
                grant_type: "refresh_token",
            });
            return response.data.access_token || null;
        } catch (e) {
            return null;
        }
    }

    private async fetchProjectId(accessToken: string): Promise<string | null> {
        try {
            const response = await axios.post(
                `${this.BASE_URL}/v1internal:loadCodeAssist`,
                { metadata: { ideType: "ANTIGRAVITY" } },
                {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                        "User-Agent": "antigravity/windows/amd64",
                    }
                }
            );
            return response.data.cloudaicompanionProject || response.data.project || response.data.projectId || null;
        } catch (e) {
            return null;
        }
    }

    private formatResetTime(iso: string): string {
        if (!iso) return "Unknown";
        try {
            const date = new Date(iso);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + " " + date.toLocaleDateString('en-US');
        } catch (e) {
            return iso;
        }
    }

    private getMockQuotas(): ModelQuota[] {
        return [{ modelId: 'mock-1', displayName: 'Mock Gemini', used: 0, limit: 100, percent: 100, resetTime: "Never" }];
    }

    public startMonitoring() {
        // Mặc định 60 giây nếu không cấu hình
        const interval = (vscode.workspace.getConfiguration('antigravity').get('updateInterval', 60) as number) * 1000;
        setInterval(() => this.refreshAll(false), interval);
        this.refreshAll(false);
    }

    private updateStatusBar(quotas: ModelQuota[]) {
        if (quotas.length === 0) return;

        const pinnedId = this.context.globalState.get<string>(this.STORAGE_KEY_PINNED);
        let selected = quotas.find(q => q.modelId === pinnedId) || quotas[0];

        let barItem = this.statusBarItems.get('main');
        if (!barItem) {
            barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            barItem.command = 'antigravity.pinModel';
            this.statusBarItems.set('main', barItem);
            barItem.show();
        }

        const p = selected.percent || 0;
        barItem.text = `$(pulse) ${selected.displayName}: ${p}%`;
        barItem.tooltip = `Click to change displayed Model. Current: ${selected.displayName}`;

        if (p < 10) barItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        else if (p < 30) barItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        else barItem.backgroundColor = undefined;
    }

    public async pinModel() {
        const accounts = this.accountService.getAccounts();
        const activeEmail = await this.accountService.getActiveEmail();
        const items: any[] = [];

        for (const account of accounts) {
            // Chỉ hiển thị model của tài khoản đang active
            if (activeEmail && account.name !== activeEmail) continue;

            const qs = this.cache.get<ModelQuota[]>(account.id);
            if (qs) {
                qs.forEach(q => {
                    items.push({ label: q.displayName, description: `${account.name} (${q.percent}%)`, id: q.modelId });
                });
            }
        }

        if (items.length === 0) {
            vscode.window.showInformationMessage('Please Refresh to update the model list for the current account.');
            return;
        }

        const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select Model to display on the status bar' });
        if (picked) {
            await this.context.globalState.update(this.STORAGE_KEY_PINNED, picked.id);
            // Cập nhật ngay hạn mức khi người dùng đổi model
            await this.refreshAll(false);
        }
    }

    public getCachedQuotas(accountId: string): ModelQuota[] | undefined {
        return this.cache.get(accountId);
    }
}
