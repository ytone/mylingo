import type { ListeningAssessment, ListeningQuestion, ListeningTag } from './types'

const articles = new Set(['a', 'an', 'the'])
const prepositions = new Set(['about', 'above', 'after', 'at', 'before', 'behind', 'below', 'between', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'over', 'through', 'to', 'under', 'with', 'without'])
const auxiliaries = new Set(['am', 'are', 'be', 'been', 'being', 'can', 'could', 'did', 'do', 'does', 'had', 'has', 'have', 'is', 'may', 'might', 'must', 'shall', 'should', 'was', 'were', 'will', 'would'])

export const normalizeListeningText = (value: string): string => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/[^a-z0-9'\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const editDistance = (a: string, b: string): number => {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]))
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

const tagForWord = (word: string): ListeningTag => {
  if (articles.has(word)) return 'article'
  if (prepositions.has(word)) return 'preposition'
  if (auxiliaries.has(word)) return 'auxiliary'
  if (word.endsWith('ed')) return 'past-tense'
  if (word.endsWith('s') && !word.endsWith('ss')) return 'plural-s'
  return 'other'
}

export interface ListeningEvaluation {
  assessment: ListeningAssessment
  distance: number
  accuracy: number
  expectedWords: string[]
  answerWords: string[]
  missedTags: ListeningTag[]
}

export const LISTENING_POINTS_PER_QUESTION = 20

const wordSubstitutionCost = (actual: string, expected: string): number => {
  if (actual === expected) return 0
  const distance = editDistance(actual, expected)
  const spellingThreshold = Math.max(1, Math.floor(Math.max(actual.length, expected.length) * 0.25))
  return distance <= spellingThreshold ? 0.5 : 1
}

const wordErrorCost = (actual: string[], expected: string[]): number => {
  const table = Array.from({ length: actual.length + 1 }, () => Array<number>(expected.length + 1).fill(0))
  for (let i = 0; i <= actual.length; i += 1) table[i][0] = i
  for (let j = 0; j <= expected.length; j += 1) table[0][j] = j
  for (let i = 1; i <= actual.length; i += 1) {
    for (let j = 1; j <= expected.length; j += 1) {
      table[i][j] = Math.min(
        table[i - 1][j] + 1,
        table[i][j - 1] + 1,
        table[i - 1][j - 1] + wordSubstitutionCost(actual[i - 1], expected[j - 1]),
      )
    }
  }
  return table[actual.length][expected.length]
}

const listeningAccuracy = (actual: string[], expected: string[]): number => {
  const denominator = Math.max(actual.length, expected.length, 1)
  return Math.max(0, 1 - wordErrorCost(actual, expected) / denominator)
}

export const replayMultiplier = (playCount: number): number => {
  if (playCount <= 1) return 1
  if (playCount === 2) return 0.8
  if (playCount === 3) return 0.5
  return Math.max(0.1, 0.8 - playCount * 0.1)
}

export interface ListeningScore {
  points: number
  playCount: number
  replayMultiplier: number
}

export function calculateListeningScore(evaluation: ListeningEvaluation, playCount: number): ListeningScore {
  const normalizedPlayCount = Math.max(1, Math.floor(playCount))
  const multiplier = replayMultiplier(normalizedPlayCount)
  return {
    points: Math.round(LISTENING_POINTS_PER_QUESTION * evaluation.accuracy * multiplier * 10) / 10,
    playCount: normalizedPlayCount,
    replayMultiplier: multiplier,
  }
}

export function evaluateListeningAnswer(answer: string, question: ListeningQuestion): ListeningEvaluation {
  const expected = normalizeListeningText(question.text)
  const actual = normalizeListeningText(answer)
  const expectedWords = expected.split(' ').filter(Boolean)
  const answerWords = actual.split(' ').filter(Boolean)
  if (actual === expected) return { assessment: 'exact', distance: 0, accuracy: 1, expectedWords, answerWords, missedTags: [] }

  const distance = editDistance(actual, expected)
  const sameWordCount = expectedWords.length === answerWords.length
  const missingWords = wordDiff(actual, expected).filter((part) => part.kind === 'missing').map((part) => part.value)
  const missedTags = [...new Set(missingWords.map(tagForWord).filter((tag) => tag !== 'other' || question.focusTags?.includes('other')))]
  const structuralError = sameWordCount && expectedWords.some((word, index) => {
    const heard = answerWords[index]
    if (word === heard) return false
    if ((articles.has(word) && articles.has(heard)) || (prepositions.has(word) && prepositions.has(heard)) || (auxiliaries.has(word) && auxiliaries.has(heard))) return true
    if (word.endsWith('ed') && heard === word.slice(0, -2)) return true
    if (word.endsWith('s') && heard === word.slice(0, -1)) return true
    return false
  })
  const minor = sameWordCount && !structuralError && distance <= Math.max(1, Math.floor(expected.length * 0.08))
  return {
    assessment: minor ? 'minor_spelling_error' : 'listening_error',
    distance,
    accuracy: listeningAccuracy(answerWords, expectedWords),
    expectedWords,
    answerWords,
    missedTags,
  }
}

export interface DiffPart { value: string; kind: 'same' | 'missing' | 'extra' }

export function wordDiff(answer: string, expected: string): DiffPart[] {
  const a = normalizeListeningText(answer).split(' ').filter(Boolean)
  const b = normalizeListeningText(expected).split(' ').filter(Boolean)
  const table = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const parts: DiffPart[] = []
  let i = 0; let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { parts.push({ value: b[j], kind: 'same' }); i += 1; j += 1 }
    else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) { parts.push({ value: b[j], kind: 'missing' }); j += 1 }
    else { parts.push({ value: a[i], kind: 'extra' }); i += 1 }
  }
  return parts
}
