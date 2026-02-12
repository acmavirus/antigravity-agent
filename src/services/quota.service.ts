// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import NodeCache from 'node-cache';
import * as path from 'path';
import * as fs from 'fs';
import { AccountService } from './account.service';
import { AccountStatus, Account } from '../interfaces/account.interface';
import { Logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { ModelQuota, ModelPool } from '../interfaces/quota.interface';
import { IAiProvider } from '../interfaces/ai-provider.interface';
import { AntigravityProvider } from './providers/antigravity.provider';
import { MODEL_METADATA } from '../config/models.config';

export class QuotaService {
    private cache: NodeCache;
    private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
    private readonly STORAGE_KEY_PINNED = 'antigravity.pinnedModelId';
    private lastRefreshTime: number = 0;
    private readonly REFRESH_THROTTLE = 60000; // 1 minute
    private readonly STORAGE_KEY_QUOTAS = 'antigravity.quotas';
    
    private providers: Map<string, IAiProvider> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private logService: Logger,
        private notificationService: NotificationService,
        private analyticsService: AnalyticsService
    ) {
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
        
        // Register Providers
        this.registerProvider('default', new AntigravityProvider());
        
        this.loadPersistentQuotas();
    }
    
    public registerProvider(name: string, provider: IAiProvider) {
        this.providers.set(name, provider);
    }
    
    private getProvider(account: Account): IAiProvider { // eslint-disable-line @typescript-eslint/no-unused-vars
        // Có thể mở rộng logic để chọn provider dựa trên account.type
        // Ví dụ: if (account.type === 'openai') return this.providers.get('openai');
        return this.providers.get('default')!;
    }

    private get quotaFilePath(): string {
        return path.join(this.context.globalStorageUri.fsPath, 'quotas.json');
    }

    private async loadPersistentQuotas() {
        try {
            if (!fs.existsSync(this.context.globalStorageUri.fsPath)) {
                await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
            }

            if (fs.existsSync(this.quotaFilePath)) {
                const content = fs.readFileSync(this.quotaFilePath, 'utf8');
                const data = JSON.parse(content);
                for (const [accountId, quotas] of Object.entries(data)) {
                    this.cache.set(accountId, quotas);
                }
            } else {
                const data = this.context.globalState.get<Record<string, ModelQuota[]>>(this.STORAGE_KEY_QUOTAS);
                if (data) {
                    for (const [accountId, quotas] of Object.entries(data)) {
                        this.cache.set(accountId, quotas);
                    }
                    await this.savePersistentQuotas();
                }
            }
        } catch (e) {
            console.error('Error loading persistent quotas:', e);
        }
    }

    private async savePersistentQuotas() {
        try {
            const allQuotas: Record<string, ModelQuota[]> = {};
            const keys = this.cache.keys();
            for (const key of keys) {
                const val = this.cache.get<ModelQuota[]>(key);
                if (val) {
                    allQuotas[key] = val;
                }
            }

            fs.writeFileSync(this.quotaFilePath, JSON.stringify(allQuotas), 'utf8');

            if (this.context.globalState.get(this.STORAGE_KEY_QUOTAS)) {
                await this.context.globalState.update(this.STORAGE_KEY_QUOTAS, undefined);
            }
        } catch (e) {
            console.error('Error saving persistent quotas:', e);
        }
    }

    public async refreshAll(forceAll = false) {
        const now = Date.now();
        if (!forceAll && (now - this.lastRefreshTime) < this.REFRESH_THROTTLE) {
            return;
        }
        this.lastRefreshTime = now;

        const accounts = this.accountService.getAccounts();
        const activeEmail = forceAll ? null : await this.accountService.getActiveEmail();
        let hasUpdates = false;

        for (const account of accounts) {
            if (account.status === AccountStatus.Forbidden) {
                continue;
            }

            if (!forceAll && activeEmail && account.name !== activeEmail) {
                continue;
            }

            try {
                const fullAccount = await this.accountService.getAccountWithData(account.id);
                if (!fullAccount) {
                    continue;
                }

                const provider = this.getProvider(fullAccount);
                const freshQuotas = await provider.getQuota(fullAccount);
                
                if (freshQuotas && freshQuotas.length > 0) {
                    const updatedQuotas = freshQuotas;
                    this.analyticsService.trackUsage(account.id, 10);
                    this.cache.set(account.id, updatedQuotas);
                    hasUpdates = true;

                    if (!forceAll || account.name === activeEmail) {
                        this.updateStatusBar(updatedQuotas);
                    }
                    this.logService.info(`Refreshed ${updatedQuotas.length} quotas for ${account.name}`, 'Quota');
                }
            } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                this.logService.error(`Error refreshing quota for ${account.name}: ${error.message}`, 'Quota');
                if (error.response?.status === 403) {
                    await this.accountService.updateStatus(account.id, AccountStatus.Forbidden);
                    this.notificationService.notify(`Account ${account.name} access denied (403)!`, 'error');
                }
            }
        }

        if (hasUpdates) {
            await this.savePersistentQuotas();
        }
    }

    public async startMonitoring() {
        const intervalSec = vscode.workspace.getConfiguration('antigravity').get('updateInterval', 60) as number;
        const intervalMs = intervalSec * 1000;
        await this.refreshAll(false);
        setInterval(() => this.refreshAll(false), intervalMs);
    }

    private async updateStatusBar(quotas: ModelQuota[]) {
        if (quotas.length === 0) {
            return;
        }
        const activeEmail = await this.accountService.getActiveEmail();
        const accounts = this.accountService.getAccounts();
        const activeAccount = accounts.find(a => a.name === activeEmail);
        if (!activeAccount) {
            return;
        }

        const pools = this.getPools(activeAccount.id);
        const pinnedId = this.context.globalState.get<string>(this.STORAGE_KEY_PINNED);

        let barItem = this.statusBarItems.get('main');
        if (!barItem) {
            barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            barItem.command = 'antigravity.quickPickQuota';
            this.statusBarItems.set('main', barItem);
            barItem.show();
        }

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
        if (hasWarning) {
            barItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else {
            barItem.backgroundColor = undefined;
        }
    }

    public async pinModel() {
        const accounts = this.accountService.getAccounts();
        const activeEmail = await this.accountService.getActiveEmail();
        const items: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

        for (const account of accounts) {
            if (activeEmail && account.name !== activeEmail) {
                continue;
            }
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
            await this.refreshAll(true);
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
        return MODEL_METADATA[modelId];
    }
}
