'use client';

import { useCallback, useEffect, useState } from 'react';

const EVENT_NAME = 'rabbitpos:header-popover-open';

/**
 * Open/close state for a header popover that is mutually exclusive with every
 * other popover using this hook: opening one broadcasts an event that closes
 * the rest. Also handles Escape-key dismissal while open.
 */
export function useExclusivePopover(id: string) {
  const [isOpen, setIsOpenState] = useState(false);

  const setOpen = useCallback(
    (next: boolean) => {
      setIsOpenState(next);
      if (next && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: id }));
      }
    },
    [id]
  );

  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setIsOpenState(false);
    };
    window.addEventListener(EVENT_NAME, onOtherOpen);
    return () => window.removeEventListener(EVENT_NAME, onOtherOpen);
  }, [id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpenState(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return [isOpen, setOpen] as const;
}
