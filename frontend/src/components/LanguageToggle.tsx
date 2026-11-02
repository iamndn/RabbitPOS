'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      role="group"
      aria-label="Ngôn ngữ / Language"
      className={`inline-flex items-center gap-1.5 p-1 rounded-full bg-slate-100/90 dark:bg-slate-800/80 border border-border-hairline text-caption font-semibold ${className || ''}`}
    >
      <Globe className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" aria-hidden="true" />
      <div className="inline-flex items-center p-0.5 rounded-full bg-slate-200/60 dark:bg-slate-900/40">
        <button
          type="button"
          onClick={() => setLocale('vi')}
          className={`px-2.5 py-1 rounded-full text-caption font-bold transition-all cursor-pointer ${
            locale === 'vi'
              ? 'bg-white text-brand-purple shadow-card font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-pressed={locale === 'vi'}
          title="Tiếng Việt"
        >
          VI
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-2.5 py-1 rounded-full text-caption font-bold transition-all cursor-pointer ${
            locale === 'en'
              ? 'bg-white text-brand-purple shadow-card font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-pressed={locale === 'en'}
          title="English"
        >
          EN
        </button>
      </div>
    </div>
  );
}
