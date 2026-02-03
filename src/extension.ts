// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { AccountService } from './services/account.service';
import { QuotaService } from './services/quota.service';
import { SchedulerService } from './services/scheduler.service';
import { DashboardProvider } from './views/dashboard.provider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Agent is now active!');

    // Initialize Services
    const accountService = new AccountService(context);
    const quotaService = new QuotaService(context, accountService);
    const schedulerService = new SchedulerService(context, quotaService);

    // Initialize UI Providers
    const dashboardProvider = new DashboardProvider(context.extensionUri, quotaService, accountService);

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

    // Initial load
    quotaService.startMonitoring();
    schedulerService.start();
}

export function deactivate() {
    // Cleanup if needed
}
