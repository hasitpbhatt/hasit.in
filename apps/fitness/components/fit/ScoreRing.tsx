export function ScoreRing({ score }: { score: number }) {
  const r = 54, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm" role="status" aria-label={`Fit score ${score}`}>
      <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#eee" strokeWidth="12" />
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1A7F4D" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} transform="rotate(-90 65 65)" />
        <text x="65" y="72" textAnchor="middle" fontSize="28" fontWeight="800" fill="#1A1A1A" className="tabular">{score}</text>
      </svg>
      <div><p className="font-bold">Fit Score</p><p className="text-muted text-base">Wajan • Khana • Pani • Walk • Workout</p></div>
    </div>
  );
}
