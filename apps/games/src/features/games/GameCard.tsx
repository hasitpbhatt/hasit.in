import type { GameDef, GameId } from '../../lib/points'
import { CHAMBERS } from '../../lib/story'
import { useProgress } from '../../store/progress'

interface GameCardProps {
  game: GameDef
  index: number
  onPlay: (id: GameDef['id']) => void
}

const SCORE_UNIT: Partial<Record<GameId, string>> = {
  queens: ' s',
  tango: ' s',
  panel: ' s',
  '2048': ' tile',
}

export function GameCard({ game, index, onPlay }: GameCardProps) {
  const chamber = CHAMBERS[game.id]
  const purified = useProgress((s) => s.purified)
  const healed = purified.includes(game.id)

  const accent = chamber?.accent ?? 'var(--accent-1)'
  const accentSoft = chamber
    ? `color-mix(in srgb, ${chamber.accent} 16%, transparent)`
    : 'var(--border)'

  const thresholdText = chamber
    ? chamber.metric === 'tile'
      ? `Goal: ${chamber.threshold} tile`
      : `Goal: ${chamber.direction === 'lower' ? '≤' : '≥'} ${chamber.threshold}${SCORE_UNIT[game.id] ?? ' pts'}`
    : null

  return (
    <button
      type="button"
      className={`game-card${healed ? ' healed' : ''}`}
      style={{
        ['--i' as string]: index,
        ['--chamber' as string]: accent,
        ['--chamber-soft' as string]: accentSoft,
      }}
      onClick={() => onPlay(game.id)}
      aria-label={`Play ${game.name}`}
    >
      <div className="game-card-head">
        <span className="game-card-icon" aria-hidden>
          {game.icon}
        </span>
        {chamber && (
          <span className="chapter-badge">
            Ch. {chamber.chapter} • {chamber.chamber}
          </span>
        )}
      </div>

      <h3 className="game-card-title">{game.name}</h3>
      <p className="game-card-desc">{game.description}</p>

      {thresholdText && <p className="game-card-threshold">{thresholdText}</p>}

      <div className="game-card-foot">
        <span className="game-card-status" data-status={healed ? 'healed' : 'active'}>
          {healed ? 'Cleared ✓' : 'Play →'}
        </span>
        <span className="game-card-reward">up to {game.maxPointsPerPlay} pts</span>
      </div>
    </button>
  )
}
