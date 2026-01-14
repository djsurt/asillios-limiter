import { describe, it, expect, beforeEach } from 'vitest';
import { createLimiter, MemoryStorage } from '../index';

describe('createLimiter - Basic Functionality', () => {
  let limiter: ReturnType<typeof createLimiter>;

  beforeEach(() => {
    limiter = createLimiter({
      limit: 1000,
      window: 60000, // 1 minute
    });
  });

  it('should allow requests within limit', async () => {
    const result = await limiter.check('user-1');
    expect(result).toBe(true);
  });

  it('should track tokens correctly', async () => {
    await limiter.addTokens('user-1', 500);
    const stats = await limiter.stats('user-1');
    
    expect(stats.tokensUsed).toBe(500);
    expect(stats.remaining).toBe(500);
    expect(stats.percentUsed).toBe(50);
  });

  it('should block when limit exceeded', async () => {
    await limiter.addTokens('user-1', 1001);
    const result = await limiter.check('user-1');
    
    expect(result).toBe(false);
  });

  it('should calculate remaining tokens', async () => {
    await limiter.addTokens('user-1', 300);
    const remaining = await limiter.getRemainingTokens('user-1');
    
    expect(remaining).toBe(700);
  });

  it('should reset user data', async () => {
    await limiter.addTokens('user-1', 500);
    await limiter.reset('user-1');
    
    const stats = await limiter.stats('user-1');
    expect(stats.tokensUsed).toBe(0);
    expect(stats.remaining).toBe(1000);
  });
});

describe('createLimiter - Multiple Limits', () => {
  it('should enforce multiple time windows', async () => {
    const limiter = createLimiter({
      limits: [
        { tokens: 100, window: 1000 },   // 100 per second
        { tokens: 500, window: 10000 },  // 500 per 10 seconds
      ],
    });

    await limiter.addTokens('user-1', 90);
    expect(await limiter.check('user-1')).toBe(true);

    await limiter.addTokens('user-1', 20); // Total: 110
    expect(await limiter.check('user-1')).toBe(false); // Exceeds first limit
  });
});

describe('createLimiter - Burst Allowance', () => {
  it('should allow burst percentage over limit', async () => {
    const limiter = createLimiter({
      limit: 1000,
      window: 60000,
      burstPercent: 20, // Allow 20% over
    });

    await limiter.addTokens('user-1', 1100); // 110% of limit
    expect(await limiter.check('user-1')).toBe(true);

    await limiter.addTokens('user-1', 100); // Now at 120%
    expect(await limiter.check('user-1')).toBe(false);
  });
});

describe('createLimiter - Wrap Function', () => {
  it('should wrap API calls and extract tokens automatically', async () => {
    const limiter = createLimiter({
      limit: 10000,
      window: 60000,
    });

    const mockApiResponse = {
      usage: {
        input_tokens: 100,
        output_tokens: 200,
      },
      content: 'test response',
    };

    const response = await limiter.wrap('user-1', async () => mockApiResponse);

    expect(response).toEqual(mockApiResponse);
    
    const stats = await limiter.stats('user-1');
    expect(stats.tokensUsed).toBe(300); // 100 input + 200 output
  });

  it('should support OpenAI response format', async () => {
    const limiter = createLimiter({
      limit: 10000,
      window: 60000,
    });

    const mockOpenAIResponse = {
      usage: {
        prompt_tokens: 150,
        completion_tokens: 250,
      },
      choices: [{ message: { content: 'test' } }],
    };

    await limiter.wrap('user-1', async () => mockOpenAIResponse);
    
    const stats = await limiter.stats('user-1');
    expect(stats.tokensUsed).toBe(400); // 150 + 250
  });

  it('should throw error when throwOnLimit is true', async () => {
    const limiter = createLimiter({
      limit: 100,
      window: 60000,
    });

    await limiter.addTokens('user-1', 101);

    await expect(
      limiter.wrap('user-1', async () => ({ data: 'test' }), { throwOnLimit: true })
    ).rejects.toThrow('rate limit exceeded');
  });
});

describe('createLimiter - Cost Tracking', () => {
  it('should track costs when enabled', async () => {
    const limiter = createLimiter({
      limit: 100000,
      window: 3600000,
      trackCost: true,
    });

    const mockResponse = {
      usage: {
        input_tokens: 1000,
        output_tokens: 2000,
      },
    };

    await limiter.wrap('user-1', async () => mockResponse, {
      model: 'gpt-4',
    });

    const stats = await limiter.stats('user-1');
    expect(stats.costUsed).toBeGreaterThan(0);
    expect(stats.costUsed).toBeCloseTo(0.15, 2); // 1k input * 0.03/1k + 2k output * 0.06/1k
  });

  it('should enforce cost limits', async () => {
    const limiter = createLimiter({
      limit: 1000000,
      window: 3600000,
      costLimit: 0.5,
    });

    const mockResponse = {
      usage: {
        input_tokens: 10000,
        output_tokens: 10000,
      },
    };

    // Add enough tokens to exceed cost limit
    await limiter.wrap('user-1', async () => mockResponse, { model: 'gpt-4' });
    await limiter.wrap('user-1', async () => mockResponse, { model: 'gpt-4' });

    const result = await limiter.check('user-1');
    expect(result).toBe(false);
  });
});

describe('createLimiter - Thresholds', () => {
  it('should trigger threshold callbacks', async () => {
    const thresholdCalls: Array<{ userId: string; percent: number }> = [];
    
    const limiter = createLimiter({
      limit: 1000,
      window: 60000,
      thresholds: [50, 80, 100],
      onThreshold: (userId, percent) => {
        thresholdCalls.push({ userId, percent });
      },
    });

    await limiter.addTokens('user-1', 400);
    expect(thresholdCalls).toHaveLength(0);

    await limiter.addTokens('user-1', 200); // 60% total
    expect(thresholdCalls).toHaveLength(1);
    expect(thresholdCalls[0]).toEqual({ userId: 'user-1', percent: 50 });

    await limiter.addTokens('user-1', 300); // 90% total
    expect(thresholdCalls).toHaveLength(2);
    expect(thresholdCalls[1]).toEqual({ userId: 'user-1', percent: 80 });

    await limiter.addTokens('user-1', 200); // 110% total
    expect(thresholdCalls).toHaveLength(3);
    expect(thresholdCalls[2]).toEqual({ userId: 'user-1', percent: 100 });
  });

  it('should not trigger same threshold twice', async () => {
    const thresholdCalls: number[] = [];
    
    const limiter = createLimiter({
      limit: 1000,
      window: 60000,
      thresholds: [80],
      onThreshold: (_, percent) => {
        thresholdCalls.push(percent);
      },
    });

    await limiter.addTokens('user-1', 850);
    await limiter.addTokens('user-1', 50);
    
    expect(thresholdCalls).toHaveLength(1);
  });
});
