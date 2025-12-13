"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  MemoryStorage: () => MemoryStorage,
  createLimiter: () => createLimiter,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
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
function extractTokens(response) {
  if (!response || typeof response !== "object") return 0;
  const res = response;
  if (res.usage && typeof res.usage === "object") {
    const usage = res.usage;
    if (typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number") {
      return usage.input_tokens + usage.output_tokens;
    }
    if (typeof usage.prompt_tokens === "number" && typeof usage.completion_tokens === "number") {
      return usage.prompt_tokens + usage.completion_tokens;
    }
  }
  return 0;
}
function createLimiter(config) {
  const storage = config.storage ?? new MemoryStorage();
  const thresholds = config.thresholds ?? [80, 90, 100];
  async function getUserData(userId) {
    let data = await storage.get(userId);
    const now = /* @__PURE__ */ new Date();
    if (!data || now >= data.resetAt) {
      data = {
        tokensUsed: 0,
        resetAt: new Date(now.getTime() + config.window),
        thresholdsTriggered: /* @__PURE__ */ new Set()
      };
      await storage.set(userId, data);
    }
    return data;
  }
  async function check(userId) {
    const data = await getUserData(userId);
    return data.tokensUsed < config.limit;
  }
  async function stats(userId) {
    const data = await getUserData(userId);
    const remaining = Math.max(0, config.limit - data.tokensUsed);
    const percentUsed = data.tokensUsed / config.limit * 100;
    return {
      tokensUsed: data.tokensUsed,
      remaining,
      resetAt: data.resetAt,
      percentUsed: Math.min(100, percentUsed)
    };
  }
  async function recordUsage(userId, tokens) {
    const data = await getUserData(userId);
    data.tokensUsed += tokens;
    if (config.onThreshold) {
      const percentUsed = data.tokensUsed / config.limit * 100;
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
  async function addTokens(userId, tokens) {
    await recordUsage(userId, tokens);
  }
  async function reset(userId) {
    await storage.delete(userId);
  }
  return {
    wrap,
    check,
    stats,
    addTokens,
    reset
  };
}
var index_default = createLimiter;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MemoryStorage,
  createLimiter
});
