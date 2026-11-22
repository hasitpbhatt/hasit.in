'use client';
import { useMemo, useState } from 'react';
import { useAppLocale } from '@/lib/locale';
import { planFor, type Cond, type Goal } from '@/lib/calc';
import { workoutsFor } from '@/lib/workouts';
import { LangSwitcher } from '@/components/fit/LangSwitcher';
import { STR } from '@/lib/strings';
import { loadDraft, saveDraft, todayKey } from '@/lib/store';
import { supabaseBrowser } from '@/lib/supabase/client';

const CONDS: Cond[] = ['diabetes', 'bp', 'thyroid', 'pcos'];
const GOALS: Goal[] = ['lose', 'gain', 'maintain', 'muscle', 'growth'];
export default function Quiz() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ age: 42, sex: 'female' as 'female' | 'male', cm: 165, kg: 88, target: 72, tadka: 3, chai: 1, timeMin: 20, equipment: 'none', joint: false, family: true, cond: [] as Cond[], sleep: 7, goal: 'lose' as Goal });
  const locale = useAppLocale();
  const L = (locale === 'hi' || locale === 'gu' ? locale : 'en') as 'en' | 'hi' | 'gu';
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCond = (c: Cond) => setForm((f) => ({ ...f, cond: f.cond.includes(c) ? f.cond.filter((x) => x !== c) : [...f.cond, c] }));
  async function savePlan() {
    try { saveDraft({ ...loadDraft(), date: todayKey(), kcalTarget: plan.kcal }); } catch { /* */ }
    try {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.from('profiles').upsert({ user_id: user.id, age: form.age, sex: form.sex, height_cm: form.cm, weight_kg: form.kg, target_kg: form.target, lang: L, conditions: form.cond, joint_issue: form.joint, time_min: form.timeMin, equipment: form.equipment, sleep_hr: form.sleep, family_cook: form.family, goal: form.goal });
    } catch { /* local-only until login */ }
  }
  const plan = useMemo(() => planFor({ sex: form.sex, kg: form.kg, cm: form.cm, age: form.age, cond: form.cond, joint: form.joint, timeMin: form.timeMin, equipment: form.equipment, goal: form.goal }), [form]);
  const wl = useMemo(() => workoutsFor(plan.level), [plan.level]);
  const steps = ['Basics', 'Body', 'Kitchen+Time', 'Health', 'Plan'];
  const inp = 'rounded-xl border p-4 min-h-[56px] w-full';
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2"><LangSwitcher /></div>
      <p className="text-sm text-muted">Step {step + 1}/5 — {steps[step]}</p>
      {step === 0 && (
        <div className="grid gap-3">
          <p className="font-bold">{STR.quiz.goalTitle[L]} • Goal</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g} onClick={() => set('goal', g)} aria-pressed={form.goal === g}
                className={`rounded-xl border px-4 py-3 min-h-[48px] font-bold ${form.goal === g ? 'bg-leaf text-white' : ''}`}>{STR.goal[g][L]} • {g}</button>
            ))}
          </div>
          <label className="grid gap-1">Age<input type="number" value={form.age} onChange={(e) => set('age', +e.target.value)} className={inp} /></label>
          <label className="grid gap-1">Sex<select value={form.sex} onChange={(e) => set('sex', e.target.value)} className={inp}><option value="female">Female</option><option value="male">Male</option></select></label>
          <label className="grid gap-1">Time/day<select value={form.timeMin} onChange={(e) => set('timeMin', +e.target.value)} className={inp}><option value={12}>12 min (Priya)</option><option value={20}>20 min</option><option value={30}>30 min</option></select></label>
          <label className="grid gap-1">Equipment<select value={form.equipment} onChange={(e) => set('equipment', e.target.value)} className={inp}><option value="none">None (home/chair)</option><option value="dumbbell">Dumbbells (Hiren)</option><option value="gym">Gym</option></select></label>
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-3">
          <label className="grid gap-1">Height cm<input type="number" value={form.cm} onChange={(e) => set('cm', +e.target.value)} className={inp} /></label>
          <label className="grid gap-1">Weight kg<input type="number" value={form.kg} onChange={(e) => set('kg', +e.target.value)} className={inp} /></label>
          <label className="grid gap-1">Target kg<input type="number" value={form.target} onChange={(e) => set('target', +e.target.value)} className={inp} /></label>
          <label className="flex items-center gap-3 rounded-xl border p-4 min-h-[56px]"><input type="checkbox" checked={form.joint} onChange={(e) => set('joint', e.target.checked)} className="h-6 w-6" /> Knee/joint pain? (chair-only plan)</label>
        </div>
      )}
      {step === 2 && (
        <div className="grid gap-3">
          <label className="grid gap-1">Tadka spoons/day<input type="number" value={form.tadka} onChange={(e) => set('tadka', +e.target.value)} className={inp} /></label>
          <label className="grid gap-1">Chai cups/day<input type="number" value={form.chai} onChange={(e) => set('chai', +e.target.value)} className={inp} /></label>
          <label className="flex items-center gap-3 rounded-xl border p-4 min-h-[56px]"><input type="checkbox" checked={form.family} onChange={(e) => set('family', e.target.checked)} className="h-6 w-6" /> Cook for family? (same sabzi, adjust roti only)</label>
          <label className="grid gap-1">Sleep hrs<input type="number" value={form.sleep} onChange={(e) => set('sleep', +e.target.value)} className={inp} /></label>
        </div>
      )}
      {step === 3 && (
        <div className="grid gap-3">
          <p className="font-bold">Conditions • તકલીફ • तकलीफ</p>
          <div className="flex flex-wrap gap-2">
            {CONDS.map((c) => (
              <button key={c} onClick={() => toggleCond(c)} aria-pressed={form.cond.includes(c)}
                className={`rounded-xl border px-4 py-3 min-h-[48px] font-bold ${form.cond.includes(c) ? 'bg-leaf text-white' : ''}`}>{STR.cond[c][L]}</button>
            ))}
          </div>
          <p className="text-sm text-muted">Not medical advice. Diabetes/BP/thyroid/PCOS or meds → consult doctor. Fafda-jalebi 1x/wk capped, dinner by 8:30.</p>
          {(form.age < 18 || form.goal === 'growth') && (
            <label className="flex items-center gap-3 rounded-xl border p-4 min-h-[56px] bg-cream"><input type="checkbox" checked={(form as { parentOk?: boolean }).parentOk ?? false} onChange={(e) => set('parentOk', e.target.checked)} className="h-6 w-6" /> Parent aware + OK? (18 હેઠળ જરૂરી • 18 से कम जरूरी)</label>
          )}
        </div>
      )}
      {step === 4 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm grid gap-2">
          <p className="font-bold">Your plan: {plan.kcal} kcal • {plan.protein}g protein • {plan.water}ml • {plan.steps} steps • {plan.level}</p>
          {plan.notes.map((n) => <p key={n} className="text-muted text-base">• {n}</p>)}
          {wl[0] && <p className="text-base">Start: {wl[0].title} ({wl[0].gu}) — {wl[0].min} min {wl[0].jointSafe ? '• knee-safe' : ''}</p>}
          <p className="text-muted text-base">Thali: 2 roti + 1 dal + 2 sabzi + 1 curd + salad. Oil ≤3 tadka, chai ≤2 no sugar.</p>
          <a href="today" onClick={() => { void savePlan(); }} className="rounded-2xl bg-leaf px-6 py-4 text-center font-bold text-white">{STR.quiz.start[L]}</a>
        </div>
      )}
      <div className="flex gap-3">
        {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-xl border px-5 py-3 min-h-[48px]">{STR.quiz.back[L]}</button>}
        {step < 4 && <button onClick={() => setStep(step + 1)} className="rounded-xl bg-ink px-5 py-3 font-bold text-white min-h-[48px]">{STR.quiz.next[L]}</button>}
      </div>
    </div>
  );
}
