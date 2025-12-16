# asillios-limiter

YOU DON'T WANT A BIG SURPRISE BILL FROM OPENAI OR ANTHROPIC API WHEN U GIVE FREE TIERS

[**asillios.com**
](https://www.asillios.com/)
<img width="1620" height="923" alt="Screenshot 2025-12-15 at 10 55 50 am" src="https://github.com/user-attachments/assets/0c95af77-1602-4fe3-b52f-5b7ebb59c620" />

token-based rate limiting for llm apps. tracks usage per user, supports openai and anthropic, includes cost tracking.

asillios-limiter is a typescript library for controlling and monitoring api usage in apps that use large language models like claude or gpt. when you build an app that lets users interact with an llm, you're paying for every token they use. this library wraps your llm calls and automatically tracks how many tokens each user consumes, letting you set limits and get alerts when users approach their quotas. it works with both anthropic and openai response formats out of the box.

## install

```bash
npm install asillios-limiter
```

## quick start

```typescript
import { createLimiter } from "asillios-limiter";

const limiter = createLimiter({
  limit: 100000,
  window: 60 * 60 * 1000, // 1 hour
  onThreshold: (userId, percent) => {
    console.log(`user ${userId} hit ${percent}%`);
  },
});

// wrap your llm calls - tokens tracked automatically
const response = await limiter.wrap("user-123", () =>
  openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "hello" }],
  })
);

// check limits and get stats
const canProceed = await limiter.check("user-123");
const remaining = await limiter.getRemainingTokens("user-123");
const stats = await limiter.stats("user-123");
```

## features

### sliding window

uses a rolling window instead of fixed reset times. smoother limiting and harder to game.

### multiple limits

enforce multiple limits simultaneously (e.g., per-minute AND per-day):

```typescript
const limiter = createLimiter({
  limits: [
    { tokens: 10000, window: 60 * 1000 },       // 10k per minute
    { tokens: 100000, window: 24 * 60 * 60 * 1000 }, // 100k per day
  ],
});
```

### burst allowance

let users temporarily exceed limits:

```typescript
const limiter = createLimiter({
  limit: 50000,
  window: 60 * 60 * 1000,
  burstPercent: 20, // allow 20% overage
});
```

### cost tracking

track estimated api costs alongside tokens:

```typescript
const limiter = createLimiter({
  limit: 100000,
  window: 60 * 60 * 1000,
  trackCost: true,
  costLimit: 5.0, // $5 limit
});

// pass model name to calculate cost
const response = await limiter.wrap(
  "user-123",
  () => anthropic.messages.create({ ... }),
  { model: "claude-3-sonnet" }
);

const stats = await limiter.stats("user-123");
// { tokensUsed, remaining, costUsed, costRemaining, ... }
```

supported models: gpt-4, gpt-4-turbo, gpt-4o, gpt-4o-mini, gpt-3.5-turbo, claude-3-opus, claude-3-sonnet, claude-3-haiku, claude-sonnet-4

### middleware helpers

#### express

```typescript
import { createLimiter, expressMiddleware } from "asillios-limiter";

const limiter = createLimiter({ limit: 50000, window: 3600000 });

app.use(
  "/api/chat",
  expressMiddleware(limiter, (req) => req.user?.id ?? null)
);
```

#### next.js

```typescript
import { createLimiter, nextMiddleware } from "asillios-limiter";

const limiter = createLimiter({ limit: 50000, window: 3600000 });
const checkLimit = nextMiddleware(limiter, (req) => req.headers.get("x-user-id"));

export async function POST(req: Request) {
  const { allowed, response } = await checkLimit(req);
  if (!allowed) return response;

  // proceed with llm call...
}
```

### redis storage

built-in redis adapter (bring your own client):

```typescript
import { createLimiter, RedisStorage } from "asillios-limiter";
import Redis from "ioredis";

const redis = new Redis();

const limiter = createLimiter({
  limit: 100000,
  window: 60 * 60 * 1000,
  storage: new RedisStorage(redis),
});
```

## api

### `createLimiter(config)`

```typescript
interface LimiterConfig {
  // simple: single limit
  limit?: number;
  window?: number;
  // advanced: multiple limits
  limits?: { tokens: number; window: number }[];
  // burst allowance percentage
  burstPercent?: number;
  // cost tracking
  trackCost?: boolean;
  costLimit?: number;
  // storage and callbacks
  storage?: StorageAdapter;
  onThreshold?: (userId: string, percent: number) => void;
  thresholds?: number[]; // default: [80, 90, 100]
}
```

### `limiter.wrap(userId, fn, options?)`

wraps async function and tracks tokens from response.

```typescript
await limiter.wrap("user-123", () => llmCall(), {
  throwOnLimit: true, // throw if over limit
  model: "gpt-4",     // for cost calculation
});
```

### `limiter.check(userId)`

returns `true` if user is within all limits.

### `limiter.getRemainingTokens(userId)`

returns remaining tokens for primary limit.

### `limiter.stats(userId)`

returns full usage stats:

```typescript
{
  tokensUsed: number;
  remaining: number;
  resetAt: Date;
  percentUsed: number;
  costUsed?: number;      // if trackCost enabled
  costRemaining?: number; // if costLimit set
}
```

### `limiter.addTokens(userId, tokens, cost?)`

manually add tokens (for streaming, etc).

### `limiter.reset(userId)`

reset user's usage.

## license

mit
