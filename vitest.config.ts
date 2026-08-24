/**
 * Vitest Configuration
 * ====================
 * 
 * Configuration for the test runner including:
 * - Unit tests (marketplace-schema.service.test.ts)
 * - Property-based tests (marketplace-schema.service.pbt.ts)
 * - Test paths and patterns
 * - Coverage settings
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    globals: true,

    // Test files pattern
    include: ['**/*.{test,spec}.ts', '**/*.pbt.ts'],
    exclude: ['node_modules', '.next', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.pbt.ts',
        'node_modules/',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },

    // Timeout for tests
    testTimeout: 10000,

    // Setup files
    setupFiles: [],

    // Hooks
    hookTimeout: 10000,
  },

  // Module resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
