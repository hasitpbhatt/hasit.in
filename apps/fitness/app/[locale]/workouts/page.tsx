import { WORKOUTS } from '@/lib/workouts';
export default function Workouts() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Workouts (joint-safe marked)</h1>
      {WORKOUTS.map((w) => (
        <div key={w.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-bold">{w.title} • {w.min} min {w.jointSafe && <span className="ml-2 rounded-full bg-leaf px-2 py-1 text-xs text-white">KNEE-SAFE</span>}</p>
          <p className="text-sm text-muted">{w.gu}</p>
          <ul className="mt-2 grid gap-1 text-base">{w.steps.map((s) => <li key={s}>• {s}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}
