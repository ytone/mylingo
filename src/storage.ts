import { calculateMastery, emptyProgress, localDate } from './lib'
import { LISTENING_POINTS_PER_QUESTION } from './listening'
import type { AppData, CourseId, DailyRecord, ListeningAnswerRecord, ListeningStats, QuestionProgress } from './types'

export const STORAGE_KEYS = {
  version: 'mylingo.version',
  progress: 'mylingo.progress',
  dailyHistory: 'mylingo.dailyHistory',
  listening: 'mylingo.listening',
} as const

const emptyListening = (): ListeningStats => ({
  answered: 0,
  exact: 0,
  minorSpellingError: 0,
  listeningError: 0,
  setsCompleted: 0,
  totalScore: 0,
  totalPossibleScore: 0,
  bestScenarioScore: 0,
  missedTags: { article: 0, preposition: 0, 'plural-s': 0, 'past-tense': 0, auxiliary: 0, other: 0 },
  recentAnswers: [],
  completedScenarioIds: [],
})

const emptyData = (): AppData => ({ version: 2, progress: {}, dailyHistory: {}, listening: emptyListening() })

export function loadData(): AppData {
  try {
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) ?? '{}')
    const dailyHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyHistory) ?? '{}')
    const storedListening = JSON.parse(localStorage.getItem(STORAGE_KEYS.listening) ?? 'null')
    if (typeof progress !== 'object' || Array.isArray(progress) || typeof dailyHistory !== 'object' || Array.isArray(dailyHistory)) return emptyData()
    const listening = storedListening && typeof storedListening === 'object' && !Array.isArray(storedListening)
      ? { ...emptyListening(), ...storedListening, missedTags: { ...emptyListening().missedTags, ...storedListening.missedTags } }
      : emptyListening()
    return { version: 2, progress, dailyHistory, listening }
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEYS.version, String(data.version))
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(data.progress))
  localStorage.setItem(STORAGE_KEYS.dailyHistory, JSON.stringify(data.dailyHistory))
  localStorage.setItem(STORAGE_KEYS.listening, JSON.stringify(data.listening))
}

export function recordAnswer(data: AppData, questionId: number, selected: string, answer: string): AppData {
  const correct = selected === answer
  const now = new Date().toISOString()
  const date = localDate()
  const existing = data.progress[questionId] ?? emptyProgress(questionId)
  const correctDates = correct && !existing.correctDates.includes(date)
    ? [...existing.correctDates, date]
    : existing.correctDates
  const updated: QuestionProgress = {
    ...existing,
    attempts: existing.attempts + 1,
    correct: existing.correct + (correct ? 1 : 0),
    incorrect: existing.incorrect + (correct ? 0 : 1),
    currentCorrectStreak: correct ? existing.currentCorrectStreak + 1 : 0,
    correctDates,
    lastAnsweredAt: now,
    lastCorrectAt: correct ? now : existing.lastCorrectAt,
    lastResult: correct,
    wrongChoices: correct ? existing.wrongChoices : {
      ...existing.wrongChoices,
      [selected]: (existing.wrongChoices[selected] ?? 0) + 1,
    },
  }
  updated.masteryScore = calculateMastery(updated)
  const next = { ...data, progress: { ...data.progress, [questionId]: updated } }
  saveData(next)
  return next
}

export function completeSet(data: AppData, score: number, total: number, courseId: CourseId = 'collocation'): AppData {
  const date = localDate()
  const existing: DailyRecord = data.dailyHistory[date] ?? {
    setsCompleted: 0,
    answered: 0,
    correct: 0,
    bestScore: 0,
    perfectSets: 0,
    achievedDailyPerfect: false,
  }
  const perfect = courseId === 'collocation' && score === total
  const updated: DailyRecord = {
    setsCompleted: existing.setsCompleted + 1,
    answered: existing.answered + total,
    correct: existing.correct + score,
    bestScore: Math.max(existing.bestScore, score),
    perfectSets: existing.perfectSets + (perfect ? 1 : 0),
    achievedDailyPerfect: existing.achievedDailyPerfect || perfect,
    byCourse: {
      ...existing.byCourse,
      [courseId]: {
        setsCompleted: (existing.byCourse?.[courseId]?.setsCompleted ?? 0) + 1,
        answered: (existing.byCourse?.[courseId]?.answered ?? 0) + total,
        exact: (existing.byCourse?.[courseId]?.exact ?? 0) + score,
        bestScore: Math.max(existing.byCourse?.[courseId]?.bestScore ?? 0, score),
      },
    },
  }
  const next = { ...data, dailyHistory: { ...data.dailyHistory, [date]: updated } }
  saveData(next)
  return next
}

export function recordListeningAnswer(data: AppData, answer: ListeningAnswerRecord): AppData {
  const missedTags = { ...data.listening.missedTags }
  for (const tag of answer.missedTags) missedTags[tag] += 1
  const listening: ListeningStats = {
    ...data.listening,
    answered: data.listening.answered + 1,
    exact: data.listening.exact + Number(answer.assessment === 'exact'),
    minorSpellingError: data.listening.minorSpellingError + Number(answer.assessment === 'minor_spelling_error'),
    listeningError: data.listening.listeningError + Number(answer.assessment === 'listening_error'),
    totalScore: data.listening.totalScore + answer.score,
    totalPossibleScore: data.listening.totalPossibleScore + LISTENING_POINTS_PER_QUESTION,
    missedTags,
    recentAnswers: [...data.listening.recentAnswers, answer].slice(-100),
  }
  const next = { ...data, listening }
  saveData(next)
  return next
}

export function completeListeningScenario(data: AppData, scenarioId: string, exactCount: number, total: number, score: number): AppData {
  const withSet = completeSet(data, exactCount, total, 'exact-listening')
  const listening = {
    ...withSet.listening,
    setsCompleted: withSet.listening.setsCompleted + 1,
    bestScenarioScore: Math.max(withSet.listening.bestScenarioScore, score),
    completedScenarioIds: [...new Set([...withSet.listening.completedScenarioIds, scenarioId])],
  }
  const next = { ...withSet, listening }
  saveData(next)
  return next
}

export function streak(history: AppData['dailyHistory'], kind: 'learning' | 'perfect'): { current: number; longest: number } {
  const active = (record?: DailyRecord) => kind === 'learning'
    ? Boolean(record && record.setsCompleted > 0)
    : Boolean(record?.achievedDailyPerfect)
  const dates = Object.keys(history).sort()
  let longest = 0
  let run = 0
  let previous: Date | null = null
  for (const key of dates) {
    if (!active(history[key])) continue
    const date = new Date(`${key}T12:00:00`)
    if (previous && (date.getTime() - previous.getTime()) / 86_400_000 === 1) run += 1
    else run = 1
    longest = Math.max(longest, run)
    previous = date
  }
  let current = 0
  const cursor = new Date()
  if (!active(history[localDate(cursor)])) cursor.setDate(cursor.getDate() - 1)
  while (active(history[localDate(cursor)])) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { current, longest }
}

export function exportData(data: AppData): void {
  const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mylingo-backup-${localDate()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function validateImport(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new Error('JSONの形式が正しくありません。')
  const candidate = value as Partial<AppData>
  if (![1, 2].includes(Number(candidate.version)) || !candidate.progress || !candidate.dailyHistory || Array.isArray(candidate.progress) || Array.isArray(candidate.dailyHistory)) {
    throw new Error('対応していないバックアップ形式です。')
  }
  for (const [id, item] of Object.entries(candidate.progress)) {
    const p = item as QuestionProgress
    if (!p || Number(id) !== p.questionId || typeof p.attempts !== 'number' || typeof p.correct !== 'number' || typeof p.incorrect !== 'number' || !Array.isArray(p.correctDates) || typeof p.wrongChoices !== 'object') {
      throw new Error(`問題ID ${id} の履歴が正しくありません。`)
    }
  }
  for (const [date, item] of Object.entries(candidate.dailyHistory)) {
    const day = item as DailyRecord
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day.setsCompleted !== 'number' || typeof day.answered !== 'number' || typeof day.correct !== 'number' || typeof day.bestScore !== 'number' || typeof day.perfectSets !== 'number' || typeof day.achievedDailyPerfect !== 'boolean') {
      throw new Error(`${date} の日別履歴が正しくありません。`)
    }
  }
  const listening = candidate.listening && typeof candidate.listening === 'object'
    ? { ...emptyListening(), ...candidate.listening, missedTags: { ...emptyListening().missedTags, ...candidate.listening.missedTags } }
    : emptyListening()
  return { version: 2, progress: candidate.progress, dailyHistory: candidate.dailyHistory, listening } as AppData
}

export function resetData(): AppData {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
  return emptyData()
}
