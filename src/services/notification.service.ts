/* Copyright by AcmaTvirus */
import * as vscode from 'vscode';
import axios from 'axios';

export class NotificationService {
    private readonly CONFIG_KEY_TELEGRAM_TOKEN = 'antigravity.telegramToken';
    private readonly CONFIG_KEY_TELEGRAM_CHATID = 'antigravity.telegramChatId';

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Gửi thông báo cục bộ trong VS Code
     */
    public async notify(message: string, level: 'info' | 'warn' | 'error' = 'info') {
        switch (level) {
            case 'info':
                vscode.window.showInformationMessage(`[Antigravity] ${message}`);
                break;
            case 'warn':
                vscode.window.showWarningMessage(`[Antigravity] ${message}`);
                break;
            case 'error':
                vscode.window.showErrorMessage(`[Antigravity] ${message}`);
                break;
        }

        // Luôn cố gắng gửi thông báo ra bên ngoài nếu có cấu hình
        await this.notifyExternal(message);
    }

    /**
     * Gửi thông báo ra ứng dụng bên thứ 3 (Telegram/Discord)
     */
    private async notifyExternal(message: string) {
        const config = vscode.workspace.getConfiguration();
        const token = config.get<string>(this.CONFIG_KEY_TELEGRAM_TOKEN);
        const chatId = config.get<string>(this.CONFIG_KEY_TELEGRAM_CHATID);

        if (token && chatId) {
            try {
                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                await axios.post(url, {
                    chat_id: chatId,
                    text: `🚀 *Antigravity Agent Alert*\n\n${message}`,
                    parse_mode: 'Markdown'
                });
            } catch (error) {
                console.error('Failed to send Telegram notification', error);
            }
        }
    }
}
