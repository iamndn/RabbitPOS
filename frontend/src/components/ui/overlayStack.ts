'use client';

import { useEffect, useId, useSyncExternalStore } from 'react';

interface OverlayEntry {
  zLayer: number;
  lockScroll: boolean;
}

const activeOverlays = new Map<string, OverlayEntry>();
const listeners = new Set<() => void>();
let savedBodyOverflow: string | null = null;

function syncDomState() {
  if (typeof document === 'undefined') return;

  // Amendment A1: Demote z-30 shell bars and z-10/20 sticky headers whenever >= 1 overlay is open
  if (activeOverlays.size > 0) {
    document.documentElement.setAttribute('data-overlay-open', 'true');
  } else {
    document.documentElement.removeAttribute('data-overlay-open');
  }

  // Ref-counted body scroll lock across stacked modals/sheets
  let shouldLockScroll = false;
  activeOverlays.forEach((entry) => {
    if (entry.lockScroll) {
      shouldLockScroll = true;
    }
  });

  if (shouldLockScroll) {
    if (savedBodyOverflow === null) {
      savedBodyOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden';
  } else if (savedBodyOverflow !== null) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeOverlayStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerOverlay(
  id: string,
  zLayer: number,
  lockScroll = false
): () => void {
  activeOverlays.set(id, { zLayer, lockScroll });
  syncDomState();
  emitChange();

  return () => {
    if (activeOverlays.delete(id)) {
      syncDomState();
      emitChange();
    }
  };
}

export function getActiveOverlayCount(): number {
  return activeOverlays.size;
}

/**
 * Returns true if another open overlay sits visually above `id`
 * (either higher zLayer, or equal zLayer registered later).
 * Used to set `data-under-nested-overlay="true"` on lower glass platters (Amendment A1).
 */
export function isOverlayUnderHigherLayer(id: string, zLayer: number): boolean {
  if (!activeOverlays.has(id)) return false;

  let seenSelf = false;
  let hasHigher = false;

  activeOverlays.forEach((entry, key) => {
    if (key === id) {
      seenSelf = true;
      return;
    }
    if (entry.zLayer > zLayer || (seenSelf && entry.zLayer === zLayer)) {
      hasHigher = true;
    }
  });

  return hasHigher;
}

/**
 * Returns true when `id` is the topmost registered overlay (eligible for Escape key dismissal).
 */
export function isTopmostOverlay(id: string): boolean {
  if (!activeOverlays.has(id)) return false;
  const selfEntry = activeOverlays.get(id)!;
  return !isOverlayUnderHigherLayer(id, selfEntry.zLayer);
}

let snapshotVersion = 0;
let cachedVersion = -1;
let cachedEntries: Array<[string, number]> = [];

// Increment snapshot version whenever listeners fire
listeners.add(() => {
  snapshotVersion += 1;
});

function getClientVersion(): number {
  if (cachedVersion !== snapshotVersion) {
    cachedVersion = snapshotVersion;
    cachedEntries = Array.from(activeOverlays.entries()).map(([k, v]) => [k, v.zLayer]);
  }
  return cachedVersion;
}

function getServerVersion(): number {
  return 0;
}

export function useOverlayLayer(
  isOpen: boolean,
  zLayer: number,
  lockScroll = false
) {
  const reactId = useId();
  const overlayId = `tahoe-overlay-${reactId}`;

  useEffect(() => {
    if (!isOpen) return;
    return registerOverlay(overlayId, zLayer, lockScroll);
  }, [isOpen, overlayId, zLayer, lockScroll]);

  useSyncExternalStore(subscribeOverlayStack, getClientVersion, getServerVersion);

  // Reference cachedEntries to ensure lint/compiler retains snapshot read
  void cachedEntries;

  return {
    overlayId,
    activeOverlayCount: isOpen ? getActiveOverlayCount() : 0,
    underHigherOverlay: isOpen ? isOverlayUnderHigherLayer(overlayId, zLayer) : false,
    isTopmost: isOpen ? isTopmostOverlay(overlayId) : false,
  };
}
