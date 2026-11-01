import React from 'react';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  icon?: React.ReactNode;
  autoFocusButton?: 'confirm' | 'cancel';
  /** If isAlert is true, only show the Confirm/OK button */
  isAlert?: boolean;
  /**
   * Optional async action executed while keeping the dialog open with a synchronous
   * pending lock (`Override Q5`). If it throws or returns `false`, the pending lock
   * releases without resolving `true`, preventing double execution of money mutations.
   */
  onConfirmAsync?: () => Promise<void | boolean>;
}

export interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showAlert: (title: string, message?: string, type?: ConfirmType) => Promise<void>;
}
