/**
 * Error Handler Service
 * Classifies errors, implements retry logic, and circuit breaker pattern
 */

import type { CircuitBreakerState, RetryPolicy } from '../types/error.types';
import { ErrorClassification as EC } from '../types/error.types';

export interface CircuitBreakerError extends Error {
  name: 'CircuitBreakerOpenError';
  lastError: string;
  nextAttemptAt: Date;
}

export class ErrorHandlerService {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly defaultRetryPolicy: RetryPolicy = {
    maxRetries: 5,
    baseDelay: 5000, // 5 seconds
    maxDelay: 60000, // 60 seconds
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  };

  /**
   * Classify an error
   */
  classifyError(error: any): {
    classification: string;
    recoverable: boolean;
    shouldNotify: boolean;
    shouldAlert: boolean;
  } {
    if (!error) {
      return {
        classification: EC.UNKNOWN,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    // Check HTTP status codes
    if (error.status) {
      return this.classifyByStatusCode(error.status, error);
    }

    // Check error messages
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toUpperCase() || '';

    if (
      message.includes('timeout') ||
      code === 'ECONNABORTED' ||
      code === 'ETIMEDOUT'
    ) {
      return {
        classification: EC.TIMEOUT,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      code === 'RATE_LIMITED'
    ) {
      return {
        classification: EC.RATE_LIMIT,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (
      message.includes('token') ||
      message.includes('unauthorized') ||
      code === 'INVALID_TOKEN'
    ) {
      return {
        classification: EC.INVALID_CREDENTIALS,
        recoverable: false,
        shouldNotify: true,
        shouldAlert: true,
      };
    }

    if (
      message.includes('network') ||
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND'
    ) {
      return {
        classification: EC.NETWORK_ERROR,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (
      message.includes('validation') ||
      code === 'VALIDATION_ERROR'
    ) {
      return {
        classification: EC.VALIDATION_ERROR,
        recoverable: false,
        shouldNotify: true,
        shouldAlert: true,
      };
    }

    return {
      classification: EC.UNKNOWN,
      recoverable: true,
      shouldNotify: false,
      shouldAlert: true,
    };
  }

  /**
   * Classify error by HTTP status code
   */
  private classifyByStatusCode(
    status: number,
    error: any
  ): {
    classification: string;
    recoverable: boolean;
    shouldNotify: boolean;
    shouldAlert: boolean;
  } {
    if (status === 408 || status === 504) {
      return {
        classification: EC.TIMEOUT,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (status === 429) {
      return {
        classification: EC.RATE_LIMIT,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (status === 401 || status === 403) {
      return {
        classification: EC.INVALID_CREDENTIALS,
        recoverable: false,
        shouldNotify: true,
        shouldAlert: true,
      };
    }

    if (status === 400 || status === 422) {
      return {
        classification: EC.INVALID_REQUEST,
        recoverable: false,
        shouldNotify: true,
        shouldAlert: true,
      };
    }

    if (status === 404) {
      return {
        classification: EC.NOT_FOUND,
        recoverable: false,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (status === 503 || status === 502) {
      return {
        classification: EC.TEMPORARY_UNAVAILABLE,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    if (status >= 500) {
      return {
        classification: EC.TEMPORARY_UNAVAILABLE,
        recoverable: true,
        shouldNotify: false,
        shouldAlert: false,
      };
    }

    return {
      classification: EC.UNKNOWN,
      recoverable: true,
      shouldNotify: false,
      shouldAlert: false,
    };
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: any): boolean {
    const classified = this.classifyError(error);
    return classified.recoverable;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(
    attempt: number,
    policy: Partial<RetryPolicy> = {}
  ): number {
    const p = { ...this.defaultRetryPolicy, ...policy };
    const exponentialDelay = p.baseDelay * Math.pow(p.backoffMultiplier, attempt - 1);
    const capped = Math.min(exponentialDelay, p.maxDelay);

    // Add jitter: ±10%
    const jitter = capped * p.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(capped + jitter));
  }

  /**
   * Execute function with retry logic
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      onRetry?: (attempt: number, error: any, nextDelay: number) => void;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 5;
    const baseDelay = options.baseDelay ?? 5000;
    const maxDelay = options.maxDelay ?? 60000;

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on non-recoverable errors
        if (!this.isRecoverable(error)) {
          throw error;
        }

        // Last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }

        // Calculate delay for next attempt
        const delay = this.calculateRetryDelay(attempt, {
          baseDelay,
          maxDelay,
        });

        if (options.onRetry) {
          options.onRetry(attempt, error, delay);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Execute function with circuit breaker pattern
   */
  async executeWithCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number;
      successThreshold?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const failureThreshold = options.failureThreshold ?? 5;
    const successThreshold = options.successThreshold ?? 2;
    const timeout = options.timeout ?? 60000;

    let state = this.circuitBreakers.get(key);

    if (!state) {
      state = {
        status: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        nextAttemptAt: new Date(),
      };
      this.circuitBreakers.set(key, state);
    }

    // Check if circuit breaker is open
    if (state.status === 'OPEN') {
      if (new Date() < state.nextAttemptAt) {
        const error: CircuitBreakerError = new Error(
          `Circuit breaker is OPEN for ${key}`
        ) as CircuitBreakerError;
        error.name = 'CircuitBreakerOpenError';
        error.lastError = state.lastError || 'Unknown error';
        error.nextAttemptAt = state.nextAttemptAt;
        throw error;
      }

      // Try transitioning to HALF_OPEN
      state.status = 'HALF_OPEN';
      state.successCount = 0;
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Circuit breaker timeout')), timeout)
        ),
      ]);

      // Success
      if (state.status === 'HALF_OPEN') {
        state.successCount++;

        if (state.successCount >= successThreshold) {
          state.status = 'CLOSED';
          state.failureCount = 0;
          state.successCount = 0;
        }
      } else if (state.status === 'CLOSED') {
        state.failureCount = Math.max(0, state.failureCount - 1);
      }

      return result;
    } catch (error) {
      // Failure
      state.failureCount++;
      state.lastError = error instanceof Error ? error.message : String(error);

      if (state.status === 'HALF_OPEN' || state.failureCount >= failureThreshold) {
        state.status = 'OPEN';
        state.nextAttemptAt = new Date(Date.now() + timeout);
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(key: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(key);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): void {
    this.circuitBreakers.delete(key);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }

  /**
   * Log error with context
   */
  logError(error: any, context: Record<string, any> = {}): void {
    const classified = this.classifyError(error);

    console.error('[ErrorHandler]', {
      classification: classified.classification,
      message: error?.message,
      recoverable: classified.recoverable,
      context,
      stack: error?.stack,
    });
  }

  /**
   * Notify admin of error (placeholder)
   */
  async notifyAdminOfError(
    error: any,
    context: Record<string, any> = {}
  ): Promise<void> {
    const classified = this.classifyError(error);

    if (classified.shouldAlert) {
      console.warn('[ErrorHandler] ALERT: Admin should be notified', {
        classification: classified.classification,
        message: error?.message,
        context,
      });

      // TODO: Send notification (email, Slack, etc.)
    }
  }
}

// Export singleton instance
export const errorHandlerService = new ErrorHandlerService();
