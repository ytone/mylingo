import { calculateMastery, emptyProgress, localDate } from './lib'
import type { AppData, DailyRecord, QuestionProgress } from './types'

export const STORAGE_KEYS = {
  version: 'mylingo.version',
  progress: 'mylingo.progress',
  dailyHistory: 'mylingo.dailyHistory',
} as const

const emptyData = (): AppData => ({ version: 1, progress: {}, dailyHistory: {} })

export function loadData(): AppData {
  try {
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) ?? '{}')
    const dailyHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyHistory) ?? '{}')
    if (typeof progress !== 'object' || Array.isArray(progress) || typeof dailyHistory !== 'object' || Array.isArray(dailyHistory)) return emptyData()
    return { version: 1, progress, dailyHistory }
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEYS.version, String(data.version))
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(data.progress))
  localStorage.setItem(STORAGE_KEYS.dailyHistory, JSON.stringify(data.dailyHistory))
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

export function completeSet(data: AppData, score: number, total: number): AppData {
  const date = localDate()
  const existing: DailyRecord = data.dailyHistory[date] ?? {
    setsCompleted: 0,
    answered: 0,
    correct: 0,
    bestScore: 0,
    perfectSets: 0,
    achievedDailyPerfect: false,
  }
  const perfect = score === total && total === 10
  const updated: DailyRecord = {
    setsCompleted: existing.setsCompleted + 1,
    answered: existing.answered + total,
    correct: existing.correct + score,
    bestScore: Math.max(existing.bestScore, score),
    perfectSets: existing.perfectSets + (perfect ? 1 : 0),
    achievedDailyPerfect: existing.achievedDailyPerfect || perfect,
  }
  const next = { ...data, dailyHistory: { ...data.dailyHistory, [date]: updated } }
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
  if (candidate.version !== 1 || !candidate.progress || !candidate.dailyHistory || Array.isArray(candidate.progress) || Array.isArray(candidate.dailyHistory)) {
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
  return candidate as AppData
}

export function resetData(): AppData {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
  return emptyData()
}
