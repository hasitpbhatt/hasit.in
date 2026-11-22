export interface DayInputs { weightLogged: boolean; kcalRatio: number; waterRatio: number; stepsRatio: number; workoutDone: boolean; }
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function fitScore(d: DayInputs): number {
  const w = (d.weightLogged ? 1 : 0) * 20;
  const f = clamp(d.kcalRatio) * 30;
  const h = clamp(d.waterRatio) * 10;
  const s = clamp(d.stepsRatio) * 15;
  const wo = (d.workoutDone ? 1 : 0) * 25;
  return Math.round(w + f + h + s + wo);
}
