'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAppLocale } from '@/lib/locale';
import { ScoreRing } from '@/components/fit/ScoreRing';
import { BigLogCard } from '@/components/fit/BigLogCard';
import { XLToggle } from '@/components/fit/XLToggle';
import { LangSwitcher } from '@/components/fit/LangSwitcher';
import { STR } from '@/lib/strings';
import { fitScore } from '@/lib/score';
import { loadDraft, saveDraft, todayKey, kcalAdherence } from '@/lib/store';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Today() {
  const locale = useAppLocale();
  const L = (locale === 'hi' || locale === 'gu' ? locale : 'en') as 'en' | 'hi' | 'gu';
  const [kg, setKg] = useState<string>('');
  const [water, setWater] = useState(0);
  const [steps, setSteps] = useState(0);
  const [workout, setWorkout] = useState(false);
  const [eaten, setEaten] = useState(0);
  const [target, setTarget] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    if (d.kg) setKg(String(d.kg));
    setWater(d.waterMl ?? 0);
    setSteps(d.steps ?? 0);
    setWorkout(!!d.workout);
    setEaten(d.kcalEaten ?? 0);
    setTarget(d.kcalTarget ?? 0);
  }, []);
  useEffect(() => {
    saveDraft({ ...loadDraft(), date: todayKey(), kg: kg ? +kg : undefined, waterMl: water, steps, workout });
  }, [kg, water, steps, workout]);

  const score = useMemo(
    () => fitScore({ weightLogged: !!kg, kcalRatio: kcalAdherence(eaten, target), waterRatio: water / 2800, stepsRatio: steps / 8000, workoutDone: workout }),
    [kg, eaten, target, water, steps, workout]
  );

  async function persist() {
    setSaved(false);
    try {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setSaved(true); return; } // local-only until login
      const date = todayKey();
      if (kg) await sb.from('weight_logs').upsert({ user_id: user.id, date, kg: +kg }, { onConflict: 'user_id,date' });
      if (water) await sb.from('water_logs').insert({ user_id: user.id, date, ml: water });
      await sb.from('activity_logs').upsert({ user_id: user.id, date, steps, workout_done: workout, score }, { onConflict: 'user_id,date' });
    } catch { /* local draft already saved */ }
    setSaved(true);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <LangSwitcher />
        <XLToggle />
      </div>
      <ScoreRing score={score} />
      <BigLogCard title={`${STR.today.weight[L]} • Wajan`} sub="kg, morning • સવારે • सुबह" action={
        <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="88" aria-label="Weight kg"
          className="w-24 rounded-xl border p-3 text-center tabular min-h-[48px]" />
      } />
      <BigLogCard title={`${STR.today.water[L]} • Pani`} sub={`${water} / 2800 ml`} action={
        <div className="flex gap-2">
          <button onClick={() => setWater(Math.max(0, water - 250))} className="rounded-xl border px-4 py-3 min-h-[48px]" aria-label="Less water">−</button>
          <button onClick={() => setWater(water + 250)} className="rounded-xl bg-leaf px-4 py-3 font-bold text-white min-h-[48px]" aria-label="Add water">+250</button>
        </div>
      } />
      <BigLogCard title={`${STR.today.waterWalk[L]}`} sub={`${steps} / 8000 • પગલાં • कदम`} action={
        <div className="flex gap-2">
          <button onClick={() => setSteps(Math.max(0, steps - 1000))} className="rounded-xl border px-4 py-3 min-h-[48px]" aria-label="Less steps">−</button>
          <button onClick={() => setSteps(steps + 1000)} className="rounded-xl bg-leaf px-4 py-3 font-bold text-white min-h-[48px]" aria-label="Add steps">+1k</button>
        </div>
      } />
      <BigLogCard title={`${STR.today.workout[L]}`} sub="12-20 min • 3x/wk • ઘૂંટણ-સેફ વિકલ્પ" action={
        <button onClick={() => setWorkout(!workout)} aria-pressed={workout}
          className={`rounded-xl px-5 py-3 font-bold min-h-[48px] ${workout ? 'bg-haldi text-ink' : 'bg-ink text-white'}`}>
          {workout ? 'Done ✓' : 'Tick'}
        </button>
      } />
      <button onClick={persist} className="rounded-2xl bg-leaf px-6 py-4 font-bold text-white min-h-[56px]">{STR.today.save[L]}</button>
      {saved && <p className="text-center text-sm text-leaf font-bold">{STR.today.saved[L]}</p>}
      <a href="progress" className="text-center text-sm text-muted underline">{STR.today.progress[L]}</a>
    </div>
  );
}
