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

        // Scan liên tục mỗi 1s để tìm các nút Accept/Run
        this.timer = setInterval(async () => {
            if (!this.isEnabled) return;

            try {
                // Thử thực thi các lệnh chấp nhận mặc định của VS Code/Antigravity
                // Lưu ý: Các ID command này phụ thuộc vào implementation của Agent core
                // Chúng ta sẽ cố gắng gọi các command phổ biến liên quan đến chấp nhận step.

                await vscode.commands.executeCommand('antigravity.agent.acceptStep');
                await vscode.commands.executeCommand('antigravity.agent.runCommand');
                await vscode.commands.executeCommand('antigravity.agent.saveFile');

            } catch (err) {
                // Bỏ qua lỗi nếu command không tồn tại trong context hiện tại
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
