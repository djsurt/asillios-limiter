// types for llm responses we support
export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export type LLMUsage = AnthropicUsage | OpenAIUsage;

export interface UserStats {
  tokensUsed: number;
  remaining: number;
  resetAt: Date;
  percentUsed: number;
}

export interface UserData {
  tokensUsed: number;
  resetAt: Date;
  thresholdsTriggered: Set<number>;
}

// storage adapter interface for custom backends
export interface StorageAdapter {
  get(userId: string): Promise<UserData | null>;
  set(userId: string, data: UserData): Promise<void>;
  delete(userId: string): Promise<void>;
}

// simple in-memory storage
export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, UserData>();

  async get(userId: string): Promise<UserData | null> {
    return this.store.get(userId) ?? null;
  }

  async set(userId: string, data: UserData): Promise<void> {
    this.store.set(userId, data);
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}

export interface LimiterConfig {
  limit: number; // max tokens per window
  window: number; // window duration in ms
  storage?: StorageAdapter;
  onThreshold?: (userId: string, percent: number) => void;
  thresholds?: number[]; // percentages to trigger callback, e.g. [80, 90, 100]
}

// extracts token count from either anthropic or openai response format
function extractTokens(response: unknown): number {
  if (!response || typeof response !== "object") return 0;

  const res = response as Record<string, unknown>;

  // anthropic format - usage is at top level
  if (res.usage && typeof res.usage === "object") {
    const usage = res.usage as Record<string, unknown>;

    // anthropic style
    if (typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number") {
      return usage.input_tokens + usage.output_tokens;
    }

    // openai style
    if (typeof usage.prompt_tokens === "number" && typeof usage.completion_tokens === "number") {
      return usage.prompt_tokens + usage.completion_tokens;
    }
  }

  return 0;
}

export function createLimiter(config: LimiterConfig) {
  const storage = config.storage ?? new MemoryStorage();
  const thresholds = config.thresholds ?? [80, 90, 100];

  // get or create user data, resetting if window expired
  async function getUserData(userId: string): Promise<UserData> {
    let data = await storage.get(userId);
    const now = new Date();

    if (!data || now >= data.resetAt) {
      data = {
        tokensUsed: 0,
        resetAt: new Date(now.getTime() + config.window),
        thresholdsTriggered: new Set(),
      };
      await storage.set(userId, data);
    }

    return data;
  }

  // check if user is within their limit
  async function check(userId: string): Promise<boolean> {
    const data = await getUserData(userId);
    return data.tokensUsed < config.limit;
  }

  // get usage stats for a user
  async function stats(userId: string): Promise<UserStats> {
    const data = await getUserData(userId);
    const remaining = Math.max(0, config.limit - data.tokensUsed);
    const percentUsed = (data.tokensUsed / config.limit) * 100;

    return {
      tokensUsed: data.tokensUsed,
      remaining,
      resetAt: data.resetAt,
      percentUsed: Math.min(100, percentUsed),
    };
  }

  // record tokens and check thresholds
  async function recordUsage(userId: string, tokens: number): Promise<void> {
    const data = await getUserData(userId);
    data.tokensUsed += tokens;

    // check thresholds and fire callback if needed
    if (config.onThreshold) {
      const percentUsed = (data.tokensUsed / config.limit) * 100;

      for (const threshold of thresholds) {
        if (percentUsed >= threshold && !data.thresholdsTriggered.has(threshold)) {
          data.thresholdsTriggered.add(threshold);
          config.onThreshold(userId, threshold);
        }
      }
    }

    await storage.set(userId, data);
  }

  // wrap an async llm call with rate limiting
  async function wrap<T>(
    userId: string,
    fn: () => Promise<T>,
    options?: { throwOnLimit?: boolean }
  ): Promise<T> {
    const withinLimit = await check(userId);

    if (!withinLimit) {
      if (options?.throwOnLimit) {
        throw new Error(`rate limit exceeded for user ${userId}`);
      }
    }

    const response = await fn();
    const tokens = extractTokens(response);

    if (tokens > 0) {
      await recordUsage(userId, tokens);
    }

    return response;
  }

  // manually add tokens for a user (useful for streaming or custom tracking)
  async function addTokens(userId: string, tokens: number): Promise<void> {
    await recordUsage(userId, tokens);
  }

  // reset a user's usage
  async function reset(userId: string): Promise<void> {
    await storage.delete(userId);
  }

  return {
    wrap,
    check,
    stats,
    addTokens,
    reset,
  };
}

// convenience export for quick setup
export default createLimiter;
