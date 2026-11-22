export type Level = 'chair' | 'express-12' | 'home-20' | 'dumbbell-starter';
export interface Workout { id: string; level: Level; title: string; gu: string; min: number; jointSafe: boolean; steps: string[]; }
export const WORKOUTS: Workout[] = [
  { id: 'chair-a', level: 'chair', title: 'Chair basic (knee-safe)', gu: 'ખુરશી વ્યાયામ (ઘૂંટણ સેફ)', min: 12, jointSafe: true, steps: ['Seated march 2min', 'Chair sit-stand 8x2', 'Seated arm raise 10x2', 'Ankle circles 1min/side', 'Deep breathe 1min'] },
  { id: 'chair-b', level: 'chair', title: 'Chair yoga flow', gu: 'ખુરશી યોગા', min: 15, jointSafe: true, steps: ['Neck/shoulder rolls 2min', 'Seated twist 5x/side', 'Seated leg lift 8x2', 'Wall push 8x2', 'Walk-in-place seated 3min'] },
  { id: 'exp-a', level: 'express-12', title: '12-min express', gu: '12-મિનિટ એક્સપ્રેસ', min: 12, jointSafe: false, steps: ['Brisk march 2min', 'Squat 10x2', 'Wall push 10x2', 'Glute bridge 10x2', 'Plank-knee 20s x2'] },
  { id: 'home-a', level: 'home-20', title: '20-min home', gu: '20-મિનિટ ઘરે', min: 20, jointSafe: false, steps: ['Walk warmup 3min', 'Squat 12x3', 'Push (wall/knee) 10x3', 'Lunge-alt 8x2', 'Dead-bug 8x2', 'Stretch 2min'] },
  { id: 'db-a', level: 'dumbbell-starter', title: 'Dumbbell starter A', gu: 'ડમ્બેલ શરૂઆત A', min: 25, jointSafe: false, steps: ['Goblet squat 10x3', 'DB row 10x3', 'DB floor press 10x3', 'RDL light 10x2', 'Farmer walk 2min'] },
  { id: 'db-b', level: 'dumbbell-starter', title: 'Dumbbell starter B', gu: 'ડમ્બેલ શરૂઆત B', min: 25, jointSafe: false, steps: ['Step-up chair 8x2', 'Overhead press 10x3', 'Glute bridge+DB 12x2', 'Curl+press 8x2', 'Stretch 3min'] },
  { id: 'walk-meal', level: 'express-12', title: '10-min post-meal walk', gu: 'જમ્યા પછી 10-મિનિટ ચાલવું', min: 10, jointSafe: true, steps: ['Easy walk 10min after lunch/dinner', 'Diabetes/BP priority'] },
];
export function workoutsFor(level: string): Workout[] { return WORKOUTS.filter((w) => w.level === level); }
