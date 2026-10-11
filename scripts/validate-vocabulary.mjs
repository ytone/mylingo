import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { writingCompleteHeadwords } from './writing-complete-headwords.mjs'

const words = JSON.parse(readFileSync(new URL('../src/data/vocabulary.json', import.meta.url), 'utf8'))
const categoryIds = ['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','C1','C2','C3','C4','D1','D2','D3','D4','E1','E2','E3','E4','F1','F2','F3','F4','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10','H1','H2','H3','H4']
const categories = new Set(categoryIds)

assert.equal(words.length, 1500, 'Vocabulary must contain exactly 1,500 entries')
assert.equal(new Set(words.map((word) => word.id)).size, 1500, 'IDs must be unique')
assert.equal(new Set(words.map((word) => word.word.toLowerCase())).size, 1500, 'Headwords must be unique')
assert.equal(words.filter((word) => word.completeWords.enabled).length, 150, 'Exactly 150 writing-focused words must enable Complete the Words')
assert.equal(words.filter((word) => word.learningLevel === 'R').length, 1350, 'R-level count must match the non-spelling vocabulary')
assert.equal(words.filter((word) => word.learningLevel === 'S').length, 100, 'S-level count must match the curated writing selection')
assert.equal(words.filter((word) => word.learningLevel === 'W').length, 50, 'W-level count must match the curated writing selection')
assert.deepEqual(
  new Set(words.filter((word) => word.completeWords.enabled).map((word) => word.word)),
  new Set(writingCompleteHeadwords),
  'Complete the Words selection must match the TOEFL Writing shortlist',
)
assert.equal(new Set(writingCompleteHeadwords).size, 150, 'Writing shortlist must not contain duplicate headwords')
assert.equal(words.find((word) => word.word === 'appropriate')?.partOfSpeech, 'adjective', 'appropriate must use its writing-context part of speech')
assert.equal(words.find((word) => word.word === 'advocate')?.meaning, '支持する；主張する', 'advocate must use its verb meaning')
assert.equal(words.find((word) => word.word === 'elaborate')?.meaning, '詳しく説明する', 'elaborate must use its verb meaning')
assert.equal(words.find((word) => word.word === 'conduct')?.meaning, '実施する；行う', 'conduct must use its verb meaning')
assert(!words.some((word) => word.example.includes('The researchers used the term')), 'Generic researcher example remains in the dataset')
const excludedKatakanaCognates = [
  'accessible','aerosol','algorithm','aluminum','amino','bargain','barrel','bat','beam','bilingual',
  'bonus','boycott','bucket','calcium','calorific','campus','chess','click','clip','clone','comma',
  'commit','communicative','connector','consensus','cord','corpus','crick','curricula','curriculum',
  'cylinder','data','delta','dilemma','domain','elite','emulate','feedback','fiber','followthrough',
  'forum','gram','graph','hierarchy','hormone','ideology','innovation','insulin','ion','jazz',
  'kilometer','layout','leisure','lever','lifestyle','liter','mall','manual','marker','markup','matrix',
  'media','mentor','messenger','millimeter','minus','missile','motif','neo','network','neuron',
  'orientation','panel','paradox','privacy','replica','simulate','spectrum','technique','telepathic','unique',
]
const includedHeadwords = new Set(words.map((word) => word.word))
for (const headword of excludedKatakanaCognates) {
  assert(!includedHeadwords.has(headword), `${headword} is an obvious katakana cognate and must stay excluded`)
}

for (const category of categoryIds) {
  assert(words.some((word) => word.categories.includes(category)), `${category} has no words`)
}

for (const word of words) {
  for (const key of ['id','word','meaning','definition','partOfSpeech','categories','priority','learningLevel','example','completeWords','collocations']) {
    assert.notEqual(word[key], undefined, `${word.id} is missing ${key}`)
  }
  assert(word.meaning.trim(), `${word.id} has no Japanese meaning`)
  assert(word.example.includes('.') || word.example.includes('?') || word.example.includes('!'), `${word.id} example is not a sentence`)
  assert(word.categories.length > 0 && word.categories.every((id) => categories.has(id)), `${word.id} has an invalid category`)
  if (word.completeWords.enabled) {
    const start = word.completeWords.sentence.indexOf('_')
    assert(start >= 0, `${word.id} has no blank`)
    const blankLength = word.completeWords.sentence.slice(start).match(/^_+/)?.[0].length ?? 0
    const restored = word.completeWords.sentence.slice(0, start) + word.completeWords.answer + word.completeWords.sentence.slice(start + blankLength)
    assert.equal(restored, word.example, `${word.id} Complete the Words does not restore its example`)
  }
  const sameCategory = words.filter((candidate) => candidate.id !== word.id && candidate.categories.some((id) => word.categories.includes(id)))
  const uniqueMeanings = new Set([word.meaning, ...sameCategory.map((candidate) => candidate.meaning), ...words.map((candidate) => candidate.meaning)])
  assert(uniqueMeanings.size >= 10, `${word.id} cannot produce ten unique choices`)
  if (word.learningLevel === 'W') assert(word.collocations.length > 0, `${word.id} W-level word has no collocation`)
}

const counts = Object.fromEntries(categoryIds.map((id) => [id, words.filter((word) => word.categories.includes(id)).length]))
console.log(`Vocabulary validation passed: ${words.length} unique words across ${categoryIds.length} categories.`)
console.log(JSON.stringify(counts))
