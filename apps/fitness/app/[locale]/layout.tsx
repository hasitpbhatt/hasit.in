import '../globals.css';
import {notFound} from 'next/navigation';
import {LocaleProvider, type AppLocale} from '@/lib/locale';
const locales: AppLocale[] = ['en', 'hi', 'gu'];
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export default function LocaleLayout({ children, params: {locale} }: { children: React.ReactNode; params: { locale: string } }) {
  const appLocale = locales.find((supportedLocale) => supportedLocale === locale);
  if (!appLocale) notFound();
  return (
    <html lang={locale}>
      <body><LocaleProvider locale={appLocale}>
        <main className="mx-auto max-w-xl px-4 pb-16 pt-6">{children}</main>
      </LocaleProvider></body>
    </html>
  );
}
