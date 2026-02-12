// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { Mutex } from 'async-mutex';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { ProtobufDecoder } from '../api/protobuf/decoder';
import { Account, AccountStatus } from '../interfaces/account.interface';

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

                // Helper to run sqlite query
                const runQuery = (query: string): Promise<string> => {
                    return new Promise<string>((resolve) => {
                        const command = `sqlite3 "${dbPath}" "${query}"`;
                        exec(command, (error, stdout) => {
                            if (error) resolve('ERROR');
                            else resolve(stdout.trim());
                        });
                    });
                };

                const keysToCheck = [
                    'jetskiStateSync.agentManagerInitState',
                    'antigravityUnifiedStateSync.oauthToken'
                ];

                for (const key of keysToCheck) {
                    const query = `SELECT hex(value) FROM ItemTable WHERE key = '${key}'`;
                    const resultHex = await runQuery(query);

                    if (resultHex && resultHex !== 'ERROR' && resultHex !== '') {
                        const cleanHex = resultHex.replace(/\s+/g, '');
                        let buffer: Buffer;
                        let rawData: string;

                        // Xử lý tùy theo key
                        if (key === 'antigravityUnifiedStateSync.oauthToken') {
                            const hexBuffer = Buffer.from(cleanHex, 'hex');
                            // Thử decode dưới dạng UTF-8 string (để lấy base64)
                            // Nếu hex string này thực ra là hex của base64 string
                            const potentialBase64 = hexBuffer.toString('utf8');

                            // Kiểm tra sơ bộ xem có phải base64 string hợp lệ không
                            // (Chứa ký tự alnum, +, /, =)
                            if (/^[A-Za-z0-9+/=]+$/.test(potentialBase64)) {
                                buffer = Buffer.from(potentialBase64, 'base64');
                                rawData = potentialBase64;
                            } else {
                                // Nếu không, fallback về coi như raw binary (blob)
                                buffer = Buffer.from(cleanHex, 'hex');
                                rawData = buffer.toString('base64');
                            }
                        } else {
                            buffer = Buffer.from(cleanHex, 'hex');
                            rawData = buffer.toString('base64');
                        }

                        const session = ProtobufDecoder.decode(buffer);
                        const email = session?.context?.email;

                        if (email) {
                            const existingIndex = this.accounts.findIndex(a => a.name === email);
                            if (existingIndex !== -1) {
                                const existingId = this.accounts[existingIndex].id;
                                this.accounts[existingIndex].lastChecked = Date.now();
                                await this.saveSecret(existingId, { raw: rawData });
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
                                await this.saveSecret(id, { raw: rawData });
                                await this.saveAccounts();
                                vscode.window.showInformationMessage(`Account automatically imported: ${email}`);
                                return true;
                            }
                        }
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

    private cachedActiveEmail: { email: string | null, timestamp: number } | null = null;
    private readonly ACTIVE_EMAIL_CACHE_TTL = 30000; // 30 seconds

    public async getActiveEmail(): Promise<string | null> {
        if (process.platform !== 'win32') return null;

        const now = Date.now();
        if (this.cachedActiveEmail && (now - this.cachedActiveEmail.timestamp) < this.ACTIVE_EMAIL_CACHE_TTL) {
            return this.cachedActiveEmail.email;
        }

        const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
        if (!fs.existsSync(dbPath)) return null;

        try {
            const runQuery = (query: string): Promise<string> => {
                return new Promise<string>((resolve) => {
                    exec(`sqlite3 "${dbPath}" "${query}"`, { timeout: 2000 }, (error, stdout) => {
                        if (error) resolve('');
                        else resolve(stdout.trim());
                    });
                });
            };

            const keysToCheck = [
                'jetskiStateSync.agentManagerInitState',
                'antigravityUnifiedStateSync.oauthToken'
            ];

            let email: string | null = null;

            for (const key of keysToCheck) {
                const resultHex = await runQuery(`SELECT hex(value) FROM ItemTable WHERE key = '${key}'`);

                if (resultHex) {
                    const cleanHex = resultHex.replace(/\s+/g, '');
                    let buffer: Buffer;

                    if (key === 'antigravityUnifiedStateSync.oauthToken') {
                        const hexBuffer = Buffer.from(cleanHex, 'hex');
                        const base64String = hexBuffer.toString('utf8');
                        if (/^[A-Za-z0-9+/=]+$/.test(base64String)) {
                            buffer = Buffer.from(base64String, 'base64');
                        } else {
                            buffer = Buffer.from(cleanHex, 'hex');
                        }
                    } else {
                        buffer = Buffer.from(cleanHex, 'hex');
                    }

                    const session = ProtobufDecoder.decode(buffer);
                    if (session?.context?.email) {
                        email = session.context.email;
                        break;
                    }
                }
            }

            this.cachedActiveEmail = { email, timestamp: now };
            return email;
        } catch (e) {
            return null;
        }
    }

    public async switchAccount(id: string) {
        const release = await this.mutex.acquire();
        console.log(`[AccountService] Initiating switch to account ID: ${id}`);
        this.cachedActiveEmail = null;
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

            const buffer = Buffer.from(secretData.raw, 'base64');
            const hexValue = buffer.toString('hex');

            const sqlQuery = `UPDATE ItemTable SET value = X'${hexValue}' WHERE key = 'jetskiStateSync.agentManagerInitState';`;
            fs.writeFileSync(tempSqlPath, sqlQuery, 'utf8');

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
