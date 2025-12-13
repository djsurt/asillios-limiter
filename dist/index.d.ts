interface AnthropicUsage {
    input_tokens: number;
    output_tokens: number;
}
interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
}
type LLMUsage = AnthropicUsage | OpenAIUsage;
interface UserStats {
    tokensUsed: number;
    remaining: number;
    resetAt: Date;
    percentUsed: number;
}
interface UserData {
    tokensUsed: number;
    resetAt: Date;
    thresholdsTriggered: Set<number>;
}
interface StorageAdapter {
    get(userId: string): Promise<UserData | null>;
    set(userId: string, data: UserData): Promise<void>;
    delete(userId: string): Promise<void>;
}
declare class MemoryStorage implements StorageAdapter {
    private store;
    get(userId: string): Promise<UserData | null>;
    set(userId: string, data: UserData): Promise<void>;
    delete(userId: string): Promise<void>;
}
interface LimiterConfig {
    limit: number;
    window: number;
    storage?: StorageAdapter;
    onThreshold?: (userId: string, percent: number) => void;
    thresholds?: number[];
}
declare function createLimiter(config: LimiterConfig): {
    wrap: <T>(userId: string, fn: () => Promise<T>, options?: {
        throwOnLimit?: boolean;
    }) => Promise<T>;
    check: (userId: string) => Promise<boolean>;
    stats: (userId: string) => Promise<UserStats>;
    addTokens: (userId: string, tokens: number) => Promise<void>;
    reset: (userId: string) => Promise<void>;
};

export { type AnthropicUsage, type LLMUsage, type LimiterConfig, MemoryStorage, type OpenAIUsage, type StorageAdapter, type UserData, type UserStats, createLimiter, createLimiter as default };
