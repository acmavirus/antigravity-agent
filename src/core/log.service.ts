/* Copyright by AcmaTvirus */
import * as vscode from 'vscode';

export enum LogLevel {
    Info = 'INFO',
    Success = 'SUCCESS',
    Warning = 'WARN',
    Error = 'ERROR'
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    source: string;
}

export class LogService {
    private logs: LogEntry[] = [];
    private readonly MAX_LOGS = 500;
    private readonly STORAGE_KEY = 'antigravity.logs';
    private _onDidChangeLogs = new vscode.EventEmitter<void>();
    public readonly onDidChangeLogs = this._onDidChangeLogs.event;

    constructor(private context: vscode.ExtensionContext) {
        this.loadLogs();
    }

    private loadLogs() {
        const data = this.context.globalState.get<string>(this.STORAGE_KEY);
        if (data) {
            try {
                this.logs = JSON.parse(data);
            } catch (e) {
                this.logs = [];
            }
        }
    }

    private async saveLogs() {
        await this.context.globalState.update(this.STORAGE_KEY, JSON.stringify(this.logs));
        this._onDidChangeLogs.fire();
    }

    public async addLog(level: LogLevel, message: string, source: string = 'System') {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            source
        };

        this.logs.unshift(entry); // Thêm vào đầu danh sách

        // Giới hạn số lượng log
        if (this.logs.length > this.MAX_LOGS) {
            this.logs = this.logs.slice(0, this.MAX_LOGS);
        }

        await this.saveLogs();
    }

    public getLogs(): LogEntry[] {
        return this.logs;
    }

    public async clearLogs() {
        this.logs = [];
        await this.saveLogs();
    }
}
