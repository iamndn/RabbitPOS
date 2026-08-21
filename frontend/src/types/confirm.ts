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
}

export interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showAlert: (title: string, message?: string, type?: ConfirmType) => Promise<void>;
}
