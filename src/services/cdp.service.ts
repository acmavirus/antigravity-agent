// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const BASE_PORT = 9000;
const PORT_RANGE = 5; // Quét từ 9000 đến 9005

interface CdpPage {
    id: string;
    title: string;
    type: string;
    webSocketDebuggerUrl?: string; // URL WebSocket để debug
}

interface CdpConnection {
    ws: any;
    injected: boolean;
}

export class CdpService {
    private connections: Map<string, CdpConnection> = new Map();
    private msgId: number = 1;
    private isEnabled: boolean = false;
    private pollTimer: NodeJS.Timeout | null = null;

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Bắt đầu dịch vụ CDP Auto-Accept
     */
    public async start() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        console.log('[CDP] Bắt đầu dịch vụ Auto-Accept qua CDP...');

        // Chạy ngay lập tức
        await this.scanAndConnect();

        // Định kỳ quét lại (phòng trường hợp mở window mới hoặc reload)
        this.pollTimer = setInterval(async () => {
            if (!this.isEnabled) return;
            await this.scanAndConnect();
        }, 10000);
    }

    /**
     * Dừng dịch vụ
     */
    public async stop() {
        this.isEnabled = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        for (const [id, conn] of this.connections) {
            try {
                // Gửi lệnh dừng script bên trong browser
                await this.evaluate(id, 'if(window.__autoAcceptStop) window.__autoAcceptStop()');
                conn.ws.close();
            } catch (e) {
                console.error(`[CDP] Lỗi khi đóng kết nối ${id}:`, e);
            }
        }
        this.connections.clear();
        console.log('[CDP] Đã dừng dịch vụ.');
    }

    /**
     * Quét các cổng debug và kết nối tới các trang
     */
    private async scanAndConnect() {
        for (let port = BASE_PORT; port <= BASE_PORT + PORT_RANGE; port++) {
            try {
                const pages = await this.getPages(port);
                for (const page of pages) {
                    // Chỉ quan tâm đến page chính hoặc webview có thể chạy script
                    if (!page.webSocketDebuggerUrl) continue;

                    const id = `${port}:${page.id}`;
                    if (!this.connections.has(id)) {
                        await this.connect(id, page.webSocketDebuggerUrl);
                    }

                    // Inject script nếu chưa inject
                    await this.injectScript(id);
                }
            } catch (e) {
                // Không log lỗi kết nối vì cổng có thể không mở (bình thường)
            }
        }
    }

    /**
     * Lấy danh sách tabs/pages từ debugger port
     */
    private async getPages(port: number): Promise<CdpPage[]> {
        return new Promise((resolve) => {
            const req = require('http').get({
                hostname: '127.0.0.1',
                port: port,
                path: '/json/list',
                timeout: 500
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(data) as CdpPage[];
                        resolve(pages.filter(p => p.type === 'page' || p.type === 'webview' || p.type === 'iframe'));
                    } catch (e) {
                        resolve([]);
                    }
                });
            });

            req.on('error', () => resolve([]));
            req.on('timeout', () => {
                req.destroy();
                resolve([]);
            });
        });
    }

    /**
     * Kết nối WebSocket tới trang
     */
    private connect(id: string, url: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Sử dụng require để tránh vấn đề import binding
                const WebSocket = require('ws');
                const ws = new WebSocket(url);

                // Set timeout kết nối
                const timeout = setTimeout(() => {
                    if (ws.readyState === WebSocket.CONNECTING) {
                        try { ws.terminate(); } catch (e) { }
                        resolve(false);
                    }
                }, 1000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    this.connections.set(id, { ws, injected: false });
                    console.log(`[CDP] Đã kết nối tới session ${id}`);
                    resolve(true);
                });

                ws.on('error', (err: any) => {
                    clearTimeout(timeout);
                    console.error(`[CDP] Lỗi kết nối ${id}:`, err.message);
                    resolve(false);
                });

                ws.on('close', () => {
                    this.connections.delete(id);
                    console.log(`[CDP] Ngắt kết nối ${id}`);
                });
            } catch (e) {
                console.error(`[CDP] Exception khi kết nối ${id}:`, e);
                resolve(false);
            }
        });
    }

    /**
     * Inject script Auto-Accept vào trang
     */
    private async injectScript(id: string) {
        const conn = this.connections.get(id);
        if (!conn) return;

        try {
            if (!conn.injected) {
                // Đọc script từ resources
                const scriptPath = this.context.asAbsolutePath(path.join('resources', 'cdp-inject.js'));
                if (!fs.existsSync(scriptPath)) {
                    console.error('[CDP] Không tìm thấy file script tại:', scriptPath);
                    return;
                }

                const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                await this.evaluate(id, scriptContent);
                conn.injected = true;
                console.log(`[CDP] Inject thành công vào ${id}`);
            }

            // Gửi cấu hình khởi động
            const config = {
                ide: 'antigravity',
                isPro: true,
                isBackgroundMode: true, // Chạy ngầm không cần overlay phiền phức
                bannedCommands: ['rm -rf /', 'format c:'] // Bảo mật cơ bản
            };

            await this.evaluate(id, `if(window.__autoAcceptStart) window.__autoAcceptStart(${JSON.stringify(config)})`);

        } catch (e) {
            console.error(`[CDP] Inject thất bại cho ${id}:`, e);
            // Reset flag để thử lại lần sau
            conn.injected = false;
        }
    }

    /**
     * Thực thi JS trong trang thông qua giao thức CDP Runtime.evaluate
     */
    private evaluate(id: string, expression: string): Promise<any> {
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== 1) return Promise.reject('WebSocket not open');

        return new Promise((resolve, reject) => {
            const msgId = this.msgId++;
            const payload = {
                id: msgId,
                method: 'Runtime.evaluate',
                params: {
                    expression: expression,
                    userGesture: true,
                    awaitPromise: true,
                    returnByValue: true
                }
            };

            const timeout = setTimeout(() => {
                conn.ws.off('message', onMessage);
                reject(new Error('CDP Timeout'));
            }, 5000);

            const onMessage = (data: any) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === msgId) {
                        clearTimeout(timeout);
                        conn.ws.off('message', onMessage);
                        if (response.error) {
                            reject(response.error);
                        } else {
                            resolve(response.result);
                        }
                    }
                } catch (e) {
                    // Bỏ qua tin nhắn không phải JSON
                }
            };

            conn.ws.on('message', onMessage);
            conn.ws.send(JSON.stringify(payload));
        });
    }

    /**
     * Kiểm tra xem cổng debug có mở không để cảnh báo người dùng
     */
    public async isDebuggingEnabled(): Promise<boolean> {
        for (let port = BASE_PORT; port <= BASE_PORT + PORT_RANGE; port++) {
            const pages = await this.getPages(port);
            if (pages.length > 0) return true;
        }
        return false;
    }
}
