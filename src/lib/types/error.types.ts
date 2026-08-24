/**
 * Error classifications for error handling and recovery
 */

export const ErrorClassification = {
  // Recoverable errors
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  TEMPORARY_UNAVAILABLE: 'TEMPORARY_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Non-recoverable errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',

  // Application errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorClassification = (typeof ErrorClassification)[keyof typeof ErrorClassification];

export interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  nextAttemptAt: Date;
  lastError?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitterFactor: number;
}
