// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import { Server } from 'http';
import { AccountService } from '../account.service';
import { QuotaService } from '../quota.service';
import { Logger, LogLevel } from '../../utils/logger';
import { AnalyticsService } from '../analytics.service';
import { CdpService } from '../../automation/cdp/cdp.service';
import { ExpressApp } from './express.app';
import { TunnelManager } from './tunnel.manager';

/**
 * Service quản lý Web Server để truy cập Dashboard từ điện thoại.
 */
export class WebServerService {
    private server: Server | null = null;
    private pin: string = '';
    private readonly PORT = 3001;
    private tunnelManager: TunnelManager;

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: Logger,
        private analyticsService: AnalyticsService,
        private cdpService: CdpService
    ) {
        this.generatePin();
        this.tunnelManager = new TunnelManager(this.logService);
    }

    private generatePin() {
        this.pin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    public async start() {
        if (this.server) return;
        try {
            const expressApp = new ExpressApp(
                this.context, 
                this.accountService, 
                this.quotaService, 
                this.logService, 
                this.analyticsService, 
                this.cdpService, 
                this.pin,
                this.tunnelManager
            );

            this.server = expressApp.app.listen(this.PORT, '0.0.0.0', async () => {
                const localUrl = `http://localhost:${this.PORT}`;
                console.log(`[WebServer] Mobile Dashboard running at ${localUrl} | PIN: ${this.pin}`);
                this.logService.info(`Mobile Dashboard started | PIN: ${this.pin}`, 'WebServer');

                vscode.window.showInformationMessage(`🚀 Antigravity Mobile Server ON | PIN: ${this.pin}`, 'Copy PIN').then(val => {
                    if (val === 'Copy PIN') vscode.env.clipboard.writeText(this.pin);
                });

                await this.tunnelManager.start(this.PORT, this.pin);
            });
        } catch (error: any) {
            console.error(`[WebServer] Failed to start: ${error.message}`);
        }
    }

    public stop() {
        this.tunnelManager.stop();
        if (this.server) { this.server.close(); this.server = null; }
    }
}
