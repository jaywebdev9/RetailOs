'use client';

import { create } from 'zustand';
import { messages, Locale, MessageKey } from './messages';

type I18nStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

export const useI18n = create<I18nStore>((set, get) => ({
  locale:
    (typeof window !== 'undefined' &&
      (localStorage.getItem('locale') as Locale)) ||
    'en',
  setLocale: (locale) => {
    if (typeof window !== 'undefined') localStorage.setItem('locale', locale);
    set({ locale });
  },
  t: (key) => {
    const { locale } = get();
    return messages[locale][key] || messages.en[key] || key;
  },
}));
