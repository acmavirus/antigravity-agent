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

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Agent is now active!');

    // Initialize Base Services
    const logService = new LogService(context);
    const notificationService = new NotificationService(context);
    const analyticsService = new AnalyticsService(context);
    const accountService = new AccountService(context);

    // Initialize Business Services
    const quotaService = new QuotaService(context, accountService, logService, notificationService, analyticsService);
    const schedulerService = new SchedulerService(context, quotaService, accountService, logService);
    const automationService = new AutomationService(context, accountService, quotaService, logService, notificationService);

    // Initialize UI Providers
    const dashboardProvider = new DashboardProvider(context.extensionUri, quotaService, accountService, logService, analyticsService);

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
            vscode.window.showInformationMessage('Đang làm mới hạn mức...');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity.addAccount', async () => {
            const input = await vscode.window.showInputBox({
                prompt: 'Nhập nội dung tài khoản (JSON hoặc Key)',
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
    quotaService.startMonitoring();
    schedulerService.start();
}

export function deactivate() {
    // Cleanup if needed
}
