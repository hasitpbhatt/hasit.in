'use client';

import en from '../../messages/en.json';
import hi from '../../messages/hi.json';
import gu from '../../messages/gu.json';
import Link from 'next/link';
import { useAppLocale } from '@/lib/locale';
import { LangSwitcher } from '@/components/fit/LangSwitcher';
export default function Landing() {
  const locale = useAppLocale();
  const landing = locale === 'en' ? en.landing : locale === 'hi' ? hi.landing : gu.landing;
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><LangSwitcher /></div>
      <h1 className="text-3xl font-extrabold">{landing.title}</h1>
      <p className="text-muted">{landing.sub}</p>
      <Link href="quiz" className="rounded-2xl bg-leaf px-6 py-4 text-center font-bold text-white min-h-[56px]">{landing.cta}</Link>
      <p className="text-sm text-muted">{landing.proof}</p>
    </div>
  );
}
