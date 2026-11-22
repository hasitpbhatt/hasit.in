import { describe, expect, it } from 'vitest';
import { mifflinKcal, planFor } from './calc';
import { fitScore } from './score';
import { kcalAdherence } from './store';
import { workoutsFor } from './workouts';

describe('personas', () => {
  it('Kanta: joint → chair', () => {
    const p = planFor({ sex: 'female', kg: 89, cm: 155, age: 52, cond: [], joint: true, timeMin: 15, equipment: 'none', goal: 'lose' });
    expect(p.level).toBe('chair');
    expect(workoutsFor('chair').length).toBeGreaterThan(0);
  });
  it('Jignesh: diabetes floor + steps 10k', () => {
    const p = planFor({ sex: 'male', kg: 96, cm: 170, age: 44, cond: ['diabetes', 'bp'], joint: false, timeMin: 20, equipment: 'none', goal: 'lose' });
    expect(p.kcal).toBeGreaterThanOrEqual(1600);
    expect(p.steps).toBe(10000);
  });
  it('Priya: pcos protein 1.4 + express', () => {
    const p = planFor({ sex: 'female', kg: 78, cm: 160, age: 32, cond: ['pcos'], joint: false, timeMin: 12, equipment: 'none', goal: 'lose' });
    expect(p.protein).toBe(Math.round(78 * 1.4));
    expect(p.level).toBe('express-12');
  });
  it('Hiren: dumbbell starter', () => {
    const p = planFor({ sex: 'male', kg: 92, cm: 175, age: 28, cond: [], joint: false, timeMin: 30, equipment: 'dumbbell', goal: 'muscle' });
    expect(p.level).toBe('dumbbell-starter');
  });
  it('Daksha: thyroid slow deficit', () => {
    const std = planFor({ sex: 'female', kg: 82, cm: 158, age: 60, cond: [], joint: false, timeMin: 20, equipment: 'none', goal: 'lose' });
    const th = planFor({ sex: 'female', kg: 82, cm: 158, age: 60, cond: ['thyroid'], joint: true, timeMin: 20, equipment: 'none', goal: 'lose' });
    expect(th.kcal).toBeGreaterThan(std.kcal); // smaller deficit
    expect(th.level).toBe('chair');
  });
  it('score 0-100 bounded', () => {
    expect(fitScore({ weightLogged: true, kcalRatio: 2, waterRatio: 2, stepsRatio: 2, workoutDone: true })).toBe(100);
  });
  it('kcal adherence: on-target full, half-eaten half, double-eaten penalized', () => {
    expect(kcalAdherence(2000, 2000)).toBe(1);
    expect(kcalAdherence(0, 2000)).toBe(0);
    expect(kcalAdherence(1000, 2000)).toBeCloseTo(0.55, 1);
    expect(kcalAdherence(4000, 2000)).toBeLessThan(0.5);
    expect(kcalAdherence(0, 0)).toBe(0.6);
  });
});

describe('goals', () => {
  it('gain = maint +300, protein 1.6', () => {
    const m = mifflinKcal('male', 60, 175, 25);
    const p = planFor({ sex: 'male', kg: 60, cm: 175, age: 25, cond: [], joint: false, timeMin: 30, equipment: 'dumbbell', goal: 'gain' });
    expect(p.kcal).toBe(m + 300);
    expect(p.protein).toBe(Math.round(60 * 1.6));
  });
  it('maintain = maint', () => {
    const m = mifflinKcal('female', 65, 160, 35);
    const p = planFor({ sex: 'female', kg: 65, cm: 160, age: 35, cond: [], joint: false, timeMin: 20, equipment: 'none', goal: 'maintain' });
    expect(p.kcal).toBe(m);
  });
  it('muscle = maint +150, strength level', () => {
    const m = mifflinKcal('male', 75, 178, 28);
    const p = planFor({ sex: 'male', kg: 75, cm: 178, age: 28, cond: [], joint: false, timeMin: 30, equipment: 'dumbbell', goal: 'muscle' });
    expect(p.kcal).toBe(m + 150);
    expect(p.level).toBe('dumbbell-starter');
  });
  it('growth teen: never deficit, parent note', () => {
    const m = mifflinKcal('male', 55, 165, 15);
    const p = planFor({ sex: 'male', kg: 55, cm: 165, age: 15, cond: [], joint: false, timeMin: 20, equipment: 'none', goal: 'growth' });
    expect(p.kcal).toBe(m);
    expect(p.notes.join(' ')).toMatch(/Growth/);
  });
  it('P6 Aarav 14 lose-attempt forced to maint + parent note', () => {
    const m = mifflinKcal('male', 48, 165, 14);
    const p = planFor({ sex: 'male', kg: 48, cm: 165, age: 14, cond: [], joint: false, timeMin: 20, equipment: 'none', goal: 'lose' });
    expect(p.kcal).toBe(m); // guardrail: no deficit under 18
    expect(p.notes.join(' ')).toMatch(/Under 18/);
  });
  it('P7 Chetan 24 gainer budget note + protein 1.6', () => {
    const p = planFor({ sex: 'male', kg: 54, cm: 172, age: 24, cond: [], joint: false, timeMin: 30, equipment: 'dumbbell', goal: 'gain' });
    expect(p.protein).toBe(Math.round(54 * 1.6));
    expect(p.notes.join(' ')).toMatch(/Budget/);
  });
});
