import { ModelCapabilities } from "../interfaces/quota.interface";

export const TARGET_MODELS: Record<string, string> = {
    "gemini-3-pro-high": "Gemini 3 Pro (High)",
    "gemini-3-pro-low": "Gemini 3 Pro (Low)",
    "gemini-3-flash": "Gemini 3 Flash",
    "claude-sonnet-4-5": "Claude Sonnet 4.5",
    "claude-sonnet-4-5-thinking": "Claude Sonnet 4.5 (Thinking)",
    "claude-opus-4-5-thinking": "Claude Opus 4.5 (Thinking)",
    "gpt-oss-120b-medium": "GPT-OSS 120B (Medium)",
};

export const MODEL_METADATA: Record<string, { capabilities: ModelCapabilities, poolId: string }> = {
    "gemini-3-pro-high": {
        poolId: "gemini-3-pro",
        capabilities: { contextWindow: "2M tokens", trainingData: "Dec 2024", supportsImage: true, supportsVideo: true, supportsThinking: true }
    },
    "gemini-3-pro-low": {
        poolId: "gemini-3-pro",
        capabilities: { contextWindow: "128K tokens", trainingData: "Oct 2024", supportsImage: true, supportsVideo: false, supportsThinking: false }
    },
    "gemini-3-flash": {
        poolId: "gemini-3-flash",
        capabilities: { contextWindow: "1M tokens", trainingData: "Sep 2024", supportsImage: true, supportsVideo: true, supportsThinking: false }
    },
    "claude-sonnet-4-5": {
        poolId: "claude-4-5",
        capabilities: { contextWindow: "200K tokens", trainingData: "Jan 2025", supportsImage: true, supportsVideo: false, supportsThinking: false }
    },
    "claude-sonnet-4-5-thinking": {
        poolId: "claude-4-5",
        capabilities: { contextWindow: "200K tokens", trainingData: "Jan 2025", supportsImage: true, supportsVideo: false, supportsThinking: true }
    },
    "claude-opus-4-5-thinking": {
        poolId: "claude-4-5",
        capabilities: { contextWindow: "400K tokens", trainingData: "Feb 2025", supportsImage: true, supportsVideo: true, supportsThinking: true }
    },
    "gpt-oss-120b-medium": {
        poolId: "gpt-oss",
        capabilities: { contextWindow: "128K tokens", trainingData: "Nov 2024", supportsImage: false, supportsVideo: false, supportsThinking: false }
    }
};
