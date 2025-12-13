# asillios-limiter

rate limiting and usage tracking for llm-powered apps. works with openai and anthropic out of the box.

asillios-limiter is a typescript library for controlling and monitoring api usage in apps that use large language models like claude or gpt. when you build an app that lets users interact with an llm, you're paying for every token they use. this library wraps your llm calls and automatically tracks how many tokens each user consumes, letting you set limits and get alerts when users approach their quotas. it works with both anthropic and openai response formats out of the box.

my intention is to give developers a simple way to offer free tiers without getting surprised by a massive api bill. instead of building custom usage tracking from scratch, you drop in a few lines of code and immediately have per user rate limiting, usage stats you can plug into any dashboard, and threshold alerts for identifying power users or potential abuse. it stores usage in memory by default but supports custom storage adapters for production use with redis or a database.

## install

```bash
npm install asillios-limiter
```

## quick start

```typescript
import { createLimiter } from "asillios-limiter";

const limiter = createLimiter({
  limit: 100000, // 100k tokens per window
  window: 60 * 60 * 1000, // 1 hour
  thresholds: [80, 90, 100],
  onThreshold: (userId, percent) => {
    console.log(`user ${userId} hit ${percent}% of their limit`);
  },
});

// wrap your llm calls
const response = await limiter.wrap("user-123", async () => {
  return openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "hello" }],
  });
});

// check if user can make more requests
const canProceed = await limiter.check("user-123");

// get detailed stats
const stats = await limiter.stats("user-123");
console.log(stats);
// { tokensUsed: 150, remaining: 99850, resetAt: Date, percentUsed: 0.15 }
```

## works with anthropic too

```typescript
const response = await limiter.wrap("user-123", async () => {
  return anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    messages: [{ role: "user", content: "hello" }],
  });
});
```

the library auto-detects whether the response uses openai format (`prompt_tokens`/`completion_tokens`) or anthropic format (`input_tokens`/`output_tokens`).

## api

### `createLimiter(config)`

creates a new limiter instance.

```typescript
interface LimiterConfig {
  limit: number; // max tokens per window
  window: number; // window duration in ms
  storage?: StorageAdapter; // custom storage (default: in-memory)
  onThreshold?: (userId: string, percent: number) => void;
  thresholds?: number[]; // default: [80, 90, 100]
}
```

### `limiter.wrap(userId, fn, options?)`

wraps an async function and tracks token usage from the response.

```typescript
const response = await limiter.wrap(
  "user-123",
  () => callLLM(),
  { throwOnLimit: true } // optional: throw if limit exceeded
);
```

### `limiter.check(userId)`

returns `true` if user is within their limit.

```typescript
if (await limiter.check("user-123")) {
  // good to go
}
```

### `limiter.stats(userId)`

returns usage stats for a user.

```typescript
const stats = await limiter.stats("user-123");
// { tokensUsed, remaining, resetAt, percentUsed }
```

### `limiter.addTokens(userId, tokens)`

manually add tokens (useful for streaming responses).

```typescript
await limiter.addTokens("user-123", 500);
```

### `limiter.reset(userId)`

reset a user's usage.

```typescript
await limiter.reset("user-123");
```

## custom storage

implement the `StorageAdapter` interface to use your own storage backend.

```typescript
import { createLimiter, StorageAdapter, UserData } from "asillios-limiter";

class RedisStorage implements StorageAdapter {
  async get(userId: string): Promise<UserData | null> {
    const data = await redis.get(`limiter:${userId}`);
    if (!data) return null;
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      resetAt: new Date(parsed.resetAt),
      thresholdsTriggered: new Set(parsed.thresholdsTriggered),
    };
  }

  async set(userId: string, data: UserData): Promise<void> {
    await redis.set(
      `limiter:${userId}`,
      JSON.stringify({
        ...data,
        thresholdsTriggered: [...data.thresholdsTriggered],
      })
    );
  }

  async delete(userId: string): Promise<void> {
    await redis.del(`limiter:${userId}`);
  }
}

const limiter = createLimiter({
  limit: 100000,
  window: 60 * 60 * 1000,
  storage: new RedisStorage(),
});
```

## license

mit
