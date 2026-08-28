'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/context/ToastContext';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
}

export function useNetworkStatus(): NetworkStatus {
  const toast = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<number | null>(null);

  const initialMountRef = useRef<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(Date.now());
      if (wasOffline || !initialMountRef.current) {
        toast.online();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setLastOfflineAt(Date.now());
      toast.offline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine && initialMountRef.current) {
      setIsOnline(false);
      setWasOffline(true);
      setLastOfflineAt(Date.now());
      toast.offline();
    }

    initialMountRef.current = false;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, wasOffline]);

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    lastOfflineAt,
  };
}
