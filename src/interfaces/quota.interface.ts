export interface ModelCapabilities {
    contextWindow: string;
    trainingData: string;
    supportsImage: boolean;
    supportsVideo: boolean;
    supportsThinking: boolean;
}

export interface ModelQuota {
    modelId: string;
    displayName: string;
    used: number;
    limit: number;
    percent?: number;
    resetTime: string;
    resetTimeRaw?: number;
    groupLabel?: string;
    isPinned?: boolean;
    poolId?: string;
    capabilities?: ModelCapabilities;
}

export interface ModelPool {
    id: string;
    displayName: string;
    totalPercent: number;
    models: string[];
}
