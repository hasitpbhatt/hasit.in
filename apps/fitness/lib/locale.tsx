'use client';

import { createContext, useContext } from 'react';

export type AppLocale = 'en' | 'hi' | 'gu';

const LocaleContext = createContext<AppLocale>('gu');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useAppLocale(): AppLocale {
  return useContext(LocaleContext);
}
