import type { MasteryLevel, Question, QuestionProgress } from './types'

export const localDate = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const daysAgo = (date: string | null): number => {
  if (!date) return 999
  const then = new Date(date)
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000))
}

export const emptyProgress = (questionId: number): QuestionProgress => ({
  questionId,
  attempts: 0,
  correct: 0,
  incorrect: 0,
  currentCorrectStreak: 0,
  correctDates: [],
  lastAnsweredAt: null,
  lastCorrectAt: null,
  lastResult: null,
  masteryScore: 0,
  wrongChoices: {},
})

export function calculateMastery(progress: QuestionProgress): number {
  if (!progress.attempts) return 0
  const accuracy = progress.correct / progress.attempts
  const accuracyPoints = accuracy * 30
  const dayPoints = Math.min(progress.correctDates.length, 5) * 10
  const streakPoints = Math.min(progress.currentCorrectStreak, 3) * 5
  const freshnessPoints = progress.lastResult ? Math.max(0, 5 - daysAgo(progress.lastAnsweredAt)) : 0
  const mistakePenalty = Math.min(progress.incorrect * 2, 12)
  const lapsePenalty = Math.min(Math.max(daysAgo(progress.lastAnsweredAt) - 14, 0) * 0.5, 10)
  return Math.round(Math.max(0, Math.min(100, accuracyPoints + dayPoints + streakPoints + freshnessPoints - mistakePenalty - lapsePenalty)))
}

export function masteryLevel(score: number, attempts = 1): MasteryLevel {
  if (!attempts) return 'unlearned'
  if (score < 40) return 'review'
  if (score < 60) return 'learning'
  if (score < 80) return 'almost'
  return 'mastered'
}

export const displayChoice = (choice: string): string => choice === 'NONE' ? '前置詞なし' : choice

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const weakness = (q: Question, progress: Record<string, QuestionProgress>): number => {
  const p = progress[q.id]
  if (!p) return 45 + Math.random() * 10
  const accuracy = p.attempts ? p.correct / p.attempts : 0
  return (p.lastResult === false ? 55 : 0) + (100 - p.masteryScore) * 0.45 + (1 - accuracy) * 25 + Math.min(daysAgo(p.lastAnsweredAt), 20) + Math.random() * 12
}

export function selectQuestions(
  questions: Question[],
  progress: Record<string, QuestionProgress>,
  mode: 'normal' | 'weak' | 'all' | 'category',
  category?: string,
  setSize = 10,
): Question[] {
  const pool = category ? questions.filter((q) => q.category === category) : questions
  if (mode === 'all' || mode === 'category') return shuffle(pool).slice(0, setSize)

  const ranked = [...pool].sort((a, b) => weakness(b, progress) - weakness(a, progress))
  if (mode === 'weak') {
    const mistaken = ranked.filter((q) => (progress[q.id]?.incorrect ?? 0) > 0)
    const candidates = mistaken.length >= setSize ? mistaken : [...mistaken, ...ranked.filter((q) => !mistaken.includes(q))]
    return candidates.slice(0, setSize)
  }

  const weak = ranked.filter((q) => {
    const p = progress[q.id]
    return p && (p.lastResult === false || p.masteryScore < 40)
  })
  const learning = ranked.filter((q) => {
    const p = progress[q.id]
    return p && p.masteryScore >= 40 && p.masteryScore < 80
  })
  const variety = shuffle(ranked.filter((q) => !weak.includes(q) && !learning.includes(q)))
  const weakCount = Math.ceil(setSize * 0.5)
  const learningCount = Math.floor(setSize * 0.3)
  const picked = [...weak.slice(0, weakCount), ...learning.slice(0, learningCount), ...variety.slice(0, Math.max(0, setSize - weakCount - learningCount))]
  for (const question of ranked) {
    if (picked.length >= Math.min(setSize, pool.length)) break
    if (!picked.includes(question)) picked.push(question)
  }
  return shuffle(picked.slice(0, setSize))
}
