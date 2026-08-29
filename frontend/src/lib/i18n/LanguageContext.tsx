'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import viDict from './locales/vi.json';
import enDict from './locales/en.json';

export type Locale = 'vi' | 'en';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const dictionaries: Record<Locale, Record<string, any>> = {
  vi: viDict,
  en: enDict,
};

const LanguageContext = createContext<LanguageContextType>({
  locale: 'vi',
  setLocale: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('vi');

  useEffect(() => {
    const saved = localStorage.getItem('rabbitpos_locale') as Locale | null;
    if (saved === 'vi' || saved === 'en') {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('rabbitpos_locale', newLocale);
  };

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = dictionaries[locale] || dictionaries.vi;
    const keys = key.split('.');
    let val: any = dict;

    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        val = null;
        break;
      }
    }

    if (typeof val !== 'string') {
      // Fallback to English if missing in current locale
      let fallbackVal: any = dictionaries.en;
      for (const k of keys) {
        if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
          fallbackVal = fallbackVal[k];
        } else {
          fallbackVal = null;
          break;
        }
      }
      val = typeof fallbackVal === 'string' ? fallbackVal : key;
    }

    if (params && typeof val === 'string') {
      Object.entries(params).forEach(([pKey, pVal]) => {
        const replacement = pVal !== undefined && pVal !== null ? String(pVal) : '';
        val = val.replace(new RegExp(`{${pKey}}`, 'g'), replacement);
        if (pKey === 'error') {
          val = val.replace(new RegExp(`{message}`, 'g'), replacement);
        } else if (pKey === 'message') {
          val = val.replace(new RegExp(`{error}`, 'g'), replacement);
        }
      });
    }

    return val;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
