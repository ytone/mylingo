export type Category =
  | 'adjective_preposition'
  | 'verb_preposition'
  | 'noun_preposition'
  | 'no_preposition'
  | 'contrast'
  | 'email'
  | 'speaking'

export interface Question {
  id: number
  category: Category
  collocation: string
  question: string
  answer: string
  distractors: string[]
  meaning: string
  example: string
}

export interface QuestionProgress {
  questionId: number
  attempts: number
  correct: number
  incorrect: number
  currentCorrectStreak: number
  correctDates: string[]
  lastAnsweredAt: string | null
  lastCorrectAt: string | null
  lastResult: boolean | null
  masteryScore: number
  wrongChoices: Record<string, number>
}

export interface DailyRecord {
  setsCompleted: number
  answered: number
  correct: number
  bestScore: number
  perfectSets: number
  achievedDailyPerfect: boolean
  byCourse?: Partial<Record<CourseId, CourseDailyRecord>>
}

export interface AppData {
  version: 2
  progress: Record<string, QuestionProgress>
  dailyHistory: Record<string, DailyRecord>
  listening: ListeningStats
}

export type CourseId = 'collocation' | 'exact-listening'

export interface CourseDefinition {
  id: CourseId
  name: string
  questionsPerSet: number
}

export interface CourseDailyRecord {
  setsCompleted: number
  answered: number
  exact: number
  bestScore: number
}

export type ListeningAssessment = 'exact' | 'minor_spelling_error' | 'listening_error'
export type ListeningTag = 'article' | 'preposition' | 'plural-s' | 'past-tense' | 'auxiliary' | 'other'

export interface ListeningQuestion {
  id: string
  order: number
  chunkCount: 1 | 2 | 3
  text: string
  audioSrc?: string
  focusTags?: ListeningTag[]
}

export interface ListeningScenario {
  id: string
  title: string
  context?: string
  questions: ListeningQuestion[]
}

export interface ListeningDataset {
  schemaVersion: 1
  scenarios: ListeningScenario[]
}

export interface ListeningAnswerRecord {
  questionId: string
  scenarioId: string
  answer: string
  expected: string
  assessment: ListeningAssessment
  missedTags: ListeningTag[]
  accuracy: number
  playCount: number
  score: number
  answeredAt: string
}

export interface ListeningStats {
  answered: number
  exact: number
  minorSpellingError: number
  listeningError: number
  setsCompleted: number
  totalScore: number
  totalPossibleScore: number
  bestScenarioScore: number
  missedTags: Record<ListeningTag, number>
  recentAnswers: ListeningAnswerRecord[]
  completedScenarioIds: string[]
}

export type QuizMode = 'normal' | 'weak' | 'all' | 'category' | 'review'
export type MasteryLevel = 'unlearned' | 'review' | 'learning' | 'almost' | 'mastered'

export const CATEGORY_LABELS: Record<Category, string> = {
  adjective_preposition: '形容詞＋前置詞',
  verb_preposition: '動詞＋前置詞',
  noun_preposition: '名詞＋前置詞',
  no_preposition: '前置詞なし',
  contrast: '動詞・名詞の対比',
  email: 'Email',
  speaking: 'Speaking',
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  unlearned: '未学習',
  review: '要復習',
  learning: '学習中',
  almost: 'ほぼ定着',
  mastered: '定着',
}
