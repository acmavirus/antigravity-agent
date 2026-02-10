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

        // Initial load
        // Run async tasks without awaiting effectively runs them in background
        quotaService.startMonitoring().catch(err => console.error('Quota monitoring failed:', err));
        schedulerService.start();

        console.log('Antigravity Agent activation completed.');
    } catch (e) {
        console.error('Antigravity Agent failed to activate:', e);
        vscode.window.showErrorMessage('Antigravity Agent failed to activate. Check console for details.');
    }
}

export function deactivate() {
    // Cleanup if needed
}
