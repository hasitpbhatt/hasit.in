import type { ReactNode } from 'react';
export function BigLogCard({ title, sub, action }: { title: string; sub: string; action: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm flex items-center justify-between gap-3 min-h-[88px]">
      <div><p className="font-bold text-[19px]">{title}</p><p className="text-muted text-base">{sub}</p></div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
