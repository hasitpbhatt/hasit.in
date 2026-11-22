'use client';
import { useEffect, useState } from 'react';
import { avg7 } from '@/lib/store';
import { supabaseBrowser } from '@/lib/supabase/client';

interface Pt { date: string; kg: number; }
function Trend({ pts }: { pts: Pt[] }) {
  if (pts.length < 2) return <p className="text-muted">Log weight 2+ days to see trend.</p>;
  const min = Math.min(...pts.map((p) => p.kg)) - 1, max = Math.max(...pts.map((p) => p.kg)) + 1;
  const W = 320, H = 120;
  const xy = pts.slice(-14).map((p, i, a) => {
    const x = (i / Math.max(1, a.length - 1)) * (W - 16) + 8;
    const y = H - 12 - ((p.kg - min) / Math.max(0.1, max - min)) * (H - 32);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight trend" className="w-full">
      <polyline points={xy} fill="none" stroke="#1A7F4D" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Progress() {
  const [pts, setPts] = useState<Pt[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data } = await sb.from('weight_logs').select('date,kg').order('date').limit(30);
        if (data) setPts(data as Pt[]);
      } catch { /* local-only */ }
    })();
  }, []);
  const avg = avg7(pts);
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="font-bold">Weight trend (7-day avg: {avg ?? '—'} kg)</p>
        <Trend pts={pts} />
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="font-bold">Export / Delete (DPDP)</p>
        <p className="text-sm text-muted">Email support@fitos.in from your login email to export or erase all data. 48hr SLA.</p>
      </div>
    </div>
  );
}
