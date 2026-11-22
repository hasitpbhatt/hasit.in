'use client';
import { useState } from 'react';
import { useAppLocale } from '@/lib/locale';
import { searchFoods, type Food } from '@/lib/foods';
import { LangSwitcher } from '@/components/fit/LangSwitcher';
import { todayKey } from '@/lib/store';
import { supabaseBrowser } from '@/lib/supabase/client';

function addKcal(kcal: number, protein: number) {
  try {
    const raw = localStorage.getItem('fitos-draft');
    const d = raw ? JSON.parse(raw) : { date: todayKey() };
    const prev = d.date === todayKey() ? d : { date: todayKey() };
    localStorage.setItem('fitos-draft', JSON.stringify({ ...prev, kcalEaten: (prev.kcalEaten ?? 0) + kcal, proteinEaten: (prev.proteinEaten ?? 0) + protein }));
  } catch { /* */ }
}

export default function FoodPage() {
  const locale = useAppLocale();
  const [q, setQ] = useState('');
  const [logged, setLogged] = useState<string | null>(null);
  const results = searchFoods(q);
  async function log(f: Food) {
    addKcal(f.kcal, f.protein);
    setLogged(f.id);
    try {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (user) await sb.from('food_logs').insert({ user_id: user.id, date: todayKey(), item: f.en, qty: f.unit, kcal: f.kcal, protein_g: f.protein });
    } catch { /* local draft already saved */ }
    setTimeout(() => setLogged(null), 1500);
  }
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><LangSwitcher /></div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={locale === 'gu' ? 'શોધો: પનીર, દાળ, રોટલી…' : locale === 'hi' ? 'खोजें: पनीर, दाल, रोटी…' : 'Search: paneer, dal, roti…'} className="rounded-2xl border p-4 min-h-[56px]" aria-label="Search food" />
      {results.map((f) => (
        <div key={f.id} className="rounded-2xl bg-white p-4 shadow-sm flex justify-between items-center gap-3">
          <div><p className="font-bold">{locale === 'gu' ? f.gu : locale === 'hi' ? f.hi : f.en}</p><p className="text-sm text-muted">{f.en}</p></div>
          <div className="text-right shrink-0">
            <p className="tabular text-sm">{f.kcal} kcal • {f.protein}g P</p>
            <button onClick={() => log(f)} className="mt-1 rounded-xl bg-leaf px-4 py-2 text-sm font-bold text-white min-h-[44px]">
              {logged === f.id ? '✓' : '+ Log'}
            </button>
          </div>
        </div>
      ))}
      <a href="today" className="text-center text-sm text-muted underline">→ Today score updates</a>
    </div>
  );
}
