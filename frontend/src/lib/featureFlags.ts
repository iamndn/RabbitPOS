/**
 * Feature Flags & Per-Device Visual Preferences Configuration for RabbitPOS
 * Allows progressive staged rollout, canary testing, emergency kill-switches,
 * and per-device Liquid Glass material preference management (Override Q3).
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
 * Per-device localStorage key and sync event for Tahoe Liquid Glass effects (Override Q3).
 */
export const GLASS_EFFECTS_STORAGE_KEY = 'rabbitpos_glass_effects' as const;
export const GLASS_EFFECTS_CHANGE_EVENT = 'rabbitpos:glass-effects-change' as const;

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

/**
 * Returns true if the OS or browser accessibility media queries automatically disable glass
 * (`prefers-reduced-transparency: reduce` or `prefers-contrast: more` per Override Q3).
 */
export function isSystemGlassForcedOff(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return (
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches ||
    window.matchMedia('(prefers-contrast: more)').matches
  );
}

/**
 * Read the per-device user preference for Liquid Glass effects (default: true).
 */
export function isGlassEffectsEnabled(): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(GLASS_EFFECTS_STORAGE_KEY);
      if (stored !== null) {
        return stored !== 'false';
      }
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Synchronize `html.no-glass` on `document.documentElement` with the stored per-device preference.
 */
export function syncGlassEffectsClass(): boolean {
  const userEnabled = isGlassEffectsEnabled();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.toggle('no-glass', !userEnabled);
  }
  return userEnabled && !isSystemGlassForcedOff();
}

/**
 * Persist the per-device Liquid Glass switch (`rabbitpos_glass_effects`), immediately toggle
 * `html.no-glass` without reload, and broadcast a sync event across mounted controls.
 */
export function setGlassEffectsEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(GLASS_EFFECTS_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage quota / private-mode write errors and still apply runtime class
    }
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.toggle('no-glass', !enabled);
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent(GLASS_EFFECTS_CHANGE_EVENT, {
        detail: { enabled },
      })
    );
  }
}
