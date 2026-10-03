import rawListeningData from './data/exact-listening-audio.json'
import type { CourseDefinition, ListeningDataset, ListeningQuestion, ListeningScenario, ListeningTag } from './types'

export const COURSES = {
  collocation: { id: 'collocation', name: 'Collocation', questionsPerSet: 10 },
  'exact-listening': { id: 'exact-listening', name: 'Exact Listening', questionsPerSet: 7 },
} satisfies Record<string, CourseDefinition>

const validTags = new Set<ListeningTag>(['article', 'preposition', 'plural-s', 'past-tense', 'auxiliary', 'other'])

const mapFeature = (feature: string): ListeningTag => {
  if (feature === 'article' || feature === 'preposition' || feature === 'plural-s' || feature === 'past-tense') return feature
  if (feature === 'auxiliary' || feature === 'modal') return 'auxiliary'
  return 'other'
}

const resolveAudioSrc = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const relativePath = value.trim().replace(/^\/+/, '')
  return `${import.meta.env.BASE_URL}${relativePath}`
}

function adaptGeneratedDataset(value: unknown): ListeningDataset | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { sets?: unknown }).sets)) return null
  const source = value as { sets: Array<{ id?: unknown; topic?: unknown; context?: unknown; sentences?: unknown }> }
  return {
    schemaVersion: 1,
    scenarios: source.sets.map((set) => {
      if (typeof set.id !== 'string' || typeof set.topic !== 'string' || !Array.isArray(set.sentences)) throw new Error('Invalid generated listening set.')
      return {
        id: set.id,
        title: set.topic,
        context: typeof set.context === 'string' ? set.context : undefined,
        questions: set.sentences.map((sentence) => {
          const item = sentence as { index?: unknown; text?: unknown; semanticChunks?: unknown; features?: unknown; audio?: unknown; audioSrc?: unknown }
          if (typeof item.index !== 'number' || typeof item.text !== 'string' || ![1, 2, 3].includes(Number(item.semanticChunks))) throw new Error(`Invalid sentence in ${set.id}.`)
          return {
            id: `${set.id}-${String(item.index).padStart(2, '0')}`,
            order: item.index,
            chunkCount: item.semanticChunks as 1 | 2 | 3,
            text: item.text,
            audioSrc: resolveAudioSrc(item.audioSrc ?? item.audio),
            focusTags: Array.isArray(item.features) ? [...new Set(item.features.filter((feature): feature is string => typeof feature === 'string').map(mapFeature))] : [],
          }
        }),
      }
    }),
  }
}

export function loadListeningDataset(value: unknown): ListeningDataset {
  const adapted = adaptGeneratedDataset(value)
  if (adapted) value = adapted
  if (!value || typeof value !== 'object') throw new Error('Listening data must be an object.')
  const candidate = value as Partial<ListeningDataset>
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.scenarios) || !candidate.scenarios.length) {
    throw new Error('Unsupported Exact Listening dataset.')
  }
  const ids = new Set<string>()
  const scenarios: ListeningScenario[] = candidate.scenarios.map((rawScenario) => {
    if (!rawScenario || typeof rawScenario.id !== 'string' || typeof rawScenario.title !== 'string' || !Array.isArray(rawScenario.questions)) {
      throw new Error('Invalid Exact Listening scenario.')
    }
    if (rawScenario.questions.length !== COURSES['exact-listening'].questionsPerSet) {
      throw new Error(`Scenario ${rawScenario.id} must contain exactly 7 questions.`)
    }
    const questions = rawScenario.questions.map((rawQuestion, index): ListeningQuestion => {
      const q = rawQuestion as ListeningQuestion
      if (!q || typeof q.id !== 'string' || typeof q.text !== 'string' || !q.text.trim() || q.order !== index + 1 || ![1, 2, 3].includes(q.chunkCount)) {
        throw new Error(`Invalid question in scenario ${rawScenario.id}.`)
      }
      if (ids.has(q.id)) throw new Error(`Duplicate listening question id: ${q.id}`)
      if (q.focusTags && (!Array.isArray(q.focusTags) || q.focusTags.some((tag) => !validTags.has(tag)))) throw new Error(`Invalid focusTags in ${q.id}.`)
      ids.add(q.id)
      return q
    })
    return { id: rawScenario.id, title: rawScenario.title, context: rawScenario.context, questions }
  })
  return { schemaVersion: 1, scenarios }
}

const completeListeningDataset = loadListeningDataset(rawListeningData)
const audioReadyScenarios = completeListeningDataset.scenarios.filter((scenario) =>
  scenario.questions.every((question) => Boolean(question.audioSrc)),
)

export const listeningDataset: ListeningDataset = {
  ...completeListeningDataset,
  scenarios: audioReadyScenarios.length > 0 ? audioReadyScenarios : completeListeningDataset.scenarios,
}
