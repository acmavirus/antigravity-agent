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
