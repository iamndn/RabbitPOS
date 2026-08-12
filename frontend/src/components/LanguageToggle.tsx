'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function LanguageToggle() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="inline-flex items-center bg-indigo-700/80 p-0.5 rounded-xl border border-indigo-500/40 text-xs">
      <button
        type="button"
        onClick={() => setLocale('vi')}
        className={`px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
          locale === 'vi'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-indigo-200 hover:text-white'
        }`}
        title="Tiếng Việt"
      >
        <span>🇻🇳</span> VI
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
          locale === 'en'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-indigo-200 hover:text-white'
        }`}
        title="English"
      >
        <span>🇬🇧</span> EN
      </button>
    </div>
  );
}
