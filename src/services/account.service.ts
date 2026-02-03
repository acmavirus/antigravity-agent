// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { Mutex } from 'async-mutex';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { ProtobufDecoder } from './protobuf.decoder';

export enum AccountStatus {
    Active = 'active',
    Expired = 'expired',
    Forbidden = 'forbidden',
    Unknown = 'unknown'
}

export interface Account {
    id: string;
    name: string;
    type: 'google' | 'json' | 'key' | 'client';
    data: any;
    status: AccountStatus;
    lastChecked: number;
}

export class AccountService {
    private accounts: Account[] = [];
    private mutex = new Mutex();
    private readonly STORAGE_KEY = 'antigravity.accounts';

    constructor(private context: vscode.ExtensionContext) {
        this.loadAccounts();
    }

    private loadAccounts() {
        const data = this.context.globalState.get<string>(this.STORAGE_KEY);
        if (data) {
            try {
                this.accounts = JSON.parse(data);
            } catch (e) {
                this.accounts = [];
            }
        }
    }

    private async saveAccounts() {
        await this.context.globalState.update(this.STORAGE_KEY, JSON.stringify(this.accounts));
    }

    public getAccounts(): Account[] {
        return this.accounts;
    }

    public async addAccount(input: string) {
        const release = await this.mutex.acquire();
        try {
            let newAccount: Account;
            if (input.startsWith('{')) {
                const data = JSON.parse(input);
                newAccount = {
                    id: Date.now().toString(),
                    name: data.name || `Account ${this.accounts.length + 1}`,
                    type: 'json',
                    data: data,
                    status: AccountStatus.Active,
                    lastChecked: Date.now()
                };
            } else {
                newAccount = {
                    id: Date.now().toString(),
                    name: `Key Account ${this.accounts.length + 1}`,
                    type: 'key',
                    data: { key: input },
                    status: AccountStatus.Active,
                    lastChecked: Date.now()
                };
            }

            const existingIndex = this.accounts.findIndex(a => a.name === newAccount.name);
            if (existingIndex !== -1) {
                this.accounts[existingIndex].data = newAccount.data;
                this.accounts[existingIndex].status = newAccount.status;
                this.accounts[existingIndex].lastChecked = Date.now();
                vscode.window.showInformationMessage(`Đã cập nhật tài khoản: ${newAccount.name}`);
            } else {
                this.accounts.push(newAccount);
                vscode.window.showInformationMessage(`Đã thêm tài khoản: ${newAccount.name}`);
            }
            await this.saveAccounts();
        } catch (e) {
            vscode.window.showErrorMessage('Lỗi khi thêm tài khoản: Dữ liệu không hợp lệ.');
        } finally {
            release();
        }
    }

    public async updateStatus(id: string, status: AccountStatus) {
        const index = this.accounts.findIndex(a => a.id === id);
        if (index !== -1) {
            this.accounts[index].status = status;
            this.accounts[index].lastChecked = Date.now();
            await this.saveAccounts();
        }
    }

    public async removeAccount(id: string) {
        this.accounts = this.accounts.filter(a => a.id !== id);
        await this.saveAccounts();
    }

    public async autoImport() {
        const release = await this.mutex.acquire();
        try {
            if (process.platform === 'win32') {
                const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
                const query = "SELECT value FROM ItemTable WHERE key = 'jetskiStateSync.agentManagerInitState'";
                const command = `sqlite3 "${dbPath}" "${query}"`;

                const result = await new Promise<string>((resolve) => {
                    exec(command, (error, stdout) => {
                        if (error) resolve('ERROR');
                        else resolve(stdout.trim());
                    });
                });

                if (result && result !== 'ERROR' && result !== '') {
                    const session = ProtobufDecoder.decode(result);
                    const email = session?.context?.email || `Antigravity User`;

                    const existingIndex = this.accounts.findIndex(a => a.name === email);
                    if (existingIndex !== -1) {
                        // Update existing session
                        this.accounts[existingIndex].data = { raw: result };
                        this.accounts[existingIndex].lastChecked = Date.now();
                        await this.saveAccounts();
                        vscode.window.showInformationMessage(`Đã đồng bộ phiên đăng nhập: ${email}`);
                        return true;
                    } else {
                        // Add new
                        this.accounts.push({
                            id: `antigravity-${Date.now()}`,
                            name: email,
                            type: 'client',
                            data: { raw: result },
                            status: AccountStatus.Active,
                            lastChecked: Date.now()
                        });
                        await this.saveAccounts();
                        vscode.window.showInformationMessage(`Đã tự động nhập tài khoản: ${email}`);
                        return true;
                    }
                }
            }

            const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: false });
            if (session) {
                const existing = this.accounts.find(a => a.name === session.account.label);
                if (!existing) {
                    this.accounts.push({
                        id: `vsc-${Date.now()}`,
                        name: session.account.label,
                        type: 'client',
                        data: { session: session.id },
                        status: AccountStatus.Active,
                        lastChecked: Date.now()
                    });
                    await this.saveAccounts();
                    return true;
                }
            }

            vscode.window.showWarningMessage('Không tìm thấy tài khoản Antigravity hợp lệ.');
            return false;
        } catch (e: any) {
            vscode.window.showErrorMessage(`Lỗi tự động nhập: ${e.message}`);
            return false;
        } finally {
            release();
        }
    }

    /**
     * Lấy email của tài khoản đang hoạt động thực tế trong Antigravity DB
     */
    public async getActiveEmail(): Promise<string | null> {
        if (process.platform !== 'win32') return null;

        const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
        const query = "SELECT value FROM ItemTable WHERE key = 'jetskiStateSync.agentManagerInitState'";
        const command = `sqlite3 "${dbPath}" "${query}"`;

        try {
            const result = await new Promise<string>((resolve) => {
                exec(command, (error, stdout) => {
                    if (error) resolve('');
                    else resolve(stdout.trim());
                });
            });

            if (result) {
                const session = ProtobufDecoder.decode(result);
                return session?.context?.email || null;
            }
        } catch (e) { }
        return null;
    }

    /**
     * Chuyển đổi tài khoản bằng cách ghi đè session vào Antigravity DB
     */
    public async switchAccount(id: string) {
        const account = this.accounts.find(a => a.id === id);
        if (!account || !account.data?.raw) {
            vscode.window.showErrorMessage('Tài khoản không hợp lệ hoặc thiếu dữ liệu session.');
            return;
        }

        const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
        const tempSqlPath = path.join(os.tmpdir(), `antigravity_switch_${Date.now()}.sql`);

        // Thoát dấu nháy đơn trong chuỗi raw session để dùng trong SQL
        const escapedValue = account.data.raw.replace(/'/g, "''");
        const sqlQuery = `UPDATE ItemTable SET value = '${escapedValue}' WHERE key = 'jetskiStateSync.agentManagerInitState';`;

        try {
            // Ghi query vào file tạm để tránh lỗi ENAMETOOLONG trên Windows CLI
            fs.writeFileSync(tempSqlPath, sqlQuery, 'utf8');

            const command = `sqlite3 "${dbPath}" < "${tempSqlPath}"`;

            await new Promise((resolve, reject) => {
                exec(command, (error) => {
                    if (error) reject(error);
                    else resolve(true);
                });
            });

            // Xóa file tạm ngay sau khi xong
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);

            vscode.window.showInformationMessage(`Đã chuyển sang tài khoản: ${account.name}. Hãy khởi động lại Antigravity để áp dụng.`);
        } catch (e: any) {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
            vscode.window.showErrorMessage(`Lỗi khi chuyển tài khoản: ${e.message}`);
        }
    }
}
