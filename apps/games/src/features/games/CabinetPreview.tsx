import type { GameId } from '../../lib/points'

interface PreviewProps {
  game: GameId
  accent: string
}

const W = 72
const H = 72

function svgr(attrs: Record<string, unknown>, children: React.ReactNode) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      shapeRendering="crispEdges"
      aria-hidden="true"
      fill="none"
      {...attrs}
    >
      {children}
    </svg>
  )
}

const PREVIEWS: Record<GameId, (accent: string) => React.ReactNode> = {
  memory: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.25)" />,
    <g key="g">
      {[0, 1, 2, 3].map((i) => {
        const x = 12 + (i % 2) * 26
        const y = 12 + Math.floor(i / 2) * 26
        const flipped = i === 0
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            <rect width={22} height={26} rx={3} fill={flipped ? a : 'rgba(15,15,20,0.5)'} />
            {flipped && <text x={11} y={18} textAnchor="middle" fontSize={14}>🍒</text>}
          </g>
        )
      })}
    </g>,
  ]),
  whack: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.35)" />,
    <g key="g" fill="rgba(15,15,20,0.6)">
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 20 + (i % 3) * 18
        const y = 16 + Math.floor(i / 3) * 18
        return <circle key={i} cx={x} cy={y} r={8} />
      })}
    </g>,
    <g key="m" transform="translate(36,34)">
      <circle cx={0} cy={0} r={11} fill={a} />
      <circle cx={0} cy={0} r={7} fill="rgba(0,0,0,0.45)" />
    </g>,
  ]),
  snake: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.25)" />,
    <g key="g" stroke={a} strokeWidth={6} fill="none" strokeLinecap="round">
      <path d="M20 56 C28 40, 40 24, 52 20 C58 18, 60 26, 52 32 C46 36, 40 44, 46 52" />
    </g>,
    <circle key="h" cx={52} cy={32} r={5} fill="#4ade80" />,
  ]),
  toadhop: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.35)" />,
    <ellipse key="l1" cx={36} cy={52} rx={22} ry={8} fill="rgba(34,211,230,0.22)" stroke="rgba(34,211,230,0.45)" />,
    <ellipse key="l2" cx={20} cy={44} rx={14} ry={6} fill="rgba(34,211,230,0.18)" stroke="rgba(34,211,230,0.38)" />,
    <circle key="f" cx={36} cy={36} r={9} fill={a} />,
  ]),
  typing: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.25)" />,
    <rect key="k" x={10} y={46} width={52} height={16} rx={3} fill="rgba(15,15,20,0.5)" />,
    <rect key="t1" x={10} y={22} width={8} height={10} fill={a} />,
    <rect key="t2" x={21} y={22} width={8} height={10} fill={a} />,
    <rect key="t3" x={32} y={22} width={8} height={10} fill={a} />,
    <rect key="t4" x={43} y={22} width={8} height={10} fill={a} />,
    <rect key="c" x={54} y={22} width={3} height={10} fill={a} />,
  ]),
  pinpoint: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.3)" />,
    <circle key="r1" cx={36} cy={36} r={18} fill="transparent" stroke="rgba(135,206,250,0.45)" strokeWidth={2} />
    ,<circle key="r2" cx={36} cy={36} r={11} fill="transparent" stroke="rgba(135,206,250,0.3)" strokeWidth={2} />
    ,<circle key="d" cx={36} cy={36} r={4} fill={a} />
  ]),
  wordladder: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.25)" />,
    <text key="w1" x={16} y={26} fontSize={12} fill="rgba(203,213,255,0.85)" textAnchor="middle">COLD</text>
    ,<text key="w2" x={16} y={58} fontSize={12} fill="rgba(203,213,255,0.85)" textAnchor="middle">GOLD</text>
    ,pathArrow(a),
  ]),
  anagram: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.32)" />,
    <g key="g">
      {['L','I','S','T'].map((ch, i) => (
        <text key={i} x={22 + i * 13} y={42} fontSize={13} fontWeight={700} fill={a} textAnchor="middle">{ch}</text>
      ))}
    </g>,
  ]),
  panel: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.35)" />,
    <g key="g" stroke="rgba(129,140,248,0.25)" strokeWidth={1}>
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}-${c}`} x={16 + c * 14} y={16 + r * 14} width={14} height={14} rx={2}
          fill={r === c || (r + c) === 2 ? a : 'rgba(15,15,20,0.4)'} />
      )))}
    </g>,
  ]),
  queens: (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.35)" />,
    <g key="g" stroke="rgba(167,139,255,0.2)" strokeWidth={1}>
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
        <rect key={`s${r}-${c}`} x={14 + c * 12} y={14 + r * 12} width={12} height={12}
          fill={(r + c) % 2 ? 'rgba(15,15,20,0.5)' : 'rgba(25,25,35,0.6)'} />
      )))}
    </g>,
    <text key="q" x={36} y={50} fontSize={16} textAnchor="middle" fill={a}>👑</text>,
  ]),
  tango: (_a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.35)" />,
    <g key="g">
      {[0, 1, 2, 3].map((i) => {
        const x = 16 + (i % 2) * 18
        const y = 16 + Math.floor(i / 2) * 18
        const sun = i % 2 === 0
        return (
          <g key={i} transform={`translate(${x},${y})`} fill={sun ? '#fbbf24' : '#818cf8'}>
            <circle cx={9} cy={9} r={7} />
            <text x={9} y={12} fontSize={9} fill={sun ? '#422006' : '#fff'} textAnchor="middle">👑</text>
          </g>
        )
      })}
    </g>,
  ]),
  '2048': (a) => svgr({ className: 'cp' }, [
    <rect key="b" x={2} y={2} width={68} height={68} rx={6} fill="rgba(0,0,0,0.35)" />,
    <g key="g">
      {[0, 1, 2, 3].map((i) => {
        const x = 14 + (i % 2) * 26
        const y = 14 + Math.floor(i / 2) * 26
        const merged = i === 1
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            <rect width={24} height={24} rx={3} fill={merged ? a : 'rgba(51,65,85,0.6)'} />
            <text x={12} y={16} fontSize={11} fill={merged ? '#052e16' : 'rgba(226,232,240,0.7)'} textAnchor="middle" fontWeight={700}>
              {merged ? '2048' : '...'}
            </text>
          </g>
        )
      })}
    </g>,
  ]),
  hangman: () => null,
  wordsearch: () => null,
}

function pathArrow(accent: string) {
  return (
    <path
      d="M12 36 C22 36, 26 48, 36 48 C46 48, 50 36, 60 36"
      fill="transparent"
      stroke={accent}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  )
}

export function CabinetPreview({ game, accent }: PreviewProps) {
  const render = PREVIEWS[game]
  return <div className="cabinet-preview" aria-hidden="true">{render?.(accent) ?? null}</div>
}
