'use client';
import { useEffect, useState } from 'react';
export function XLToggle() {
  const [xl, setXl] = useState(false);
  useEffect(() => {
    try { setXl(localStorage.getItem('fitos-xl') === '1'); } catch { /* */ }
  }, []);
  useEffect(() => {
    document.documentElement.style.fontSize = xl ? '20px' : '';
    try { localStorage.setItem('fitos-xl', xl ? '1' : '0'); } catch { /* */ }
  }, [xl]);
  return (
    <button onClick={() => setXl(!xl)} aria-pressed={xl} className="rounded-xl border px-4 py-2 text-sm font-bold min-h-[44px]">
      {xl ? 'A- (normal)' : 'A+ (મોટું)'}
    </button>
  );
}
