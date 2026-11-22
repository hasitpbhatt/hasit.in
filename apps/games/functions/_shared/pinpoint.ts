// Pinpoint game logic that needs to be server-grounded: the category word list
// is mirrored from src/features/games/Pinpoint.tsx (the client mirror) so the
// server can resolve the target category from revealed clues without trusting
// the client. This mirrors the existing points.ts <-> economy.ts convention.
// Keep these two in sync if the category set changes.

export interface Category {
  name: string
  clues: string[]
}

export const CATEGORIES: Category[] = [
  { name: 'Countries', clues: ['France', 'Brazil', 'Japan', 'Kenya', 'Canada', 'Australia', 'Chile', 'Mongolia'] },
  { name: 'Fruits', clues: ['Apple', 'Banana', 'Cherry', 'Mango', 'Papaya', 'Kiwi', 'Guava', 'Lychee'] },
  { name: 'Animals', clues: ['Dog', 'Cat', 'Elephant', 'Tiger', 'Dolphin', 'Penguin', 'Giraffe', 'Platypus'] },
  { name: 'Planets', clues: ['Venus', 'Mars', 'Jupiter', 'Neptune', 'Saturn', 'Uranus', 'Mercury', 'Earth'] },
  { name: 'Colors', clues: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Teal', 'Magenta'] },
  { name: 'Sports', clues: ['Soccer', 'Tennis', 'Swimming', 'Basketball', 'Cricket', 'Golf', 'Hockey', 'Badminton'] },
  { name: 'Music Genres', clues: ['Jazz', 'Rock', 'Hip-hop', 'Classical', 'Reggae', 'Country', 'Metal', 'Folk'] },
  { name: 'Board Games', clues: ['Chess', 'Monopoly', 'Scrabble', 'Clue', 'Risk', 'Catan', 'Checkers', 'Go'] },
  { name: 'Jobs', clues: ['Doctor', 'Teacher', 'Chef', 'Engineer', 'Pilot', 'Nurse', 'Barber', 'Plumber'] },
  { name: 'Vehicles', clues: ['Car', 'Boat', 'Train', 'Bicycle', 'Helicopter', 'Truck', 'Submarine', 'Tractor'] },
  { name: 'Programming Languages', clues: ['Python', 'Java', 'C++', 'JavaScript', 'Ruby', 'Go', 'Rust', 'Haskell'] },
  { name: 'Food', clues: ['Pizza', 'Taco', 'Sushi', 'Burger', 'Pasta', 'Salad', 'Ramen', 'Paella'] },
  { name: 'Weather', clues: ['Rain', 'Snow', 'Sunny', 'Fog', 'Thunder', 'Hurricane', 'Tornado', 'Drought'] },
  { name: 'Bodies of Water', clues: ['River', 'Lake', 'Ocean', 'Pond', 'Glacier', 'Delta', 'Fjord', 'Estuary'] },
  { name: 'Superheroes', clues: ['Batman', 'Spider-Man', 'Wonder Woman', 'Hulk', 'Flash', 'Aquaman', 'Black Panther', 'Thor'] },
  { name: 'Dances', clues: ['Salsa', 'Ballet', 'Breakdance', 'Tango', 'Waltz', 'Samba', 'Hip-hop', 'Flamenco'] },
  { name: 'Trees', clues: ['Oak', 'Pine', 'Maple', 'Birch', 'Willow', 'Cedar', 'Redwood', 'Baobab'] },
  { name: 'Birds', clues: ['Eagle', 'Owl', 'Robin', 'Parrot', 'Flamingo', 'Peacock', 'Albatross', 'Kiwi'] },
  { name: 'Instruments', clues: ['Piano', 'Guitar', 'Violin', 'Drums', 'Saxophone', 'Flute', 'Trumpet', 'Harp'] },
  { name: 'Capital Cities', clues: ['Paris', 'Tokyo', 'Nairobi', 'Ottawa', 'Lima', 'Oslo', 'Cairo', 'Seoul'] },
  { name: 'Elements', clues: ['Oxygen', 'Gold', 'Helium', 'Uranium', 'Iron', 'Carbon', 'Zinc', 'Mercury'] },
  { name: 'US States', clues: ['Texas', 'Alaska', 'Hawaii', 'Vermont', 'Nevada', 'Idaho', 'Ohio', 'Maine'] },
  { name: 'Rivers', clues: ['Nile', 'Amazon', 'Ganges', 'Danube', 'Volga', 'Thames', 'Rhine', 'Mississippi'] },
  { name: 'Dog Breeds', clues: ['Labrador', 'Beagle', 'Poodle', 'Husky', 'Corgi', 'Dachshund', 'Boxer', 'Collie'] },
  { name: 'Greek Gods', clues: ['Zeus', 'Athena', 'Apollo', 'Hermes', 'Artemis', 'Ares', 'Hades', 'Poseidon'] },
  { name: 'Zodiac Signs', clues: ['Aries', 'Taurus', 'Gemini', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Pisces'] },
  { name: 'Currencies', clues: ['Dollar', 'Euro', 'Yen', 'Pound', 'Rupee', 'Won', 'Real', 'Krone'] },
  { name: 'Painters', clues: ['Picasso', 'Monet', 'Van Gogh', 'Da Vinci', 'Rembrandt', 'Klimt', 'Dali', 'Renoir'] },
  { name: 'Planetary Moons', clues: ['Titan', 'Europa', 'Ganymede', 'Io', 'Triton', 'Phobos', 'Deimos', 'Miranda'] },
  { name: 'Flowers', clues: ['Rose', 'Tulip', 'Daisy', 'Lotus', 'Orchid', 'Lily', 'Sunflower', 'Daffodil'] },
  { name: 'Greek Letters', clues: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Sigma', 'Theta', 'Pi'] },
  { name: 'African Countries', clues: ['Kenya', 'Ghana', 'Zambia', 'Niger', 'Mali', 'Chad', 'Benin', 'Rwanda'] },
  { name: 'Spices', clues: ['Cinnamon', 'Turmeric', 'Paprika', 'Cumin', 'Nutmeg', 'Oregano', 'Clove', 'Coriander'] },
  { name: 'Mountains', clues: ['Everest', 'Kilimanjaro', 'Fuji', 'Denali', 'Elbrus', 'K2', 'Mont Blanc', 'Aconcagua'] },
]

export const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
export const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest'

export function categoryFromClues(clues: string[]): Category | null {
  const norm = clues.map((c) => c.toLowerCase().trim()).filter(Boolean)
  if (norm.length === 0) return null
  for (const c of CATEGORIES) {
    const pool = c.clues.map((k) => k.toLowerCase())
    if (norm.every((w) => pool.includes(w))) return c
  }
  return null
}

export interface LlmCheckOpts {
  apiKey: string
  model?: string
  signal?: AbortSignal
}

export async function llmGuessMatchesCategory(
  guess: string,
  clues: string[],
  category: Category,
  opts: LlmCheckOpts,
): Promise<boolean> {
  const prompt = [
    'You are a strict judge for a word-category guessing game.',
    `Revealed words: ${clues.join(', ')}.`,
    `The hidden category these words belong to is "${category.name}".`,
    `Does the player's guess "${guess}" correctly name that category (synonyms or close paraphrases also count)?`,
    'Answer with only "yes" or "no".',
  ].join(' ')

  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MISTRAL_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3,
      temperature: 0,
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mistral ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = (data.choices?.[0]?.message?.content ?? '').toLowerCase()
  return content.includes('yes')
}
