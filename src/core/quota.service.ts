import * as vscode from 'vscode';
import axios from 'axios';
import NodeCache from 'node-cache';
import { AccountService, AccountStatus } from './account.service';
import { ProtobufDecoder } from './protobuf.decoder';
import { LogService, LogLevel } from './log.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';

const execAsync = promisify(exec);

export interface ModelPool {
    id: string;
    displayName: string;
    totalPercent: number;
    models: string[];
}

export interface ModelCapabilities {
    contextWindow: string;
    trainingData: string;
    supportsImage: boolean;
    supportsVideo: boolean;
    supportsThinking: boolean;
}

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
    poolId?: string;
    capabilities?: ModelCapabilities;
}

export class QuotaService {
    private cache: NodeCache;
    private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
    private readonly STORAGE_KEY_PINNED = 'antigravity.pinnedModelId';
    private localConnection: { port: number, token: string } | null = null;

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

    private readonly MODEL_METADATA: Record<string, { capabilities: ModelCapabilities, poolId: string }> = {
        "gemini-3-pro-high": {
            poolId: "gemini-3-pro",
            capabilities: { contextWindow: "2M tokens", trainingData: "Dec 2024", supportsImage: true, supportsVideo: true, supportsThinking: true }
        },
        "gemini-3-pro-low": {
            poolId: "gemini-3-pro",
            capabilities: { contextWindow: "128K tokens", trainingData: "Oct 2024", supportsImage: true, supportsVideo: false, supportsThinking: false }
        },
        "gemini-3-flash": {
            poolId: "gemini-3-flash",
            capabilities: { contextWindow: "1M tokens", trainingData: "Sep 2024", supportsImage: true, supportsVideo: true, supportsThinking: false }
        },
        "claude-sonnet-4-5": {
            poolId: "claude-4-5",
            capabilities: { contextWindow: "200K tokens", trainingData: "Jan 2025", supportsImage: true, supportsVideo: false, supportsThinking: false }
        },
        "claude-sonnet-4-5-thinking": {
            poolId: "claude-4-5",
            capabilities: { contextWindow: "200K tokens", trainingData: "Jan 2025", supportsImage: true, supportsVideo: false, supportsThinking: true }
        },
        "claude-opus-4-5-thinking": {
            poolId: "claude-4-5",
            capabilities: { contextWindow: "400K tokens", trainingData: "Feb 2025", supportsImage: true, supportsVideo: true, supportsThinking: true }
        },
        "gpt-oss-120b-medium": {
            poolId: "gpt-oss",
            capabilities: { contextWindow: "128K tokens", trainingData: "Nov 2024", supportsImage: false, supportsVideo: false, supportsThinking: false }
        }
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
                // Lấy thông tin tài khoản đầy đủ (bao gồm cả data bí mật)
                const fullAccount = await this.accountService.getAccountWithData(account.id);
                if (!fullAccount) continue;

                const freshQuotas = await this.fetchQuotaRealtime(fullAccount);
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

            if (projectId === "local_fallback" && this.localConnection) {
                return await this.fetchLocalQuota(this.localConnection.port, this.localConnection.token);
            }

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

                    const meta = this.MODEL_METADATA[key];

                    result.push({
                        modelId: key,
                        displayName: displayName,
                        used: 100 - remainingPercent,
                        limit: 100,
                        percent: remainingPercent,
                        resetTime: this.formatResetTime(resetTimeRaw),
                        resetTimeRaw: resetTimeRaw ? new Date(resetTimeRaw).getTime() : undefined,
                        poolId: meta?.poolId,
                        capabilities: meta?.capabilities
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
            // Try local fallback if cloud fails
            const local = await this.findLocalAntigravity();
            if (local) {
                this.localConnection = local;
                return "local_fallback";
            }
            return null;
        }
    }

    private async findLocalAntigravity(): Promise<{ port: number, token: string } | null> {
        try {
            const command = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'csrf_token' } | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
            const { stdout } = await execAsync(command, { timeout: 5000 });
            if (!stdout) return null;

            let processes = JSON.parse(stdout);
            if (!Array.isArray(processes)) processes = [processes];

            for (const proc of processes) {
                const cmdLine = proc.CommandLine || '';
                if (!cmdLine.includes('--app_data_dir antigravity')) continue;

                const tokenMatch = cmdLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);
                if (!tokenMatch) continue;

                const token = tokenMatch[1];
                const pid = proc.ProcessId;

                // Scan common ports for this PID
                const portCmd = `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -OwningProcess ${pid} | Select-Object -ExpandProperty LocalPort"`;
                const { stdout: portOut } = await execAsync(portCmd);
                const ports = portOut.match(/\b\d+\b/g)?.map(Number) || [];

                for (const port of ports) {
                    const isApi = await this.testLocalApi(port, token);
                    if (isApi) return { port, token };
                }
            }
        } catch (e) { }
        return null;
    }

    private testLocalApi(port: number, token: string): Promise<boolean> {
        return new Promise((resolve) => {
            const req = https.request({
                hostname: '127.0.0.1', port, path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Codeium-Csrf-Token': token },
                timeout: 1000, rejectUnauthorized: false
            }, (res) => resolve(res.statusCode === 200));
            req.on('error', () => resolve(false));
            req.write(JSON.stringify({ metadata: { ideName: 'antigravity' } }));
            req.end();
        });
    }

    private async fetchLocalQuota(port: number, token: string): Promise<ModelQuota[]> {
        return new Promise((resolve) => {
            const req = https.request({
                hostname: '127.0.0.1', port, path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Codeium-Csrf-Token': token },
                rejectUnauthorized: false
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const models: ModelQuota[] = [];
                        const configs = json.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
                        for (const c of configs) {
                            const p = Math.floor((c.quotaInfo?.remainingFraction || 0) * 100);
                            models.push({
                                modelId: c.modelOrAlias?.model || c.modelOrAlias || 'unknown',
                                displayName: c.label || 'Unknown',
                                used: 100 - p, limit: 100, percent: p,
                                resetTime: "Local Sync"
                            });
                        }
                        resolve(models);
                    } catch (e) { resolve([]); }
                });
            });
            req.on('error', () => resolve([]));
            req.write(JSON.stringify({ metadata: { ideName: 'antigravity' } }));
            req.end();
        });
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

    public async startMonitoring() {
        // Mặc định 60 giây nếu không cấu hình
        const intervalSec = vscode.workspace.getConfiguration('antigravity').get('updateInterval', 60) as number;
        const intervalMs = intervalSec * 1000;

        // Chạy ngay lần đầu
        await this.refreshAll(false);

        // Sau đó chạy định kỳ
        setInterval(() => this.refreshAll(false), intervalMs);
    }

    private async updateStatusBar(quotas: ModelQuota[]) {
        if (quotas.length === 0) return;

        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts();
        const activeAccount = accounts.find(a => a.name === activeEmail);

        if (!activeAccount) return;

        const pools = this.getPools(activeAccount.id);
        const pinnedId = this.context.globalState.get<string>(this.STORAGE_KEY_PINNED);

        let barItem = this.statusBarItems.get('main');
        if (!barItem) {
            barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            barItem.command = 'antigravity.quickPickQuota';
            this.statusBarItems.set('main', barItem);
            barItem.show();
        }

        // Sử dụng pinnedId đã lấy từ đầu hàm
        let displayText = '';
        let hasWarning = false;

        if (pinnedId) {
            const pinnedModel = quotas.find(q => q.modelId === pinnedId);
            if (pinnedModel) {
                const icon = (pinnedModel.percent || 0) < 10 ? '🔴' : ((pinnedModel.percent || 0) < 30 ? '🟡' : '🟢');
                displayText = `${icon} ${pinnedModel.displayName}: ${pinnedModel.percent}%`;
                hasWarning = (pinnedModel.percent || 0) < 10;
            }
        }

        if (!displayText && pools.length > 0) {
            const p = pools[0];
            const icon = p.totalPercent < 10 ? '🔴' : (p.totalPercent < 30 ? '🟡' : '🟢');
            displayText = `${icon} ${p.displayName}: ${p.totalPercent}%`;
            hasWarning = p.totalPercent < 10;
        }

        barItem.text = displayText || 'Antigravity: No Data';
        barItem.tooltip = `Antigravity Quota Monitor - Click to view details`;

        if (hasWarning) barItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
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

    public getPools(accountId: string): ModelPool[] {
        const quotas = this.getCachedQuotas(accountId) || [];
        const pools: Record<string, ModelPool> = {};

        quotas.forEach((q: ModelQuota) => {
            const pId = q.poolId || 'other';
            if (!pools[pId]) {
                pools[pId] = {
                    id: pId,
                    displayName: pId.charAt(0).toUpperCase() + pId.slice(1).replace(/-/g, ' '),
                    totalPercent: 0,
                    models: []
                };
            }
            pools[pId].models.push(q.modelId);
            pools[pId].totalPercent += (q.percent || 0);
        });

        return Object.values(pools).map(p => ({
            ...p,
            totalPercent: Math.floor(p.totalPercent / p.models.length)
        }));
    }

    public getModelDetails(modelId: string) {
        return this.MODEL_METADATA[modelId];
    }
}
