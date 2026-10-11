import rawVocabulary from './data/vocabulary.json'
import { localDate, shuffle } from './lib'

export type VocabularyCategoryId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'D1' | 'D2' | 'D3' | 'D4'
  | 'E1' | 'E2' | 'E3' | 'E4'
  | 'F1' | 'F2' | 'F3' | 'F4'
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10'
  | 'H1' | 'H2' | 'H3' | 'H4'

export type VocabularySkill = 'meaning' | 'spelling'
export type VocabularyLearningLevel = 'R' | 'S' | 'W'

export interface VocabularyWord {
  id: string
  word: string
  meaning: string
  definition: string
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'other'
  categories: VocabularyCategoryId[]
  priority: 1 | 2 | 3
  learningLevel: VocabularyLearningLevel
  example: string
  completeWords: { enabled: boolean; sentence: string; answer: string }
  collocations: string[]
  source: string
}

export interface VocabularySkillProgress {
  stage: 0 | 1 | 2 | 3 | 4
  correctCount: number
  incorrectCount: number
  lastReviewedAt: string | null
  lastAdvancedDate: string | null
  nextReviewAt: string | null
  mastered: boolean
  lastResult: boolean | null
  totalResponseMs: number
}

export interface VocabularyWordProgress {
  wordId: string
  meaning: VocabularySkillProgress
  spelling: VocabularySkillProgress
}

export interface VocabularyData {
  version: 1
  progress: Record<string, VocabularyWordProgress>
  enabledCategories: VocabularyCategoryId[]
}

export interface VocabularyQuestion {
  word: VocabularyWord
  skill: VocabularySkill
  choices?: string[]
}

export const VOCABULARY_STORAGE_KEY = 'mylingo.vocabulary.v1'

export const VOCABULARY_GROUPS: Array<{ id: string; label: string; categories: Array<{ id: VocabularyCategoryId; label: string }> }> = [
  { id: 'A', label: '生命科学', categories: [['A1','動物・生態系'],['A2','植物学'],['A3','人体・医学'],['A4','進化・遺伝'],['A5','海洋生物・海洋学'],['A6','農業・食料生産']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'B', label: '自然科学', categories: [['B1','地質・地形'],['B2','気象・気候'],['B3','天文学・宇宙'],['B4','物理学'],['B5','化学']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'C', label: '人間・社会科学', categories: [['C1','心理学'],['C2','教育学'],['C3','社会学・人口'],['C4','人類学・考古学']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'D', label: '歴史', categories: [['D1','古代文明'],['D2','中世・近代史'],['D3','技術・産業史'],['D4','文化・社会史']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'E', label: '芸術・文化', categories: [['E1','美術・絵画'],['E2','音楽'],['E3','建築'],['E4','文学・演劇']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'F', label: '経済・ビジネス', categories: [['F1','経済学'],['F2','経営・組織'],['F3','貿易・市場'],['F4','技術革新・産業']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'G', label: '学術共通語彙', categories: [['G1','増加・減少'],['G2','形成・変化'],['G3','原因・影響'],['G4','移動・拡散'],['G5','分解・結合・維持'],['G6','比較・分類'],['G7','研究・実験'],['G8','程度・性質'],['G9','存在・構成・関係'],['G10','論理・主張・推論']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
  { id: 'H', label: '技術・工学', categories: [['H1','コンピュータ・情報技術'],['H2','エネルギー・電力'],['H3','材料・製造技術'],['H4','発明・科学技術の発展']].map(([id,label]) => ({ id: id as VocabularyCategoryId, label })) },
]

export const VOCABULARY_CATEGORIES = VOCABULARY_GROUPS.flatMap((group) => group.categories)
export const vocabularyWords = rawVocabulary as VocabularyWord[]

const emptySkill = (): VocabularySkillProgress => ({
  stage: 0, correctCount: 0, incorrectCount: 0, lastReviewedAt: null,
  lastAdvancedDate: null, nextReviewAt: null, mastered: false,
  lastResult: null, totalResponseMs: 0,
})

export const emptyWordProgress = (wordId: string): VocabularyWordProgress => ({ wordId, meaning: emptySkill(), spelling: emptySkill() })

export function loadVocabularyData(): VocabularyData {
  const fallback: VocabularyData = { version: 1, progress: {}, enabledCategories: VOCABULARY_CATEGORIES.map((category) => category.id) }
  try {
    const parsed = JSON.parse(localStorage.getItem(VOCABULARY_STORAGE_KEY) ?? 'null') as Partial<VocabularyData> | null
    if (!parsed || parsed.version !== 1 || !parsed.progress || !Array.isArray(parsed.enabledCategories)) return fallback
    const validIds = new Set(VOCABULARY_CATEGORIES.map((category) => category.id))
    return { version: 1, progress: parsed.progress, enabledCategories: parsed.enabledCategories.filter((id): id is VocabularyCategoryId => validIds.has(id as VocabularyCategoryId)) }
  } catch { return fallback }
}

export function saveVocabularyData(data: VocabularyData): void {
  localStorage.setItem(VOCABULARY_STORAGE_KEY, JSON.stringify(data))
}

const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()

export function recordVocabularyAnswer(data: VocabularyData, wordId: string, skill: VocabularySkill, correct: boolean, responseMs: number, now = new Date()): VocabularyData {
  const wordProgress = data.progress[wordId] ?? emptyWordProgress(wordId)
  const current = wordProgress[skill]
  const nowIso = now.toISOString()
  const today = localDate(now)
  let stage = current.stage
  let lastAdvancedDate = current.lastAdvancedDate
  if (correct && current.lastAdvancedDate !== today) {
    stage = Math.min(4, current.stage + 1) as VocabularySkillProgress['stage']
    lastAdvancedDate = today
  } else if (!correct && current.stage > 0) {
    stage = Math.max(1, current.stage - (current.stage >= 3 ? 1 : 0)) as VocabularySkillProgress['stage']
  }
  const intervals = [0, 1, 3, 7, 0]
  const mastered = stage === 4
  const updatedSkill: VocabularySkillProgress = {
    ...current, stage, mastered, lastAdvancedDate,
    correctCount: current.correctCount + Number(correct),
    incorrectCount: current.incorrectCount + Number(!correct),
    lastReviewedAt: nowIso, lastResult: correct,
    nextReviewAt: mastered ? null : correct ? addDays(nowIso, intervals[stage]) : nowIso,
    totalResponseMs: current.totalResponseMs + Math.max(0, responseMs),
  }
  const next = { ...data, progress: { ...data.progress, [wordId]: { ...wordProgress, [skill]: updatedSkill } } }
  saveVocabularyData(next)
  return next
}

const isRequired = (word: VocabularyWord, skill: VocabularySkill) => skill === 'meaning' || word.completeWords.enabled
export const isWordMastered = (word: VocabularyWord, progress?: VocabularyWordProgress) =>
  Boolean(progress?.meaning.mastered && (!word.completeWords.enabled || progress.spelling.mastered))

const rankSkill = (progress: VocabularySkillProgress | undefined, now: number): number => {
  if (!progress || progress.stage === 0) return 1_000 + Math.random() * 100
  const due = progress.nextReviewAt ? new Date(progress.nextReviewAt).getTime() <= now : false
  if (due) return 4_000 + (progress.lastResult === false ? 1_000 : 0) + progress.incorrectCount * 10 + Math.random() * 100
  if (progress.lastResult === false) return 3_000 + progress.incorrectCount * 10 + Math.random() * 100
  return -1
}

export function createMeaningChoices(word: VocabularyWord, pool = vocabularyWords): string[] {
  const categoryMatches = pool.filter((candidate) => candidate.id !== word.id && candidate.categories.some((id) => word.categories.includes(id)))
  const candidates = [...shuffle(categoryMatches), ...shuffle(pool)]
  const choices = [word.meaning]
  for (const candidate of candidates) {
    if (choices.length === 10) break
    if (!choices.includes(candidate.meaning)) choices.push(candidate.meaning)
  }
  if (choices.length !== 10) throw new Error(`Cannot create ten unique choices for ${word.id}`)
  return shuffle(choices)
}

export function selectVocabularyQuestions(data: VocabularyData, setSize = 10, now = new Date()): VocabularyQuestion[] {
  const enabled = new Set(data.enabledCategories)
  const pool = vocabularyWords.filter((word) => word.categories.some((category) => enabled.has(category)))
  const candidates = pool.flatMap((word) => (['meaning','spelling'] as VocabularySkill[])
    .filter((skill) => isRequired(word, skill))
    .map((skill) => ({ word, skill, rank: rankSkill(data.progress[word.id]?.[skill], now.getTime()) })))
    .filter((item) => item.rank >= 0)
  const spelling = candidates.filter((item) => item.skill === 'spelling').sort((a,b) => b.rank-a.rank)
  const meaning = candidates.filter((item) => item.skill === 'meaning').sort((a,b) => b.rank-a.rank)
  const selected: typeof candidates = []
  const used = new Set<string>()
  const take = (items: typeof candidates, count: number) => {
    for (const item of items) {
      if (selected.length >= setSize || count <= 0) break
      if (used.has(item.word.id)) continue
      selected.push(item); used.add(item.word.id); count -= 1
    }
  }
  take(spelling, Math.min(2, setSize))
  take(meaning, setSize - selected.length)
  take([...meaning, ...spelling].sort((a,b) => b.rank-a.rank), setSize - selected.length)
  return shuffle(selected).map(({ word, skill }) => ({ word, skill, choices: skill === 'meaning' ? createMeaningChoices(word, pool) : undefined }))
}

export function vocabularyStats(data: VocabularyData, words = vocabularyWords, now = new Date()) {
  let mastered = 0, learning = 0, unlearned = 0, difficult = 0, due = 0
  for (const word of words) {
    const progress = data.progress[word.id]
    if (isWordMastered(word, progress)) mastered += 1
    else if (!progress || (progress.meaning.stage === 0 && progress.spelling.stage === 0)) unlearned += 1
    else learning += 1
    if (progress && progress.meaning.incorrectCount + progress.spelling.incorrectCount >= 2) difficult += 1
    for (const skill of ['meaning','spelling'] as VocabularySkill[]) {
      if (!isRequired(word, skill)) continue
      const item = progress?.[skill]
      if (item && !item.mastered && item.nextReviewAt && new Date(item.nextReviewAt) <= now) due += 1
    }
  }
  return { total: words.length, mastered, learning, unlearned, difficult, due, rate: words.length ? Math.round(mastered / words.length * 100) : 0 }
}
