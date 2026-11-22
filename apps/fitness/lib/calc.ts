export type Sex = 'female' | 'male';
export function mifflinKcal(sex: Sex, kg: number, cm: number, age: number, activity = 1.375): number {
  const bmr = sex === 'male' ? 10 * kg + 6.25 * cm - 5 * age + 5 : 10 * kg + 6.25 * cm - 5 * age - 161;
  return Math.round(bmr * activity);
}
export function deficitTarget(maint: number, sex: Sex): number {
  return Math.max(sex === 'male' ? 1500 : 1400, maint - 500);
}
export function proteinTarget(kg: number, cond: string[] = []): number {
  const perKg = cond.includes('pcos') ? 1.4 : 1.2;
  return Math.round(kg * perKg);
}
export function waterTargetMl(kg: number): number { return Math.round(kg * 35); }

export type Cond = 'diabetes' | 'bp' | 'thyroid' | 'pcos';
export type Goal = 'lose' | 'gain' | 'maintain' | 'muscle' | 'growth';
export interface PlanIn { sex: Sex; kg: number; cm: number; age: number; cond: Cond[]; joint: boolean; timeMin: number; equipment: string; goal: Goal; }
export interface PlanOut { kcal: number; protein: number; water: number; steps: number; level: string; notes: string[]; }
function proteinPerKg(goal: Goal, cond: string[]): number {
  if (goal === 'muscle' || goal === 'gain') return 1.6;
  if (cond.includes('pcos')) return 1.4;
  if (goal === 'maintain' || goal === 'growth') return 1.2;
  return 1.2;
}
export function planFor(p: PlanIn): PlanOut {
  const maint = mifflinKcal(p.sex, p.kg, p.cm, p.age);
  const notes: string[] = [];
  const floor = p.sex === 'male' ? 1500 : 1400;
  let kcal: number;
  // Growth (teens): NEVER deficit. Habits + strength + sleep.
  if (p.goal === 'growth' || p.age < 18) {
    kcal = maint;
    notes.push('Growth: no dieting, no deficit. Eat maint, protein + milk, sleep 8-9hr, strength 2-3x/wk. Parent + doctor aware.');
    if (p.age < 18) notes.push('Under 18: parent consent required, weigh max 1x/wk, habits > weight.');
  } else if (p.goal === 'gain') {
    kcal = maint + 300; notes.push('Healthy gain +0.25kg/wk: +300 surplus. Budget proteins: peanut 30g, banana 2, milk 500ml, soya 50g, sattu — no costly whey needed.');
  } else if (p.goal === 'muscle') {
    kcal = maint + 150; notes.push('Lean muscle: small +150 surplus (or maint if overweight), protein 1.6g/kg, progressive dumbbells.');
  } else if (p.goal === 'maintain') {
    kcal = maint; notes.push('Maintain: eat to maint, weigh 1x/wk, keep steps + strength.');
  } else if (p.cond.includes('thyroid')) { kcal = Math.max(floor, maint - 250); notes.push('Thyroid: slow 0.25kg/wk target.'); }
  else if (p.cond.includes('diabetes')) { kcal = Math.max(p.sex === 'male' ? 1600 : 1500, maint - 400); notes.push('Diabetes: no crash diet. Doctor + meds first. Sugar ≤1tsp/day, dinner by 8:30.'); }
  else kcal = deficitTarget(maint, p.sex);
  const protein = Math.round(p.kg * proteinPerKg(p.goal, p.cond));
  const steps = p.cond.includes('pcos') || p.cond.includes('diabetes') ? 10000 : p.goal === 'muscle' || p.goal === 'gain' ? 8000 : 8000;
  let level = 'home-20';
  if (p.goal === 'growth' && p.joint) { level = 'chair'; notes.push('Knee-safe youth: chair + play, no max lifts.'); }
  else if (p.joint) { level = 'chair'; notes.push('Knee-safe: chair-only, no floor, no stairs.'); }
  else if (p.goal === 'muscle' || p.goal === 'gain') { level = p.equipment === 'none' ? 'home-20' : 'dumbbell-starter'; notes.push('Strength 3x/wk progressive. Eat protein within family thali.'); }
  else if (p.timeMin <= 12) { level = 'express-12'; notes.push('12-min express default.'); }
  else if (p.equipment === 'dumbbell' || p.equipment === 'gym') { level = 'dumbbell-starter'; notes.push('Dumbbell starter 3x/wk.'); }
  if (p.cond.includes('bp')) notes.push('BP: low salt, walk daily, no breath-hold lifts.');
  if (p.cond.includes('pcos')) notes.push('PCOS: protein-first + 10k steps + sleep 7-8hr.');
  return { kcal, protein, water: waterTargetMl(p.kg), steps, level, notes };
}
