import { readFileSync, writeFileSync } from 'node:fs'
import { writingCompleteHeadwords } from './writing-complete-headwords.mjs'

const path = new URL('../src/data/vocabulary.json', import.meta.url)
const words = JSON.parse(readFileSync(path, 'utf8'))
const selected = new Set(writingCompleteHeadwords)
const selectedWords = words.filter((word) => selected.has(word.word))

const writingOverrides = {
  advocate: { meaning: '支持する；主張する' },
  contend: { meaning: '主張する' },
  discriminate: { meaning: '区別する；差別する' },
  elaborate: { meaning: '詳しく説明する' },
  implement: { meaning: '実施する；導入する' },
  estimate: { meaning: '推定する；見積もる' },
  conclude: { meaning: '結論づける' },
  conduct: { meaning: '実施する；行う' },
  demonstrate: { meaning: '示す；実証する' },
  appropriate: { meaning: '適切な', partOfSpeech: 'adjective' },
  arbitrary: { meaning: '恣意的な；任意の' },
  feasible: { meaning: '実現可能な' },
  simultaneous: { meaning: '同時の' },
  sophisticated: { meaning: '高度な；洗練された' },
  prevalent: { meaning: '広く見られる；普及している' },
  profound: { meaning: '重大な；深い' },
  empirical: { meaning: '実証的な' },
  valid: { meaning: '妥当な；有効な' },
  precise: { meaning: '厳密な；正確な' },
  correlation: { meaning: '相関関係' },
  deduction: { meaning: '推論；演繹' },
  deficiency: { meaning: '不足；欠如' },
  disruption: { meaning: '中断；混乱' },
  enhancement: { meaning: '改善；強化' },
  equity: { meaning: '公平性' },
  implication: { meaning: '含意；影響' },
  inquiry: { meaning: '探究；調査' },
  integrity: { meaning: '誠実性；完全性' },
  magnitude: {
    meaning: '規模；大きさ',
    example: 'The available data reveal the magnitude of the problem, suggesting that minor policy adjustments will not be sufficient.',
  },
  potential: {
    meaning: '可能性；潜在能力',
    example: 'The proposed policy has the potential to reduce inequality without placing an excessive burden on small businesses.',
  },
  revelation: { meaning: '新事実；発覚' },
  synthesis: {
    meaning: '統合；総合',
    example: 'A strong literature review offers a synthesis of previous findings rather than a simple list of individual studies.',
  },
  threshold: {
    meaning: '基準点；境界',
    example: 'Once household income falls below a certain threshold, access to higher education becomes substantially more difficult.',
  },
  factor: { meaning: '要因' },
  source: {
    meaning: '情報源；出典',
    example: 'Each source cited in the essay should directly support the claim it accompanies.',
  },
  impact: { meaning: '影響' },
  alternative: { meaning: '代替案；選択肢' },
}

if (writingCompleteHeadwords.length !== 150 || selected.size !== 150) throw new Error('Writing selection must contain 150 unique headwords')
if (selectedWords.length !== 150) {
  const available = new Set(words.map((word) => word.word))
  throw new Error(`Missing selected words: ${writingCompleteHeadwords.filter((word) => !available.has(word)).join(', ')}`)
}

for (const word of words) {
  const override = writingOverrides[word.word]
  if (override) Object.assign(word, override)
}

const stopwords = new Set(['a','an','the','of','to','in','on','at','by','for','from','with','and','or','that','this','its','is','are','was','were','be','been','being'])
const writingLevel = new Set(writingCompleteHeadwords.filter((_, index) => index % 3 === 0))

function makeComplete(word) {
  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(word.example)
  if (!match) throw new Error(`Example for ${word.word} does not contain its headword`)
  const original = match[0]
  const keep = Math.max(1, Math.min(original.length - 2, Math.round(original.length * 0.55)))
  return {
    enabled: true,
    sentence: word.example.slice(0, match.index) + original.slice(0, keep) + '_'.repeat(original.length - keep) + word.example.slice(match.index + original.length),
    answer: original.slice(keep),
  }
}

function makeCollocation(word) {
  const tokens = [...word.example.matchAll(/[A-Za-z'-]+/g)].map((match) => match[0])
  const index = tokens.findIndex((token) => token.toLowerCase() === word.word.toLowerCase())
  if (index < 0) return [`use ${word.word}`]
  const before = tokens[index - 1]
  const after = tokens[index + 1]
  if (before && !stopwords.has(before.toLowerCase())) return [`${before} ${tokens[index]}`]
  return after ? [`${tokens[index]} ${after}`] : [tokens[index]]
}

for (const word of words) {
  if (!selected.has(word.word)) {
    word.learningLevel = 'R'
    word.completeWords = { enabled: false, sentence: '', answer: '' }
    word.collocations = []
    continue
  }
  word.learningLevel = writingLevel.has(word.word) ? 'W' : 'S'
  word.completeWords = makeComplete(word)
  word.collocations = word.learningLevel === 'W' ? makeCollocation(word) : []
}

writeFileSync(path, JSON.stringify(words) + '\n')
console.log({ total: words.length, complete: selected.size, writing: writingLevel.size })
