/**
 * Feature Flags Configuration for RabbitPOS
 * Allows progressive staged rollout, canary testing, and emergency kill-switches.
 */

export const FEATURE_FLAGS = {
  SERVER_PRICING_ENFORCED: 'feature_server_pricing_enforced',
  OFFLINE_CATALOG: 'feature_offline_catalog',
  OFFLINE_ORDER: 'feature_offline_order',
  BACKGROUND_SYNC: 'feature_background_sync',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

const DEFAULT_FLAG_STATE: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.SERVER_PRICING_ENFORCED]: true,
  [FEATURE_FLAGS.OFFLINE_CATALOG]: true,
  [FEATURE_FLAGS.OFFLINE_ORDER]: true,
  [FEATURE_FLAGS.BACKGROUND_SYNC]: true,
};

/**
 * Check if a feature flag is currently active (checks localStorage override first, then defaults)
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    const override = localStorage.getItem(flag);
    if (override !== null) {
      return override === 'true';
    }
  }
  return DEFAULT_FLAG_STATE[flag] ?? true;
}

/**
 * Set feature flag override locally (useful for canary testing on specific POS tablets)
 */
export function setFeatureFlagOverride(flag: FeatureFlagKey, enabled: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(flag, String(enabled));
  }
}

/**
 * Reset all feature flag overrides to default states
 */
export function resetFeatureFlagOverrides(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const key of Object.values(FEATURE_FLAGS)) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Get all current feature flag states
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  for (const [name, key] of Object.entries(FEATURE_FLAGS)) {
    states[name] = isFeatureEnabled(key);
  }
  return states;
}
