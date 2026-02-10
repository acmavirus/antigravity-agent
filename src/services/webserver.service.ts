// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import express from 'express';
import * as path from 'path';
import { Server } from 'http';
import localtunnel from 'localtunnel';
import axios from 'axios';
import { AccountService } from './account.service';
import { QuotaService } from './quota.service';
import { LogService, LogLevel } from './log.service';
import { AnalyticsService } from './analytics.service';
import { CdpService } from './cdp.service';

/**
 * Service quản lý Web Server để truy cập Dashboard từ điện thoại.
 */
export class WebServerService {
    private app: express.Application;
    private server: Server | null = null;
    private tunnel: localtunnel.Tunnel | null = null;
    private publicUrl: string | null = null;
    private tunnelPassword: string | null = null;
    private readonly PORT = 3001;

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: LogService,
        private analyticsService: AnalyticsService,
        private cdpService: CdpService
    ) {
        this.app = express();
        this.app.use(express.json()); // Hỗ trợ JSON body
        this.setupRoutes();
    }

    private setupRoutes() {
        // Serve static files
        const staticPath = path.join(this.context.extensionPath, 'resources', 'mobile');
        this.app.use(express.static(staticPath));

        // API endpoints
        this.app.get('/api/status', async (req, res) => {
            const activeEmail = await this.accountService.getActiveEmail();
            const accounts = this.accountService.getAccounts().map(acc => ({
                id: acc.id,
                name: acc.name,
                status: acc.status,
                isActive: acc.name === activeEmail,
                quotas: this.quotaService.getCachedQuotas(acc.id) || []
            }));

            // Lấy thông tin chi tiết về các target CDP
            const monitorInfo = [];
            const connections = this.cdpService.getConnectionInfo();
            for (const conn of connections) {
                const workspace = conn.connected ? await this.cdpService.getWorkspacePath(conn.id) : null;
                monitorInfo.push({ ...conn, workspace });
            }

            res.json({
                accounts,
                monitor: monitorInfo,
                publicUrl: this.publicUrl,
                tunnelPassword: this.tunnelPassword,
                logs: this.logService.getLogs().slice(-20),
                analytics: this.analyticsService.getUsageHistory(),
                timestamp: new Date().toISOString()
            });
        });

        // Screenshot endpoint
        this.app.get('/api/screenshot/:id', async (req, res) => {
            const base64 = await this.cdpService.captureScreenshot(req.params.id);
            if (base64) {
                const img = Buffer.from(base64, 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': img.length
                });
                res.end(img);
            } else {
                res.status(404).json({ error: 'Failed to capture screenshot' });
            }
        });

        // Chat content endpoint
        this.app.get('/api/chat/:id', async (req, res) => {
            const chat = await this.cdpService.scrapeChat(req.params.id);
            res.json({ chat });
        });

        // Inject Command endpoint
        this.app.post('/api/inject', async (req, res) => {
            const { id, text } = req.body;
            if (id && text) {
                await this.cdpService.insertAndSubmit(id, text);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Missing id or text' });
            }
        });

        // Accept endpoint
        this.app.post('/api/accept', async (req, res) => {
            const { id } = req.body;
            if (id) {
                // 1. CDP Accept
                await this.cdpService.acceptSuggestion(id);

                // 2. Native Commands Accept (Dành cho toàn bộ IDE)
                const commands = [
                    'antigravity.step.accept', 'antigravity.step.run', 'antigravity.accept',
                    'chat.acceptAction', 'editor.action.inlineChat.accept'
                ];
                for (const cmd of commands) {
                    try { await vscode.commands.executeCommand(cmd); } catch (e) { }
                }

                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Missing id' });
            }
        });

        // Endpoint điều khiển cơ bản
        this.app.post('/api/refresh', async (req, res) => {
            await this.quotaService.refreshAll(true);
            res.json({ success: true });
        });

        this.app.post('/api/switch/:id', async (req, res) => {
            const id = req.params.id;
            await this.accountService.switchAccount(id);
            res.json({ success: true });
        });
    }

    public async start() {
        if (this.server) return;

        try {
            this.server = this.app.listen(this.PORT, '0.0.0.0', async () => {
                const localUrl = `http://localhost:${this.PORT}`;
                console.log(`[WebServer] Mobile Dashboard running at ${localUrl}`);
                this.logService.addLog(LogLevel.Info, `Mobile Dashboard started at port ${this.PORT}`, 'WebServer');

                // Lấy Tunnel Password (Public IP)
                try {
                    const res = await axios.get('https://loca.lt/mytunnelpassword');
                    this.tunnelPassword = res.data.trim();
                } catch (e) { }

                // Khởi tạo Tunnel (Truy cập từ xa)
                try {
                    this.tunnel = await localtunnel({ port: this.PORT });
                    this.publicUrl = this.tunnel.url;
                    console.log(`[WebServer] Public Tunnel URL: ${this.publicUrl}`);
                    this.logService.addLog(LogLevel.Success, `URL: ${this.publicUrl} | Pass: ${this.tunnelPassword}`, 'WebServer');

                    this.tunnel.on('close', () => {
                        this.publicUrl = null;
                        this.logService.addLog(LogLevel.Info, 'Tunnel closed', 'WebServer');
                    });
                } catch (e: any) {
                    this.logService.addLog(LogLevel.Error, `Tunnel Error: ${e.message}`, 'WebServer');
                }
            });
        } catch (error: any) {
            console.error(`[WebServer] Failed to start: ${error.message}`);
        }
    }

    public stop() {
        if (this.tunnel) {
            this.tunnel.close();
            this.tunnel = null;
        }
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}
