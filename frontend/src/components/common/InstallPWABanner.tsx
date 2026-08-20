'use client';

import { useEffect, useState } from 'react';
import { X, Share, Plus } from 'lucide-react';

const STORAGE_KEY = 'pwa_install_banner_dismissed';

/**
 * InstallPWABanner
 * Shows a smart iOS "Add to Home Screen" installation prompt.
 * - Only visible on iOS Safari (iPhone/iPad/iPod).
 * - Hidden when already running in standalone (installed) mode.
 * - Dismissed state persisted to localStorage so it doesn't re-appear.
 */
export default function InstallPWABanner() {
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Must run client-side only
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // Check if already running as installed standalone app
    const isStandalone =
      'standalone' in window.navigator && (window.navigator as any).standalone === true;

    // Check if user has already dismissed the banner
    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';

    if (isIOS && !isStandalone && !isDismissed) {
      // Small delay so it doesn't flash on every page load
      const timer = setTimeout(() => {
        setShow(true);
        // Trigger entrance animation after mount
        requestAnimationFrame(() => setIsVisible(true));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    // Animate out, then unmount
    setIsVisible(false);
    setTimeout(() => {
      setShow(false);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 350);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cài đặt ứng dụng ThoPOS"
      className={`fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-350 ease-in-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Backdrop blur overlay above the banner */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-emerald-100 shadow-2xl shadow-black/10 mx-0 rounded-t-2xl px-5 pt-5 pb-6">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Đóng banner cài đặt"
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {/* App icon preview */}
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md flex-shrink-0 border border-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/apple-touch-icon.png"
              alt="ThoPOS icon"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-[15px] leading-tight">
              📱 Cài đặt Ứng dụng Thỏ POS
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Truy cập nhanh hơn, như ứng dụng thật sự
            </p>
          </div>
        </div>

        {/* Step-by-step instructions */}
        <ol className="space-y-3">
          {/* Step 1 */}
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center mt-0.5">
              1
            </span>
            <div className="flex-1">
              <p className="text-sm text-slate-700 leading-snug">
                Bấm vào biểu tượng{' '}
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                  <Share className="w-3.5 h-3.5 text-blue-500" /> Chia sẻ
                </span>{' '}
                ở thanh công cụ Safari phía dưới màn hình.
              </p>
            </div>
          </li>

          {/* Step 2 */}
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center mt-0.5">
              2
            </span>
            <div className="flex-1">
              <p className="text-sm text-slate-700 leading-snug">
                Cuộn xuống và chọn{' '}
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                  <Plus className="w-3.5 h-3.5 text-blue-500" />
                  &ldquo;Thêm vào Màn hình chính&rdquo;
                </span>{' '}
                (Add to Home Screen).
              </p>
            </div>
          </li>
        </ol>

        {/* Dismiss text button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full mt-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-600 transition active:scale-95"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
