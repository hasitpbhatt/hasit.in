export interface Draft { date: string; kg?: number; waterMl?: number; steps?: number; workout?: boolean; kcalEaten?: number; proteinEaten?: number; kcalTarget?: number; }
export function todayKey(): string { return new Date().toISOString().slice(0, 10); }
// Adherence 0-1 to personal target: 0.9-1.1 = full (works lose/gain/maintain). Growth: habits only.
export function kcalAdherence(eaten: number, target: number): number {
  if (!target) return 0.6;
  const r = eaten / target;
  if (r >= 0.9 && r <= 1.15) return 1;
  if (r < 0.9) return Math.max(0, r / 0.9);
  return Math.max(0, 1 - (r - 1.15) * 2);
}
export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem('fitos-draft');
    if (!raw) return { date: todayKey(), waterMl: 0, steps: 0 };
    const d = JSON.parse(raw) as Draft;
    return d.date === todayKey() ? { waterMl: 0, steps: 0, ...d } : { date: todayKey(), waterMl: 0, steps: 0 };
  } catch { return { date: todayKey(), waterMl: 0, steps: 0 }; }
}
export function saveDraft(d: Draft) {
  try { localStorage.setItem('fitos-draft', JSON.stringify(d)); } catch { /* ignore */ }
}
export function avg7(weights: { date: string; kg: number }[]): number | null {
  if (!weights.length) return null;
  const last = weights.slice(-7);
  return Math.round((last.reduce((a, b) => a + b.kg, 0) / last.length) * 10) / 10;
}
