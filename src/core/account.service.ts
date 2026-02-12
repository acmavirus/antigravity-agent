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

export interface ProxyConfig {
    enabled: boolean;
    host: string;
    port: number;
    username?: string;
    password?: string;
}

export interface UsageStats {
    totalRequests: number;
    totalTokens: number;
    history: { timestamp: number; requests: number; tokens: number }[];
}

export interface Account {
    id: string;
    name: string;
    type: 'google' | 'json' | 'key' | 'client';
    status: AccountStatus;
    lastChecked: number;
    proxy?: ProxyConfig;
    stats?: UsageStats;
    automationSettings?: {
        autoSwitchThreshold: number;
        excludeCommands?: string[];
    };
    // Dữ liệu thực thi sẽ được load từ SecretStorage bằng ID
    data?: any;
}

export class AccountService {
    private accounts: Account[] = [];
    private mutex = new Mutex();
    private readonly STORAGE_KEY = 'antigravity.accounts.metadata';
    private readonly SECRET_PREFIX = 'antigravity.secret.';

    constructor(private context: vscode.ExtensionContext) {
        this.loadAccounts();
    }

    private async loadAccounts() {
        const data = this.context.globalState.get<string>(this.STORAGE_KEY);
        if (data) {
            try {
                this.accounts = JSON.parse(data);
                // Load dữ liệu từ secrets một cách lười (on-demand) hoặc ngay lập tức nếu cần
            } catch (e) {
                this.accounts = [];
            }
        }
    }

    private async saveAccounts() {
        // Chỉ lưu metadata vào globalState
        const metadata = this.accounts.map(({ data, ...rest }) => rest);
        await this.context.globalState.update(this.STORAGE_KEY, JSON.stringify(metadata));
    }

    private async saveSecret(id: string, data: any) {
        await this.context.secrets.store(`${this.SECRET_PREFIX}${id}`, JSON.stringify(data));
    }

    private async getSecret(id: string): Promise<any> {
        const secret = await this.context.secrets.get(`${this.SECRET_PREFIX}${id}`);
        return secret ? JSON.parse(secret) : null;
    }

    public getAccounts(): Account[] {
        return this.accounts;
    }

    public async addAccount(input: string) {
        const release = await this.mutex.acquire();
        try {
            let newAccountData: any;
            let name: string;
            let type: any;

            if (input.startsWith('{')) {
                const data = JSON.parse(input);
                newAccountData = data;
                name = data.name || `Account ${this.accounts.length + 1}`;
                type = 'json';
            } else {
                newAccountData = { key: input };
                name = `Key Account ${this.accounts.length + 1}`;
                type = 'key';
            }

            const id = Date.now().toString();
            const newAccount: Account = {
                id,
                name,
                type,
                status: AccountStatus.Active,
                lastChecked: Date.now()
            };

            const existingIndex = this.accounts.findIndex(a => a.name === name);
            if (existingIndex !== -1) {
                const existingId = this.accounts[existingIndex].id;
                this.accounts[existingIndex].status = AccountStatus.Active;
                this.accounts[existingIndex].lastChecked = Date.now();
                await this.saveSecret(existingId, newAccountData);
                vscode.window.showInformationMessage(`Account updated: ${name}`);
            } else {
                this.accounts.push(newAccount);
                await this.saveSecret(id, newAccountData);
                vscode.window.showInformationMessage(`Account added: ${name}`);
            }
            await this.saveAccounts();
        } catch (e) {
            vscode.window.showErrorMessage('Error adding account: Invalid data.');
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
        const release = await this.mutex.acquire();
        try {
            this.accounts = this.accounts.filter(a => a.id !== id);
            await this.context.secrets.delete(`${this.SECRET_PREFIX}${id}`);
            await this.saveAccounts();
        } finally {
            release();
        }
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
                        const existingId = this.accounts[existingIndex].id;
                        this.accounts[existingIndex].lastChecked = Date.now();
                        await this.saveSecret(existingId, { raw: result });
                        await this.saveAccounts();
                        vscode.window.showInformationMessage(`Session synced: ${email}`);
                        return true;
                    } else {
                        const id = `antigravity-${Date.now()}`;
                        this.accounts.push({
                            id,
                            name: email,
                            type: 'client',
                            status: AccountStatus.Active,
                            lastChecked: Date.now()
                        });
                        await this.saveSecret(id, { raw: result });
                        await this.saveAccounts();
                        vscode.window.showInformationMessage(`Account automatically imported: ${email}`);
                        return true;
                    }
                }
            }

            const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: false });
            if (session) {
                const existing = this.accounts.find(a => a.name === session.account.label);
                if (!existing) {
                    const id = `vsc-${Date.now()}`;
                    this.accounts.push({
                        id,
                        name: session.account.label,
                        type: 'client',
                        status: AccountStatus.Active,
                        lastChecked: Date.now()
                    });
                    await this.saveSecret(id, { session: session.id });
                    await this.saveAccounts();
                    return true;
                }
            }

            vscode.window.showWarningMessage('No valid Antigravity account found.');
            return false;
        } catch (e: any) {
            vscode.window.showErrorMessage(`Auto-import error: ${e.message}`);
            return false;
        } finally {
            release();
        }
    }

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

    public async switchAccount(id: string) {
        const release = await this.mutex.acquire();
        console.log(`[AccountService] Initiating switch to account ID: ${id}`);
        const tempSqlPath = path.join(os.tmpdir(), `antigravity_switch_${Date.now()}.sql`);

        try {
            const account = this.accounts.find(a => a.id === id);
            const secretData = await this.getSecret(id);

            if (!account || !secretData?.raw) {
                vscode.window.showErrorMessage('No session data found for this account.');
                return;
            }

            const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
            if (!fs.existsSync(dbPath)) {
                vscode.window.showErrorMessage('Antigravity database not found.');
                return;
            }

            // Chuyển Base64 sang Hex để ghi BLOB an toàn
            const buffer = Buffer.from(secretData.raw, 'base64');
            const hexValue = buffer.toString('hex');

            // Ghi câu lệnh vào file tạm để tránh lỗi ENAMETOOLONG trên Windows
            const sqlQuery = `UPDATE ItemTable SET value = X'${hexValue}' WHERE key = 'jetskiStateSync.agentManagerInitState';`;
            fs.writeFileSync(tempSqlPath, sqlQuery, 'utf8');

            // Lệnh thực thi sử dụng input redirection từ file
            const command = `sqlite3 "${dbPath}" < "${tempSqlPath}"`;

            let success = false;
            let lastError = '';

            for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                    console.log(`[AccountService] Write attempt ${attempt} for ${account.name}...`);
                    await new Promise((resolve, reject) => {
                        exec(command, (error, stdout, stderr) => {
                            if (error) reject(new Error(stderr || error.message));
                            else resolve(true);
                        });
                    });

                    // Verify lại
                    const verifyQuery = `SELECT hex(value) FROM ItemTable WHERE key = 'jetskiStateSync.agentManagerInitState';`;
                    const verifyCommand = `sqlite3 "${dbPath}" "${verifyQuery}"`;
                    const currentHex = await new Promise<string>((resolve) => {
                        exec(verifyCommand, (error, stdout) => {
                            resolve(stdout.trim().toLowerCase());
                        });
                    });

                    if (currentHex === hexValue.toLowerCase()) {
                        success = true;
                        break;
                    } else {
                        throw new Error('Verification failed: Value mismatch.');
                    }
                } catch (e: any) {
                    lastError = e.message;
                    if (lastError.includes('locked')) {
                        await new Promise(r => setTimeout(r, 500));
                    } else {
                        break;
                    }
                }
            }

            if (success) {
                vscode.window.showInformationMessage(`Account switched to ${account.name}.`);
            } else {
                vscode.window.showErrorMessage(`Switch failed: ${lastError}`);
            }
        } catch (e: any) {
            console.error(`[AccountService] Critical error: ${e.message}`);
        } finally {
            if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
            release();
        }
    }

    /**
     * Lấy dữ liệu đầy đủ bao gồm cả bí mật (Dùng nội bộ)
     */
    public async getAccountWithData(id: string): Promise<Account | null> {
        const account = this.accounts.find(a => a.id === id);
        if (account) {
            const data = await this.getSecret(id);
            return { ...account, data };
        }
        return null;
    }
}
