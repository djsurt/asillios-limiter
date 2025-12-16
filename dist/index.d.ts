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
    costUsed?: number;
    costRemaining?: number;
}
interface UsageEntry {
    tokens: number;
    cost: number;
    timestamp: number;
}
interface UserData {
    entries: UsageEntry[];
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
interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
    del(key: string): Promise<unknown>;
}
declare class RedisStorage implements StorageAdapter {
    private redis;
    private prefix;
    constructor(redis: RedisClient, prefix?: string);
    get(userId: string): Promise<UserData | null>;
    set(userId: string, data: UserData): Promise<void>;
    delete(userId: string): Promise<void>;
}
declare const MODEL_PRICING: Record<string, {
    input: number;
    output: number;
}>;
interface LimitConfig {
    tokens: number;
    window: number;
}
interface LimiterConfig {
    limit?: number;
    window?: number;
    limits?: LimitConfig[];
    burstPercent?: number;
    trackCost?: boolean;
    costLimit?: number;
    storage?: StorageAdapter;
    onThreshold?: (userId: string, percent: number) => void;
    thresholds?: number[];
}
declare function createLimiter(config: LimiterConfig): {
    wrap: <T>(userId: string, fn: () => Promise<T>, options?: {
        throwOnLimit?: boolean;
        model?: string;
    }) => Promise<T>;
    check: (userId: string) => Promise<boolean>;
    stats: (userId: string) => Promise<UserStats>;
    getRemainingTokens: (userId: string) => Promise<number>;
    addTokens: (userId: string, tokens: number, cost?: number) => Promise<void>;
    reset: (userId: string) => Promise<void>;
};
declare function expressMiddleware(limiter: ReturnType<typeof createLimiter>, getUserId: (req: unknown) => string | null): (req: unknown, res: unknown, next: () => void) => Promise<void>;
declare function nextMiddleware(limiter: ReturnType<typeof createLimiter>, getUserId: (req: unknown) => string | null): (req: unknown) => Promise<{
    allowed: boolean;
    response?: Response;
}>;

export { type AnthropicUsage, type LLMUsage, type LimitConfig, type LimiterConfig, MODEL_PRICING, MemoryStorage, type OpenAIUsage, type RedisClient, RedisStorage, type StorageAdapter, type UsageEntry, type UserData, type UserStats, createLimiter, createLimiter as default, expressMiddleware, nextMiddleware };
