/* Copyright by AcmaTvirus */
import * as vscode from 'vscode';

export class AutomationService {
    private isEnabled: boolean = true;
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | null = null;

    constructor(private context: vscode.ExtensionContext) {
        // Khởi tạo Status Bar Item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'antigravity.toggleAutoAccept';
        this.updateStatusBar();
        this.statusBarItem.show();

        // Load trạng thái cũ
        this.isEnabled = this.context.globalState.get<boolean>('autoAcceptEnabled', true);
        this.updateStatusBar();

        if (this.isEnabled) {
            this.startAutomating();
        }
    }

    public toggle() {
        this.isEnabled = !this.isEnabled;
        this.context.globalState.update('autoAcceptEnabled', this.isEnabled);
        this.updateStatusBar();

        if (this.isEnabled) {
            this.startAutomating();
            vscode.window.showInformationMessage('🚀 Antigravity Auto-Accept: BẬT');
        } else {
            this.stopAutomating();
            vscode.window.showWarningMessage('🛑 Antigravity Auto-Accept: TẮT');
        }
    }

    private updateStatusBar() {
        if (this.isEnabled) {
            this.statusBarItem.text = `$(check) Auto-Accept: ON`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.remoteBackground');
            this.statusBarItem.tooltip = 'Click để TẮT Tự động chấp nhận';
        } else {
            this.statusBarItem.text = `$(x) Auto-Accept: OFF`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = 'Click để BẬT Tự động chấp nhận';
        }
    }

    private startAutomating() {
        if (this.timer) return;

        // Quét liên tục mỗi 1s
        this.timer = setInterval(async () => {
            if (!this.isEnabled) return;

            // Danh sách các ID command tiềm năng của Antigravity Agent Core
            const potentialCommands = [
                'antigravity.step.accept',
                'antigravity.step.run',
                'antigravity.step.approve',
                'antigravity.step.apply',
                'antigravity.acceptAll',
                'antigravity.accept',
                'antigravity.agent.acceptStep',
                'aipr.accept',
                'aipr.continue',
                'cortex.acceptAll',
                'cortex.runCommand'
            ];

            for (const cmd of potentialCommands) {
                try {
                    // Cố gắng thực thi lệnh mà không cần đối số (Accept All/Current)
                    await vscode.commands.executeCommand(cmd);
                } catch (e) {
                    // Lệnh không tồn tại hoặc lỗi thực thi, bỏ qua
                }
            }
        }, 1000);
    }

    private stopAutomating() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
