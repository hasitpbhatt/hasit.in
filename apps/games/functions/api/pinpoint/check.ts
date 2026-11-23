import { readBody, error, json, type Env } from '../../_shared/http'
import { getUserByToken, readSessionCookie } from '../../_shared/db'
import { rateLimitOk } from '../../_shared/rateLimit'
import { categoryFromClues, llmGuessMatchesCategory } from '../../_shared/pinpoint'

interface CheckBody {
  guess: string
  clues: string[]
}

// Best-effort semantic category match for Pinpoint. The client sends the
// revealed words; the server resolves the target category from its own
// mirrored word list (never trusting the client's stated category), then asks
// a small Mistral model whether the guess names it. Falls back to the client's
// own exact-match logic if this endpoint errors, so the game stays playable.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB

  const user = await getUserByToken(db, readSessionCookie(context.request))
  if (!user) {
    return error('Not authenticated', 401)
  }
  if (!(await rateLimitOk(db, 'pinpoint', String(user.id)))) {
    return error('Too many requests — slow down', 429)
  }

  // Use system FreeLLM API key for Games pinpoint (internal service account)
  if (!context.env.FREELLM_SYSTEM_API_KEY && !context.env.FREELLM_API_KEY && !context.env.MISTRAL_API_KEY) {
    return error('Pinpoint check unavailable', 503)
  }
  const body = await readBody<CheckBody>(context.request)
  const guess = String(body.guess ?? '').trim()
  const clues = Array.isArray(body.clues) ? body.clues.map(String) : []
  if (!guess || clues.length === 0 || clues.length > 8) {
    return error('Bad request', 400)
  }

  const category = categoryFromClues(clues)
  if (!category) {
    return json({ correct: false, reason: 'unresolved' })
  }

  try {
    const correct = await llmGuessMatchesCategory(guess, clues, category, {
      apiKey: context.env.FREELLM_SYSTEM_API_KEY || context.env.FREELLM_API_KEY || context.env.MISTRAL_API_KEY!,
      model: (context.env.FREELLM_MODEL || context.env.MISTRAL_MODEL) ?? 'gemini-2.5-flash',
    })
    return json({ correct })
  } catch {
    return error('Check unavailable right now', 503)
  }
}
