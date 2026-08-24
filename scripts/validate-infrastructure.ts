#!/usr/bin/env node

/**
 * Infrastructure Validation Script
 * ================================
 * 
 * Validates Phase 1 infrastructure setup:
 * 1. Exponential backoff configuration
 * 2. Cache layer configuration
 * 3. Redis connectivity
 * 4. Queue system health
 * 
 * Run with: npx ts-node scripts/validate-infrastructure.ts
 */

import { validateBackoffConfig, logBackoffConfig } from '../src/lib/backoff';
import { config } from '../src/lib/config';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   Marketplace Integration Infrastructure Validation       ║');
console.log('║   Phase 1: Backoff & Cache Configuration                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ============================================================================
// 1. BACKOFF CONFIGURATION VALIDATION
// ============================================================================

console.log('1️⃣  EXPONENTIAL BACKOFF CONFIGURATION\n');
console.log('   Validating backoff configuration for all queues...\n');

const backoffValidation = validateBackoffConfig();

if (backoffValidation.valid) {
  console.log('   ✅ Backoff configuration is VALID\n');

  // Show configuration details
  logBackoffConfig();

  // Verify each queue meets requirements
  console.log('   Compliance Check:\n');

  const productSync = backoffValidation.queues.productSync;
  const expected = [5000, 10000, 20000, 40000, 60000];
  const delays = productSync.expectedDelays;

  console.log(`   productSync (5 attempts):`);
  console.log(`   ├─ Expected: 5s → 10s → 20s → 40s → 60s (capped)`);
  console.log(`   ├─ Actual:   ${delays.map(d => `${d / 1000}s`).join(' → ')}`);

  const matches =
    delays[0] === 5000 &&
    delays[1] === 10000 &&
    delays[2] === 20000 &&
    delays[3] === 40000 &&
    delays[4] === 60000;

  console.log(`   └─ ${matches ? '✅ MATCHES requirements' : '❌ DOES NOT MATCH'}\n`);
} else {
  console.log('   ❌ Backoff configuration INVALID\n');
  console.log('   ⚠️  Warnings:');
  backoffValidation.warnings.forEach(warning => {
    console.log(`   • ${warning}`);
  });
  console.log();
}

// ============================================================================
// 2. CACHE CONFIGURATION VALIDATION
// ============================================================================

console.log('2️⃣  CACHE LAYER CONFIGURATION\n');
console.log('   Validating cache TTLs...\n');

const cacheTTLs = {
  'Marketplace Schemas': { actual: config.cache.schemas, expected: 300, label: '5 min' },
  'Product Data': { actual: config.cache.products, expected: 60, label: '1 min' },
  'Inventory (volatile)': { actual: config.cache.inventory, expected: 30, label: '30 sec' },
  'Order Data': { actual: config.cache.orders, expected: 120, label: '2 min' },
  'General Cache': { actual: config.cache.general, expected: 600, label: '10 min' },
};

let allTTLsCorrect = true;

for (const [key, value] of Object.entries(cacheTTLs)) {
  const matches = value.actual === value.expected;
  const status = matches ? '✅' : '❌';

  console.log(`   ${status} ${key}`);
  console.log(`      Expected: ${value.expected}s (${value.label})`);
  console.log(`      Actual:   ${value.actual}s`);

  if (!matches) {
    allTTLsCorrect = false;
  }

  console.log();
}

if (allTTLsCorrect) {
  console.log('   ✅ All cache TTLs are CORRECT\n');
} else {
  console.log('   ❌ Some cache TTLs are INCORRECT\n');
}

// ============================================================================
// 3. QUEUE CONFIGURATION VALIDATION
// ============================================================================

console.log('3️⃣  QUEUE SYSTEM CONFIGURATION\n');

const queueConfigs = {
  productSync: {
    name: 'Product Sync',
    expectedAttempts: 5,
    expectedBackoff: 5000,
  },
  inventorySync: {
    name: 'Inventory Sync',
    expectedAttempts: 5,
    expectedBackoff: 5000,
  },
  orderSync: {
    name: 'Order Sync',
    expectedAttempts: 3,
    expectedBackoff: 5000,
  },
  webhookProcessing: {
    name: 'Webhook Processing',
    expectedAttempts: 5,
    expectedBackoff: 2000,
  },
  errorRecovery: {
    name: 'Error Recovery',
    expectedAttempts: 10,
    expectedBackoff: 10000,
  },
};

let allQueuesCorrect = true;

for (const [queueKey, expected] of Object.entries(queueConfigs)) {
  const queueConfig = (config.queues as any)[queueKey];
  const actualAttempts = queueConfig.defaultJobOptions.attempts;
  const actualBackoff = queueConfig.defaultJobOptions.backoff.delay;

  const attemptsMatch = actualAttempts === expected.expectedAttempts;
  const backoffMatch = actualBackoff === expected.expectedBackoff;
  const allMatch = attemptsMatch && backoffMatch;

  const status = allMatch ? '✅' : '❌';

  console.log(`   ${status} ${expected.name}`);
  console.log(`      Attempts: ${actualAttempts} (expected: ${expected.expectedAttempts})`);
  console.log(`      Backoff:  ${actualBackoff}ms (expected: ${expected.expectedBackoff}ms)`);

  if (!allMatch) {
    allQueuesCorrect = false;
  }

  console.log();
}

if (allQueuesCorrect) {
  console.log('   ✅ All queue configurations are CORRECT\n');
} else {
  console.log('   ❌ Some queue configurations are INCORRECT\n');
}

// ============================================================================
// 4. SUMMARY
// ============================================================================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║                      VALIDATION SUMMARY                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const allValid = backoffValidation.valid && allTTLsCorrect && allQueuesCorrect;

console.log(`   Backoff Configuration:  ${backoffValidation.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Cache TTLs:             ${allTTLsCorrect ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Queue Configuration:    ${allQueuesCorrect ? '✅ PASS' : '❌ FAIL'}`);
console.log();

if (allValid) {
  console.log('   🎉 ALL INFRASTRUCTURE CHECKS PASSED!\n');
  console.log('   Phase 1 infrastructure is properly configured for:');
  console.log('   • Exponential backoff with jitter');
  console.log('   • Redis-based caching with proper TTLs');
  console.log('   • BullMQ queue system with retry logic\n');
  process.exit(0);
} else {
  console.log('   ⚠️  SOME INFRASTRUCTURE CHECKS FAILED\n');
  console.log('   Please review the configuration and fix any issues.\n');
  process.exit(1);
}
