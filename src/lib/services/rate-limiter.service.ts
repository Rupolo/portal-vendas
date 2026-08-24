/**
 * Rate Limiting Service
 * Implements token bucket algorithm for webhook rate limiting
 * 100 requests per minute per marketplace
 */

import { config } from '../config';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter: number;
}

interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
  limit: number;
  refillRate: number; // tokens per second
}

export class RateLimiterService {
  private buckets = new Map<string, TokenBucket>();
  private readonly defaultLimit = config.rateLimiting.webhooks.maxRequests;
  private readonly defaultWindowMs = config.rateLimiting.webhooks.windowMs;

  /**
   * Initialize token bucket for a key
   */
  private initializeBucket(
    key: string,
    limit: number = this.defaultLimit,
    windowMs: number = this.defaultWindowMs
  ): TokenBucket {
    const now = Date.now();
    const bucket: TokenBucket = {
      tokens: limit,
      lastRefillAt: now,
      limit,
      refillRate: limit / (windowMs / 1000), // tokens per second
    };

    this.buckets.set(key, bucket);
    return bucket;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefillAt) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.refillRate;

    bucket.tokens = Math.min(bucket.limit, bucket.tokens + tokensToAdd);
    bucket.lastRefillAt = now;
  }

  /**
   * Check if request is allowed and consume token
   */
  isAllowed(key: string): RateLimitStatus {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = this.initializeBucket(key);
    }

    // Refill tokens
    this.refillTokens(bucket);

    const now = Date.now();
    const windowReset = bucket.lastRefillAt + this.defaultWindowMs;
    const resetAt = new Date(windowReset);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;

      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt,
        retryAfter: 0,
      };
    }

    // Request denied
    const timeUntilReset = Math.max(0, windowReset - now);
    const retryAfterSeconds = Math.ceil(timeUntilReset / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: retryAfterSeconds,
    };
  }

  /**
   * Check rate limit without consuming token
   */
  checkLimit(key: string): RateLimitStatus {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = this.initializeBucket(key);
    }

    // Refill tokens
    this.refillTokens(bucket);

    const now = Date.now();
    const windowReset = bucket.lastRefillAt + this.defaultWindowMs;
    const resetAt = new Date(windowReset);

    if (bucket.tokens >= 1) {
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt,
        retryAfter: 0,
      };
    }

    const timeUntilReset = Math.max(0, windowReset - now);
    const retryAfterSeconds = Math.ceil(timeUntilReset / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: retryAfterSeconds,
    };
  }

  /**
   * Check rate limit by marketplace
   */
  isMarketplaceAllowed(marketplace: string): RateLimitStatus {
    const key = `marketplace:${marketplace}`;
    return this.isAllowed(key);
  }

  /**
   * Check rate limit by IP
   */
  isIpAllowed(ip: string): RateLimitStatus {
    const key = `ip:${ip}`;
    return this.isAllowed(key);
  }

  /**
   * Check rate limit by vendor
   */
  isVendorAllowed(vendorId: string): RateLimitStatus {
    const key = `vendor:${vendorId}`;
    return this.isAllowed(key);
  }

  /**
   * Reset limit for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all limits
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Get current bucket state
   */
  getBucketState(key: string): TokenBucket | undefined {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      return undefined;
    }

    // Refill before returning state
    this.refillTokens(bucket);
    return bucket;
  }

  /**
   * Cleanup old buckets (call periodically)
   * Removes buckets that haven't been used in the last hour
   */
  cleanup(): number {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    let removed = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefillAt > oneHourMs) {
        this.buckets.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get bucket statistics
   */
  getStats() {
    const stats = {
      totalBuckets: this.buckets.size,
      buckets: Array.from(this.buckets.entries()).map(([key, bucket]) => ({
        key,
        tokens: Math.floor(bucket.tokens),
        limit: bucket.limit,
        refillRate: bucket.refillRate.toFixed(2),
      })),
    };

    return stats;
  }
}

// Export singleton instance
export const rateLimiterService = new RateLimiterService();

// Cleanup old buckets every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const removed = rateLimiterService.cleanup();
    if (removed > 0) {
      console.log(`[RateLimiter] Cleaned up ${removed} old buckets`);
    }
  }, 30 * 60 * 1000);
}
