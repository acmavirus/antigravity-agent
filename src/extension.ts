// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { AccountService } from './services/account.service';
import { QuotaService } from './services/quota.service';
import { SchedulerService } from './services/scheduler.service';
import { DashboardProvider } from './views/dashboard.provider';
import { AutomationService } from './services/automation.service';
import { LogService, LogLevel } from './services/log.service';
import { NotificationService } from './services/notification.service';
import { AnalyticsService } from './services/analytics.service';
import { CdpService } from './services/cdp.service';
import { WebServerService } from './services/webserver.service';

export function activate(context: vscode.ExtensionContext) {
    try {
        console.log('Antigravity Agent is activating...');

        // Initialize Base Services
        const logService = new LogService(context);
        const notificationService = new NotificationService(context);
        const analyticsService = new AnalyticsService(context);
        const accountService = new AccountService(context);
        const cdpService = new CdpService(context);

        // Initialize Business Services
        const quotaService = new QuotaService(context, accountService, logService, notificationService, analyticsService);
        const schedulerService = new SchedulerService(context, quotaService, accountService, logService);

        // Web Server for Mobile
        const webServer = new WebServerService(context, accountService, quotaService, logService, analyticsService, cdpService);
        webServer.start();

        // Automation Service now has async initialization inside (non-blocking)
        const automationService = new AutomationService(context, accountService, quotaService, logService, notificationService, analyticsService, cdpService);

        // Initialize UI Providers
        const dashboardProvider = new DashboardProvider(context.extensionUri, quotaService, accountService, logService, analyticsService, cdpService);

        // Register Webview View
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                'antigravity-dashboard',
                dashboardProvider
            )
        );

        // Register Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('antigravity.refreshQuota', () => {
                quotaService.refreshAll();
                vscode.window.showInformationMessage('Refreshing quotas...');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('antigravity.addAccount', async () => {
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter account content (JSON or Key)',
                    placeHolder: '{"api_key": "..."}'
                });
                if (input) {
                    await accountService.addAccount(input);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('antigravity.pinModel', () => {
                quotaService.pinModel();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('antigravity.toggleAutoAccept', () => {
                automationService.toggle();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('antigravity.quickPickQuota', async () => {
                const accounts = accountService.getAccounts();
                const activeEmail = await accountService.getActiveEmail();
                const activeAccount = accounts.find(a => a.name === activeEmail);

                if (!activeAccount) {
                    vscode.window.showErrorMessage('No active account found.');
                    return;
                }

                const quotas = quotaService.getCachedQuotas(activeAccount.id) || [];
                const pools = quotaService.getPools(activeAccount.id);

                const items: vscode.QuickPickItem[] = [];

                // Helper để tạo thanh tiến trình văn bản
                const getBar = (p: number) => {
                    const size = 10;
                    const filled = Math.round((p / 100) * size);
                    return '[' + '█'.repeat(filled) + '░'.repeat(size - filled) + ']';
                };

                // Helper tính thời gian còn lại
                const getTimeRemaining = (raw?: number) => {
                    if (!raw) return 'N/A';
                    const diff = raw - Date.now();
                    if (diff <= 0) return '0h 0m';
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    return `${h}h ${m}m`;
                };

                // Thêm các Pool (Gom nhóm)
                if (pools.length > 0) {
                    items.push({ label: 'QUOTA POOLS', kind: vscode.QuickPickItemKind.Separator });
                    pools.forEach(p => {
                        items.push({
                            label: `🟢 ${p.displayName}`,
                            description: `${getBar(p.totalPercent)} ${p.totalPercent.toFixed(2)}% -> ${getTimeRemaining(quotas.find(q => q.poolId === p.id)?.resetTimeRaw)}`,
                        });
                    });
                }

                // Thêm chi tiết từng Model
                items.push({ label: 'INDIVIDUAL MODELS', kind: vscode.QuickPickItemKind.Separator });
                quotas.forEach(q => {
                    items.push({
                        label: `🟢 ${q.displayName}`,
                        description: `${getBar(q.percent || 0)} ${(q.percent || 0).toFixed(2)}% -> ${getTimeRemaining(q.resetTimeRaw)}`,
                    });
                });

                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Click to open Quota Monitor',
                    title: `🚀 Antigravity Quota Monitor | ${activeAccount.name.includes('@') ? 'Google AI Pro' : activeAccount.name}`
                });

                if (picked && picked.label.includes('🟢')) {
                    const modelName = picked.label.replace('🟢 ', '');
                    const model = quotas.find(q => q.displayName === modelName);
                    if (model) {
                        await context.globalState.update('antigravity.pinnedModelId', model.modelId);
                        quotaService.refreshAll(false);
                    }
                }
            })
        );

        // Initial load - Thêm delay 2s để IDE khởi tạo xong Language Server
        setTimeout(() => {
            quotaService.startMonitoring().catch(err => console.error('Quota monitoring failed:', err));
            schedulerService.start();
            console.log('Antigravity Agent background services started.');
        }, 2000);

        console.log('Antigravity Agent activation completed.');
    } catch (e) {
        console.error('Antigravity Agent failed to activate:', e);
        vscode.window.showErrorMessage('Antigravity Agent failed to activate. Check console for details.');
    }
}

export function deactivate() {
    // Cleanup if needed
}
