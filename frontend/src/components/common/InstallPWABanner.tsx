'use client';

import { useEffect, useState } from 'react';
import { X, Share, Plus, Smartphone } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { Button, IconButton, useOverlayLayer } from '@/components/ui';

const STORAGE_KEY = 'pwa_install_banner_dismissed';

/**
 * InstallPWABanner
 * Shows a smart iOS "Add to Home Screen" installation prompt using Tahoe `glass-thick` sheet chrome (`z-sheet: 75`).
 * - Only visible on iOS Safari (iPhone/iPad/iPod).
 * - Hidden when already running in standalone (installed) mode.
 * - Dismissed state persisted to localStorage (`pwa_install_banner_dismissed`) so it does not re-appear.
 */
export default function InstallPWABanner() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Amendment A1: Demote underlying z-30 shell bars while the z-75 install sheet is visible
  useOverlayLayer(show && isVisible, 75, false);

  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    const isStandalone =
      'standalone' in window.navigator && (window.navigator as any).standalone === true;

    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';

    if (isIOS && !isStandalone && !isDismissed) {
      const timer = setTimeout(() => {
        setShow(true);
        requestAnimationFrame(() => setIsVisible(true));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShow(false);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 260);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={t('pwa.dialog_aria')}
      className={`fixed bottom-0 left-0 right-0 z-sheet transition-transform duration-sheet-enter ease-sheet-enter ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="glass-thick border-t border-glass rounded-t-sheet px-5 pt-3.5 pb-6 pb-safe relative">
        {/* Grabber pill */}
        <div className="flex justify-center mb-3" aria-hidden="true">
          <div className="w-9 h-1 rounded-full bg-slate-300/90" />
        </div>

        {/* Dismiss IconButton (44x44px hit target on mobile) */}
        <IconButton
          variant="ghost"
          size="md"
          onClick={handleDismiss}
          aria-label={t('pwa.close_aria')}
          className="absolute top-3 right-3"
        >
          <X className="w-4 h-4" />
        </IconButton>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pr-10">
          <div className="w-12 h-12 rounded-card overflow-hidden shadow-card shrink-0 border border-card bg-surface-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/apple-touch-icon.png"
              alt="RabbitPOS"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 text-headline flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-brand-600 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('pwa.title')}</span>
            </h2>
            <p className="text-slate-600 text-footnote mt-0.5">
              {t('pwa.subtitle')}
            </p>
          </div>
        </div>

        {/* Step-by-step instructions on opaque card */}
        <ol className="bg-surface-card rounded-card border border-card shadow-card p-3.5 space-y-3">
          <li className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white text-caption font-bold font-num flex items-center justify-center mt-0.5">
              1
            </span>
            <p className="flex-1 text-subhead text-slate-700 leading-snug">
              {t('pwa.step1_prefix')}{' '}
              <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                <Share className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                {t('pwa.step1_share')}
              </span>{' '}
              {t('pwa.step1_suffix')}
            </p>
          </li>

          <li className="flex items-start gap-3 pt-2.5 border-t border-hairline">
            <span className="shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white text-caption font-bold font-num flex items-center justify-center mt-0.5">
              2
            </span>
            <p className="flex-1 text-subhead text-slate-700 leading-snug">
              {t('pwa.step2_prefix')}{' '}
              <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                <Plus className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                &ldquo;{t('pwa.step2_add')}&rdquo;
              </span>
              .
            </p>
          </li>
        </ol>

        {/* Capsule Dismiss Button */}
        <div className="mt-4">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleDismiss}
          >
            {t('pwa.later')}
          </Button>
        </div>
      </div>
    </div>
  );
}
