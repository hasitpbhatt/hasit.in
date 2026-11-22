'use client';
import { usePathname } from 'next/navigation';
export function LangSwitcher() {
  const path = (usePathname() || '/gu').replace(/^\/apps\/fitness/, '');
  const rest = path.replace(/^\/(en|hi|gu)/, '') || '/';
  const btn = 'rounded-lg border px-3 py-2 text-sm font-bold min-h-[44px]';
  return (
    <nav aria-label="Language" className="flex gap-2">
      <a href={`/apps/fitness/en${rest}`} className={btn} hrefLang="en">EN</a>
      <a href={`/apps/fitness/hi${rest}`} className={btn} hrefLang="hi">हिंदी</a>
      <a href={`/apps/fitness/gu${rest}`} className={btn} hrefLang="gu">ગુજરાતી</a>
    </nav>
  );
}
