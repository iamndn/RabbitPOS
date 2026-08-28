/**
 * Hardening & Observability Test Suite (TypeScript)
 */

import { isFeatureEnabled, FEATURE_FLAGS, setFeatureFlagOverride, resetFeatureFlagOverrides } from '../lib/featureFlags';

export function runHardeningMatrixUnitTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      passed++;
      console.log(`✅ PASS: ${msg}`);
    }
  }

  // 1. Feature Flags Default States
  assert(isFeatureEnabled(FEATURE_FLAGS.SERVER_PRICING_ENFORCED) === true, 'Server pricing enforced by default');
  assert(isFeatureEnabled(FEATURE_FLAGS.OFFLINE_CATALOG) === true, 'Offline catalog enabled by default');
  assert(isFeatureEnabled(FEATURE_FLAGS.OFFLINE_ORDER) === true, 'Offline order enabled by default');
  assert(isFeatureEnabled(FEATURE_FLAGS.BACKGROUND_SYNC) === true, 'Background sync enabled by default');

  return { passed, failed };
}
