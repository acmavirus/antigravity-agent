// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import express from 'express';
import * as path from 'path';
import { Server } from 'http';
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
        this.setupRoutes();
    }

    private setupRoutes() {
        // Serve static files (HTML, CSS, JS cho mobile)
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

            res.json({
                accounts,
                monitor: this.cdpService.getConnectionInfo(),
                logs: this.logService.getLogs().slice(-20), // Chỉ lấy 20 log mới nhất
                analytics: this.analyticsService.getUsageHistory(),
                timestamp: new Date().toISOString()
            });
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

    public start() {
        if (this.server) return;

        try {
            this.server = this.app.listen(this.PORT, '0.0.0.0', () => {
                console.log(`[WebServer] Mobile Dashboard running at http://localhost:${this.PORT}`);
                this.logService.addLog(LogLevel.Info, `Mobile Dashboard started at port ${this.PORT}`, 'WebServer');
            });
        } catch (error: any) {
            console.error(`[WebServer] Failed to start: ${error.message}`);
        }
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}
