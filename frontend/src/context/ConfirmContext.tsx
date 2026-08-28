'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmContextType, ConfirmOptions, ConfirmType } from '@/types/confirm';
import { useToast } from '@/context/ToastContext';
import ConfirmModal from '@/components/common/ConfirmModal';

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // If there is already an unresolved dialog, reject/cancel previous one
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolverRef.current = resolve;
    });
  }, []);

  const showAlert = useCallback(
    (title: string, message?: string, type: ConfirmType = 'info'): Promise<void> => {
      const toastType =
        type === 'danger' ? 'error' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info';
      toast.showToast(toastType, message || title, {
        title: message ? title : undefined,
      });
      return Promise.resolve();
    },
    [toast]
  );

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, showAlert }}>
      {children}
      <ConfirmModal
        isOpen={isOpen}
        options={options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
