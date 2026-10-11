import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createMeaningChoices, emptyWordProgress, isWordMastered, loadVocabularyData,
  recordVocabularyAnswer, saveVocabularyData, selectVocabularyQuestions,
  vocabularyStats, vocabularyWords, VOCABULARY_CATEGORIES, VOCABULARY_GROUPS,
} from './vocabulary'
import type { VocabularyCategoryId, VocabularyData, VocabularyQuestion, VocabularySkill } from './vocabulary'

type VocabularyScreen = 'top' | 'categories' | 'quiz' | 'progress'
type StatusFilter = 'all' | 'unlearned' | 'learning' | 'mastered' | 'difficult'

const stageLabel = (stage: number) => stage === 4 ? '習得済み' : stage === 0 ? '未学習' : `学習中 ${stage}`

export default function VocabularyCourse({ onExit }: { onExit: () => void }) {
  const [data, setData] = useState<VocabularyData>(() => loadVocabularyData())
  const [screen, setScreen] = useState<VocabularyScreen>('top')
  const [questions, setQuestions] = useState<VocabularyQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<boolean[]>([])

  const navigate = (next: VocabularyScreen) => { setScreen(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const start = () => {
    const next = selectVocabularyQuestions(data)
    if (!next.length) return
    setQuestions(next); setIndex(0); setResults([]); navigate('quiz')
  }
  useEffect(() => {
    if (screen !== 'top' || !data.enabledCategories.length) return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select')) return
      event.preventDefault()
      start()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [data, screen])
  const completeAnswer = (correct: boolean, responseMs: number) => {
    const question = questions[index]
    setResults((previous) => [...previous, correct])
    setData((previous) => recordVocabularyAnswer(previous, question.word.id, question.skill, correct, responseMs))
  }
  const next = () => {
    if (index < questions.length - 1) setIndex((value) => value + 1)
    else navigate('top')
  }

  if (screen === 'quiz' && questions[index]) return <VocabularyQuiz question={questions[index]} current={index + 1} total={questions.length} onAnswer={completeAnswer} onNext={next} onExit={() => navigate('top')} />

  return <section className="vocabulary-page">
    <header className="vocabulary-header">
      <button className="back-button" onClick={onExit}>← mylingo ホーム</button>
      <div><span>VOCABULARY</span><strong>Academic Word Lab</strong></div>
      <nav><button className={screen === 'top' ? 'active' : ''} onClick={() => navigate('top')}>概要</button><button className={screen === 'categories' ? 'active' : ''} onClick={() => navigate('categories')}>カテゴリ</button><button className={screen === 'progress' ? 'active' : ''} onClick={() => navigate('progress')}>学習状況</button></nav>
    </header>
    {screen === 'top' && <VocabularyTop data={data} enabled={data.enabledCategories.length} latestResults={results} onStart={start} onCategories={() => navigate('categories')} onProgress={() => navigate('progress')} />}
    {screen === 'categories' && <VocabularyCategories data={data} setData={setData} onStart={start} />}
    {screen === 'progress' && <VocabularyProgress data={data} />}
  </section>
}

function VocabularyTop({ data, enabled, latestResults, onStart, onCategories, onProgress }: { data: VocabularyData; enabled: number; latestResults: boolean[]; onStart: () => void; onCategories: () => void; onProgress: () => void }) {
  const stats = vocabularyStats(data)
  return <>
    <div className="vocab-hero">
      <div><p className="eyebrow">TOEFL iBT · 1,500 WORDS</p><h1>覚えていない単語に、<br/>学習時間を集中する。</h1><p>意味とスペリングを別々に記録し、復習期限が来た項目を優先して出題します。Completeは10択で正解した単語から出題されます。</p></div>
      <div className="vocab-rate"><strong>{stats.rate}%</strong><span>全体の習得率</span></div>
    </div>
    {latestResults.length > 0 && <p className="vocab-set-result" role="status">直前のセット：{latestResults.filter(Boolean).length} / {latestResults.length} 正解</p>}
    <div className="vocab-stat-grid"><div><strong>{stats.total}</strong><span>総単語数</span></div><div><strong>{stats.mastered}</strong><span>習得済み</span></div><div><strong>{stats.learning}</strong><span>学習中</span></div><div><strong>{stats.unlearned}</strong><span>未学習</span></div><div className="due"><strong>{stats.due}</strong><span>本日の復習項目</span></div></div>
    <button className="vocab-start" disabled={!enabled} onClick={onStart}><span>10問の学習をスタート</span><b><kbd>Enter</kbd> →</b></button>
    {!enabled && <p className="vocab-warning">カテゴリを1つ以上ONにしてください。</p>}
    <div className="vocab-shortcuts"><button onClick={onCategories}><span>41 categories</span><strong>学習カテゴリを選ぶ</strong></button><button onClick={onProgress}><span>{stats.difficult} difficult words</span><strong>学習状況を確認する</strong></button></div>
  </>
}

function VocabularyCategories({ data, setData, onStart }: { data: VocabularyData; setData: (data: VocabularyData) => void; onStart: () => void }) {
  const enabled = new Set(data.enabledCategories)
  const toggle = (id: VocabularyCategoryId) => {
    const nextCategories = enabled.has(id) ? data.enabledCategories.filter((item) => item !== id) : [...data.enabledCategories, id]
    const next = { ...data, enabledCategories: nextCategories }
    saveVocabularyData(next); setData(next)
  }
  const setAll = (on: boolean) => {
    const next = { ...data, enabledCategories: on ? VOCABULARY_CATEGORIES.map((category) => category.id) : [] }
    saveVocabularyData(next); setData(next)
  }
  return <div className="vocab-content"><div className="vocab-title-row"><div><p className="eyebrow">CATEGORY SETTINGS</p><h1>学習カテゴリ</h1><p>複数選択できます。OFFにしても履歴は残ります。</p></div><div><button className="text-button" onClick={() => setAll(true)}>すべてON</button><button className="text-button" onClick={() => setAll(false)}>すべてOFF</button></div></div>
    {VOCABULARY_GROUPS.map((group) => <section className="vocab-category-group" key={group.id}><h2><span>{group.id}</span>{group.label}</h2><div>{group.categories.map((category) => {
      const words = vocabularyWords.filter((word) => word.categories.includes(category.id))
      const mastered = words.filter((word) => isWordMastered(word, data.progress[word.id])).length
      const rate = words.length ? Math.round(mastered / words.length * 100) : 0
      return <button key={category.id} className={enabled.has(category.id) ? 'enabled' : ''} aria-pressed={enabled.has(category.id)} onClick={() => toggle(category.id)}><span className="category-id">{category.id}</span><strong>{category.label}</strong><small>{mastered} / {words.length} 習得 · {rate}%</small><i>{enabled.has(category.id) ? 'ON' : 'OFF'}</i></button>
    })}</div></section>)}
    <button className="vocab-start sticky-start" disabled={!data.enabledCategories.length} onClick={onStart}>選択カテゴリで学習 <b>→</b></button>
  </div>
}

function VocabularyProgress({ data }: { data: VocabularyData }) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const words = useMemo(() => vocabularyWords.filter((word) => {
    const p = data.progress[word.id]
    const mastered = isWordMastered(word, p)
    const untouched = !p || (p.meaning.stage === 0 && p.spelling.stage === 0)
    const difficult = Boolean(p && p.meaning.incorrectCount + p.spelling.incorrectCount >= 2)
    const matches = filter === 'all' || (filter === 'mastered' && mastered) || (filter === 'unlearned' && untouched) || (filter === 'learning' && !mastered && !untouched) || (filter === 'difficult' && difficult)
    return matches && (!query || word.word.includes(query.toLowerCase()) || word.meaning.includes(query))
  }).slice(0, 200), [data.progress, filter, query])
  const stats = vocabularyStats(data)
  return <div className="vocab-content"><div className="vocab-title-row"><div><p className="eyebrow">LEARNING STATUS</p><h1>学習状況</h1><p>意味とスペリングは独立して習得判定されます。</p></div><strong className="progress-rate">{stats.rate}%</strong></div>
    <div className="vocab-progress-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="英単語・日本語で検索" />{(['all','unlearned','learning','mastered','difficult'] as StatusFilter[]).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{{all:'すべて',unlearned:'未学習',learning:'学習中',mastered:'習得済み',difficult:'苦手'}[item]}</button>)}</div>
    <div className="vocab-word-list">{words.map((word) => { const p = data.progress[word.id] ?? emptyWordProgress(word.id); return <article key={word.id}><div><strong>{word.word}</strong><span>{word.meaning}</span></div><div><small>意味</small><b className={`stage-${p.meaning.stage}`}>{stageLabel(p.meaning.stage)}</b></div><div><small>スペリング</small><b className={`stage-${p.spelling.stage}`}>{word.completeWords.enabled ? stageLabel(p.spelling.stage) : '対象外'}</b></div></article> })}</div>
    {words.length === 200 && <p className="vocab-list-note">表示負荷を抑えるため先頭200語を表示しています。検索で絞り込めます。</p>}
  </div>
}

function VocabularyQuiz({ question, current, total, onAnswer, onNext, onExit }: { question: VocabularyQuestion; current: number; total: number; onAnswer: (correct: boolean, responseMs: number) => void; onNext: () => void; onExit: () => void }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ correct: boolean; unknown: boolean } | null>(null)
  const startedAt = useRef(Date.now())
  const inputRef = useRef<HTMLInputElement | null>(null)
  const choices = useMemo(() => question.choices ?? createMeaningChoices(question.word), [question])
  const submit = (unknown = false, choice?: string) => {
    if (result) return
    const correct = !unknown && (question.skill === 'meaning' ? choice === question.word.meaning : answer.trim().toLowerCase() === question.word.completeWords.answer.toLowerCase())
    setResult({ correct, unknown }); onAnswer(correct, Date.now() - startedAt.current)
  }
  const advance = () => { setAnswer(''); setResult(null); startedAt.current = Date.now(); onNext() }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
      if (result && event.key === 'Enter') {
        event.preventDefault()
        advance()
        return
      }
      if (!result && event.key === '?') {
        event.preventDefault()
        submit(true)
        return
      }
      if (!result && question.skill === 'meaning' && /^[0-9]$/.test(event.key)) {
        const choiceIndex = event.key === '0' ? 9 : Number(event.key) - 1
        const choice = choices[choiceIndex]
        if (!choice) return
        event.preventDefault()
        submit(false, choice)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choices, question.skill, result])
  return <div className="quiz-wrap vocabulary-quiz-wrap"><header className="quiz-header"><button onClick={onExit} aria-label="Vocabularyを終了">×</button><div className="quiz-progress"><span style={{ width: `${current / total * 100}%` }} /></div><strong>{current}<span> / {total}</span></strong></header>
    <article className={`quiz-card vocabulary-quiz-card${result ? ' quiz-card--answered' : ''}`}>
      <p className="category-chip">VOCABULARY · {question.skill === 'meaning' ? 'MEANING' : 'COMPLETE THE WORD'}</p>
      {question.skill === 'meaning' ? <><h1 className="vocab-question-word">{question.word.word}</h1><p className="vocab-prompt">最も適切な意味を選んでください。<span className="shortcut-hint">1–9 / 0</span></p><div className="vocab-choice-grid">{choices.map((choice, choiceIndex) => <button key={choice} disabled={Boolean(result)} className={result ? choice === question.word.meaning ? 'correct' : 'muted' : ''} onClick={() => submit(false, choice)}><kbd>{choiceIndex === 9 ? 0 : choiceIndex + 1}</kbd><span>{choice}</span></button>)}</div></> : <><p className="vocab-prompt">欠けている文字を入力してください。<span className="shortcut-hint">Enterで回答</span></p><h1 className="complete-sentence">{question.word.completeWords.sentence}</h1><form onSubmit={(event) => { event.preventDefault(); if (answer.trim()) submit() }}><input ref={inputRef} autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={Boolean(result)} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={`${question.word.completeWords.answer.length}文字`} aria-label="欠けている文字" />{!result && <button className="next-button" disabled={!answer.trim()}>回答する</button>}</form></>}
      {!result && <button className="unknown-button" onClick={() => submit(true)}>知らない <kbd>?</kbd></button>}
      {result && <div className={`vocab-feedback ${result.correct ? 'success' : 'error'}`} aria-live="polite"><strong>{result.correct ? '正解です' : result.unknown ? '正解を確認しましょう' : 'もう一度覚えよう'}</strong><h2>{question.word.word} <span>{question.word.meaning}</span></h2><p>{question.word.definition}</p><blockquote>{question.word.example}</blockquote>{question.word.collocations.length > 0 && <div><small>COLLOCATION</small>{question.word.collocations.map((item) => <b key={item}>{item}</b>)}</div>}</div>}
      {result && <button className="next-button" onClick={advance}>{current === total ? '学習を完了' : '次の問題へ'} <span>↵</span></button>}
    </article>
  </div>
}
