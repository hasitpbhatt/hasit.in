import { useEffect, useRef, useState } from 'react'
import { ScoreBanner } from './ScoreBanner'
import { GameHud } from '../../components/GameHud'
import { useScoreSubmit } from '../../lib/useScoreSubmit'
import { randomWord } from '../../lib/dictionary'

const ROUND_SECONDS = 90
const MAX_WRONG = 6

export default function Hangman() {
  const [word, setWord] = useState('')
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState(0)
  const [solved, setSolved] = useState(false)
  const [lost, setLost] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const scoreRef = useRef(0)
  const finishedRef = useRef(false)
  const { submit, submitting, feedback, resetTimer, undo, undoing } = useScoreSubmit('hangman')

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setRunning(false)
    setFinished(true)
    submit(scoreRef.current)
  }

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (!running || finished) return
    if (timeLeft <= 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timeLeft])

  const nextWord = () => {
    const w = randomWord(4, 7)
    setWord(w)
    setGuessed(new Set())
    setWrong(0)
    setSolved(false)
    setLost(false)
    setMessage(null)
  }

  const start = () => {
    finishedRef.current = false
    scoreRef.current = 0
    resetTimer()
    setScore(0)
    setTimeLeft(ROUND_SECONDS)
    setFinished(false)
    setRunning(true)
    nextWord()
  }

  const reveal = (ch: string) => {
    if (!running || finished || solved || lost) return
    const c = ch.toLowerCase()
    if (guessed.has(c)) return
    const nextGuessed = new Set(guessed)
    nextGuessed.add(c)
    setGuessed(nextGuessed)
    if (!word.includes(c)) {
      const nw = wrong + 1
      setWrong(nw)
      if (nw >= MAX_WRONG) {
        setLost(true)
        setMessage({ kind: 'err', text: `The word was "${word.toUpperCase()}".` })
        window.setTimeout(() => {
          if (finishedRef.current) return
          nextWord()
        }, 1800)
        return
      }
    } else {
      const allFound = [...word].every((l) => nextGuessed.has(l))
      if (allFound) {
        const bonus = MAX_WRONG - wrong
        scoreRef.current += 1 + Math.max(0, bonus)
        setScore(scoreRef.current)
        setSolved(true)
        setMessage({ kind: 'ok', text: `Solved! +${1 + Math.max(0, bonus)} pts` })
        window.setTimeout(() => {
          if (finishedRef.current) return
          nextWord()
        }, 1200)
      }
    }
  }

  const skip = () => {
    if (!running || finished || solved || lost) return
    nextWord()
  }

  const display = word ? [...word].map((l) => (guessed.has(l) ? l.toUpperCase() : '_')).join(' ') : ''

  return (
    <div className="game-stage">
      <GameHud
        stats={[
          { label: 'Solved', value: score },
          { label: 'Wrong', value: `${wrong}/${MAX_WRONG}` },
        ]}
        timer={{ value: timeLeft, max: ROUND_SECONDS }}
        action={
          !running && !finished ? (
            <button className="btn btn-primary" onClick={start}>
              Start
            </button>
          ) : (
            running && (
              <button className="btn btn-ghost" onClick={skip}>
                Skip word
              </button>
            )
          )
        }
      />

      <div className="hangman-view">
        <div className="hangman-figure" aria-hidden={true}>
          <svg viewBox="0 0 100 130" className="hangman-svg">
            <line x1="10" y1="125" x2="50" y2="125" />
            <line x1="30" y1="125" x2="30" y2="5" />
            <line x1="30" y1="5" x2="70" y2="5" />
            <line x1="70" y1="5" x2="70" y2="15" />
            {wrong >= 1 && <circle cx="70" cy="22" r="7" />}
            {wrong >= 2 && <line x1="70" y1="29" x2="70" y2="60" />}
            {wrong >= 3 && <line x1="70" y1="35" x2="55" y2="50" />}
            {wrong >= 4 && <line x1="70" y1="35" x2="85" y2="50" />}
            {wrong >= 5 && <line x1="70" y1="60" x2="58" y2="80" />}
            {wrong >= 6 && <line x1="70" y1="60" x2="82" y2="80" />}
          </svg>
        </div>

        <div className="hangman-word" aria-label={`Word: ${display}`}>
          {word ? (
            [...word].map((l, i) => (
              <span key={i} className="hangman-letter">
                {guessed.has(l) ? l.toUpperCase() : '_'}
              </span>
            ))
          ) : (
            <span className="hangman-letter">_</span>
          )}
        </div>

        <div className="hangman-keyboard" role="group" aria-label="Alphabet keyboard">
          {'abcdefghijklmnopqrstuvwxyz'.split('').map((ch) => {
            const used = guessed.has(ch)
            const inWord = word.includes(ch)
            return (
              <button
                key={ch}
                type="button"
                className={`hangman-key${used ? (inWord ? ' hit' : ' miss') : ''}`}
                disabled={used || !running || solved || lost || finished}
                onClick={() => reveal(ch)}
                aria-label={`Letter ${ch}`}
              >
                {ch.toUpperCase()}
              </button>
            )
          })}
        </div>

        {message && (
          <p className={`promo-msg ${message.kind}`} role="status">
            {message.text}
          </p>
        )}
      </div>

      {finished && (
        <p className="status" role="status">
          Time! {score} words solved
        </p>
      )}
      {submitting && <p className="status">Submitting…</p>}
      <ScoreBanner feedback={feedback} onUndo={undo} undoing={undoing} />
    </div>
  )
}
