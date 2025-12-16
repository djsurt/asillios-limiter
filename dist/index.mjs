// src/index.ts
var MemoryStorage = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
  }
  async get(userId) {
    return this.store.get(userId) ?? null;
  }
  async set(userId, data) {
    this.store.set(userId, data);
  }
  async delete(userId) {
    this.store.delete(userId);
  }
};
var RedisStorage = class {
  constructor(redis, prefix = "limiter:") {
    this.redis = redis;
    this.prefix = prefix;
  }
  async get(userId) {
    const data = await this.redis.get(this.prefix + userId);
    if (!data) return null;
    const parsed = JSON.parse(data);
    return {
      entries: parsed.entries || [],
      thresholdsTriggered: new Set(parsed.thresholdsTriggered || [])
    };
  }
  async set(userId, data) {
    await this.redis.set(
      this.prefix + userId,
      JSON.stringify({
        entries: data.entries,
        thresholdsTriggered: [...data.thresholdsTriggered]
      })
    );
  }
  async delete(userId) {
    await this.redis.del(this.prefix + userId);
  }
};
var MODEL_PRICING = {
  // anthropic
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 3e-3, output: 0.015 },
  "claude-3-haiku": { input: 25e-5, output: 125e-5 },
  "claude-sonnet-4": { input: 3e-3, output: 0.015 },
  // openai
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4o": { input: 5e-3, output: 0.015 },
  "gpt-4o-mini": { input: 15e-5, output: 6e-4 },
  "gpt-3.5-turbo": { input: 5e-4, output: 15e-4 }
};
function extractTokens(response) {
  if (!response || typeof response !== "object") return { input: 0, output: 0 };
  const res = response;
  if (res.usage && typeof res.usage === "object") {
    const usage = res.usage;
    if (typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number") {
      return { input: usage.input_tokens, output: usage.output_tokens };
    }
    if (typeof usage.prompt_tokens === "number" && typeof usage.completion_tokens === "number") {
      return { input: usage.prompt_tokens, output: usage.completion_tokens };
    }
  }
  return { input: 0, output: 0 };
}
function calculateCost(input, output, model) {
  if (!model) return 0;
  const key = Object.keys(MODEL_PRICING).find((k) => model.includes(k));
  if (!key) return 0;
  const pricing = MODEL_PRICING[key];
  return input / 1e3 * pricing.input + output / 1e3 * pricing.output;
}
function createLimiter(config) {
  const storage = config.storage ?? new MemoryStorage();
  const thresholds = config.thresholds ?? [80, 90, 100];
  const burstMultiplier = 1 + (config.burstPercent ?? 0) / 100;
  const limits = config.limits ?? [
    { tokens: config.limit ?? 1e5, window: config.window ?? 36e5 }
  ];
  async function getUserData(userId) {
    let data = await storage.get(userId);
    if (!data) {
      data = { entries: [], thresholdsTriggered: /* @__PURE__ */ new Set() };
    }
    return data;
  }
  function getWindowUsage(entries, windowMs) {
    const cutoff = Date.now() - windowMs;
    let tokens = 0;
    let cost = 0;
    for (const entry of entries) {
      if (entry.timestamp >= cutoff) {
        tokens += entry.tokens;
        cost += entry.cost;
      }
    }
    return { tokens, cost };
  }
  function pruneEntries(entries) {
    const maxWindow = Math.max(...limits.map((l) => l.window));
    const cutoff = Date.now() - maxWindow;
    return entries.filter((e) => e.timestamp >= cutoff);
  }
  async function check(userId) {
    const data = await getUserData(userId);
    const entries = pruneEntries(data.entries);
    for (const limit of limits) {
      const usage = getWindowUsage(entries, limit.window);
      const effectiveLimit = limit.tokens * burstMultiplier;
      if (usage.tokens >= effectiveLimit) return false;
    }
    if (config.costLimit) {
      const maxWindow = Math.max(...limits.map((l) => l.window));
      const usage = getWindowUsage(entries, maxWindow);
      if (usage.cost >= config.costLimit * burstMultiplier) return false;
    }
    return true;
  }
  async function getRemainingTokens(userId) {
    const data = await getUserData(userId);
    const entries = pruneEntries(data.entries);
    const primaryLimit = limits[0];
    const usage = getWindowUsage(entries, primaryLimit.window);
    return Math.max(0, primaryLimit.tokens - usage.tokens);
  }
  async function stats(userId) {
    const data = await getUserData(userId);
    const entries = pruneEntries(data.entries);
    const primaryLimit = limits[0];
    const usage = getWindowUsage(entries, primaryLimit.window);
    const remaining = Math.max(0, primaryLimit.tokens - usage.tokens);
    const percentUsed = usage.tokens / primaryLimit.tokens * 100;
    const resetAt = new Date(Date.now() + primaryLimit.window);
    const result = {
      tokensUsed: usage.tokens,
      remaining,
      resetAt,
      percentUsed: Math.min(100, percentUsed)
    };
    if (config.trackCost || config.costLimit) {
      result.costUsed = usage.cost;
      result.costRemaining = config.costLimit ? Math.max(0, config.costLimit - usage.cost) : void 0;
    }
    return result;
  }
  async function recordUsage(userId, tokens, cost) {
    const data = await getUserData(userId);
    data.entries = pruneEntries(data.entries);
    data.entries.push({ tokens, cost, timestamp: Date.now() });
    if (config.onThreshold) {
      const primaryLimit = limits[0];
      const usage = getWindowUsage(data.entries, primaryLimit.window);
      const percentUsed = usage.tokens / primaryLimit.tokens * 100;
      for (const threshold of thresholds) {
        if (percentUsed >= threshold && !data.thresholdsTriggered.has(threshold)) {
          data.thresholdsTriggered.add(threshold);
          config.onThreshold(userId, threshold);
        }
      }
    }
    await storage.set(userId, data);
  }
  async function wrap(userId, fn, options) {
    const withinLimit = await check(userId);
    if (!withinLimit && options?.throwOnLimit) {
      throw new Error(`rate limit exceeded for user ${userId}`);
    }
    const response = await fn();
    const { input, output } = extractTokens(response);
    const totalTokens = input + output;
    if (totalTokens > 0) {
      const cost = config.trackCost || config.costLimit ? calculateCost(input, output, options?.model) : 0;
      await recordUsage(userId, totalTokens, cost);
    }
    return response;
  }
  async function addTokens(userId, tokens, cost = 0) {
    await recordUsage(userId, tokens, cost);
  }
  async function reset(userId) {
    await storage.delete(userId);
  }
  return { wrap, check, stats, getRemainingTokens, addTokens, reset };
}
function expressMiddleware(limiter, getUserId) {
  return async (req, res, next) => {
    const userId = getUserId(req);
    if (!userId) return next();
    const withinLimit = await limiter.check(userId);
    if (!withinLimit) {
      const stats = await limiter.stats(userId);
      const response = res;
      return response.status(429).json({
        error: "rate limit exceeded",
        resetAt: stats.resetAt,
        tokensUsed: stats.tokensUsed
      });
    }
    next();
  };
}
function nextMiddleware(limiter, getUserId) {
  return async (req) => {
    const userId = getUserId(req);
    if (!userId) return { allowed: true };
    const withinLimit = await limiter.check(userId);
    if (!withinLimit) {
      const stats = await limiter.stats(userId);
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "rate limit exceeded",
            resetAt: stats.resetAt,
            tokensUsed: stats.tokensUsed
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      };
    }
    return { allowed: true };
  };
}
var index_default = createLimiter;
export {
  MODEL_PRICING,
  MemoryStorage,
  RedisStorage,
  createLimiter,
  index_default as default,
  expressMiddleware,
  nextMiddleware
};
