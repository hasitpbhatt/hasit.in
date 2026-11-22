import { useEffect, useRef, useState } from 'react'
import { ScoreBanner } from './ScoreBanner'
import { GameHud } from '../../components/GameHud'
import { useScoreSubmit } from '../../lib/useScoreSubmit'
import { ALL_WORDS } from '../../lib/dictionary'

const ROUND_SECONDS = 90
const GRID_SIZE = 8
const WORD_COUNT = 6
const MIN_WORD_LEN = 4
const MAX_WORD_LEN = 6

type Cell = { r: number; c: number }

interface Puzzle {
  grid: string[][]
  words: { word: string; cells: Cell[] }[]
}

const DIRS: { dr: number; dc: number }[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },
  { dr: -1, dc: 0 },
]

function placeWord(grid: string[][], word: string): { cells: Cell[] } | null {
  const size = grid.length
  for (let tries = 0; tries < 100; tries++) {
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)]
    const r = Math.floor(Math.random() * size)
    const c = Math.floor(Math.random() * size)
    const cells: Cell[] = []
    let ok = true
    for (let i = 0; i < word.length; i++) {
      const nr = r + dir.dr * i
      const nc = c + dir.dc * i
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
        ok = false
        break
      }
      if (grid[nr][nc] !== '' && grid[nr][nc] !== word[i]) {
        ok = false
        break
      }
      cells.push({ r: nr, c: nc })
    }
    if (ok) {
      for (let i = 0; i < word.length; i++) {
        grid[cells[i].r][cells[i].c] = word[i]
      }
      return { cells }
    }
  }
  return null
}

function fillGrid(grid: string[][]) {
  const size = grid.length
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = letters[Math.floor(Math.random() * 26)]
      }
    }
  }
}

function makePuzzle(): Puzzle {
  const pool = ALL_WORDS.filter((w) => w.length >= MIN_WORD_LEN && w.length <= MAX_WORD_LEN && w.length <= GRID_SIZE)
  for (let attempts = 0; attempts < 10; attempts++) {
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''))
    const placed: { word: string; cells: Cell[] }[] = []
    const used = new Set<string>()
    for (let i = 0; i < WORD_COUNT; i++) {
      for (let t = 0; t < 50; t++) {
        const word = pool[Math.floor(Math.random() * pool.length)]
        if (used.has(word)) continue
        const res = placeWord(grid, word)
        if (res) {
          placed.push({ word, cells: res.cells })
          used.add(word)
          break
        }
      }
    }
    if (placed.length >= WORD_COUNT) {
      fillGrid(grid)
      return { grid, words: placed }
    }
  }
  const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('a'))
  fillGrid(grid)
  return { grid, words: [] }
}

function lineCells(a: Cell, b: Cell): Cell[] {
  const dr = b.r - a.r
  const dc = b.c - a.c
  const len = Math.max(Math.abs(dr), Math.abs(dc))
  if (len === 0) return [a]
  const sr = dr === 0 ? 0 : dr / Math.abs(dr)
  const sc = dc === 0 ? 0 : dc / Math.abs(dc)
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [a]
  const cells: Cell[] = []
  for (let i = 0; i <= len; i++) cells.push({ r: a.r + sr * i, c: a.c + sc * i })
  return cells
}

export default function WordSearch() {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle())
  const [foundCells, setFoundCells] = useState<Cell[]>([])
  const [selecting, setSelecting] = useState(false)
  const [startCell, setStartCell] = useState<Cell | null>(null)
  const [endCell, setEndCell] = useState<Cell | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const scoreRef = useRef(0)
  const finishedRef = useRef(false)
  const foundRef = useRef(new Set<string>())
  const { submit, submitting, feedback, resetTimer, undo, undoing } = useScoreSubmit('wordsearch')

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
  }, [running, timeLeft])

  const start = () => {
    finishedRef.current = false
    scoreRef.current = 0
    foundRef.current = new Set()
    resetTimer()
    setPuzzle(makePuzzle())
    setFoundCells([])
    setScore(0)
    setTimeLeft(ROUND_SECONDS)
    setFinished(false)
    setMessage(null)
    setSelecting(false)
    setStartCell(null)
    setEndCell(null)
    setRunning(true)
  }

  const selectedCells = startCell && endCell ? lineCells(startCell, endCell) : []

  const handleStart = (r: number, c: number) => {
    if (!running || finished) return
    setSelecting(true)
    setStartCell({ r, c })
    setEndCell({ r, c })
  }

  const handleMove = (r: number, c: number) => {
    if (!selecting || !running || finished) return
    setEndCell({ r, c })
  }

  const isFoundCell = (r: number, c: number): boolean => {
    return foundCells.some((cell) => cell.r === r && cell.c === c)
  }

  const isSelectedCell = (r: number, c: number): boolean => {
    if (!selecting) return false
    return selectedCells.some((cell) => cell.r === r && cell.c === c)
  }

  const handleEnd = () => {
    if (!selecting) return
    setSelecting(false)
    if (!startCell || !endCell) {
      setStartCell(null)
      setEndCell(null)
      return
    }
    const cells = lineCells(startCell, endCell)
    setStartCell(null)
    setEndCell(null)
    if (cells.length < MIN_WORD_LEN) return
    const word = cells.map((cell) => puzzle.grid[cell.r][cell.c]).join('')
    const reversed = [...word].reverse().join('')
    const target = puzzle.words.find((w) => w.word === word || w.word === reversed)
    if (target && !foundRef.current.has(target.word)) {
      foundRef.current.add(target.word)
      scoreRef.current += 1
      setScore(scoreRef.current)
      setFoundCells((prev) => [...prev, ...target.cells])
      setMessage({ kind: 'ok', text: `Found "${target.word.toUpperCase()}"! +1` })
      if (foundRef.current.size >= puzzle.words.length) {
        window.setTimeout(() => {
          if (finishedRef.current) return
          const next = makePuzzle()
          setPuzzle(next)
          setFoundCells([])
          foundRef.current = new Set()
          setMessage({ kind: 'ok', text: 'Grid complete! Keep going.' })
        }, 1000)
      }
    } else if (target && foundRef.current.has(target.word)) {
      setMessage({ kind: 'err', text: 'Already found.' })
    } else {
      setMessage({ kind: 'err', text: 'Not a word.' })
    }
  }

  return (
    <div className="game-stage">
      <GameHud
        stats={[
          { label: 'Found', value: score },
          { label: 'Words', value: puzzle.words.length },
        ]}
        timer={{ value: timeLeft, max: ROUND_SECONDS }}
        action={
          !running && !finished ? (
            <button className="btn btn-primary" onClick={start}>
              Start
            </button>
          ) : (
            finished && (
              <button className="btn btn-ghost" onClick={start}>
                Play again
              </button>
            )
          )
        }
      />

      <div className="wordsearch-view">
        <div className="wordsearch-words">
          {puzzle.words.map((w, i) => (
            <span
              key={`${w.word}-${i}`}
              className={`wordsearch-word-chip${foundRef.current.has(w.word) ? ' found' : ''}`}
            >
              {w.word.toUpperCase()}
            </span>
          ))}
        </div>

        <div
          className="wordsearch-grid"
          onMouseLeave={handleEnd}
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
        >
          {puzzle.grid.map((row, r) =>
            row.map((ch, c) => {
              let cls = 'wordsearch-cell'
              if (isFoundCell(r, c)) cls += ' found'
              if (isSelectedCell(r, c)) cls += ' selected'
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={cls}
                  onMouseDown={() => handleStart(r, c)}
                  onMouseEnter={() => handleMove(r, c)}
                  onMouseUp={handleEnd}
                  onTouchStart={() => handleStart(r, c)}
                  onTouchMove={(e) => {
                    const t = e.touches[0]
                    const el = document.elementFromPoint(t.clientX, t.clientY)
                    if (el) {
                      const dataR = el.getAttribute('data-r')
                      const dataC = el.getAttribute('data-c')
                      if (dataR != null && dataC != null) handleMove(Number(dataR), Number(dataC))
                    }
                  }}
                  onTouchEnd={handleEnd}
                  data-r={r}
                  data-c={c}
                  disabled={!running || finished}
                >
                  {ch.toUpperCase()}
                </button>
              )
            }),
          )}
        </div>

        {message && (
          <p className={`promo-msg ${message.kind}`} role="status">
            {message.text}
          </p>
        )}
      </div>

      {finished && (
        <p className="status" role="status">
          Time! {score} words found
        </p>
      )}
      {submitting && <p className="status">Submitting…</p>}
      <ScoreBanner feedback={feedback} onUndo={undo} undoing={undoing} />
    </div>
  )
}
