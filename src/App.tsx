import { useEffect, useMemo, useRef, useState } from 'react'
import rawQuestions from './data/collocations.json'
import { displayChoice, emptyProgress, localDate, masteryLevel, selectQuestions, shuffle } from './lib'
import { completeSet, exportData, loadData, recordAnswer, resetData, saveData, streak, validateImport } from './storage'
import type { AppData, Category, MasteryLevel, Question, QuizMode } from './types'
import { CATEGORY_LABELS, MASTERY_LABELS } from './types'

const questions = rawQuestions as Question[]
type Screen = 'home' | 'quiz' | 'result' | 'questions' | 'detail' | 'settings'

interface AnswerResult { question: Question; selected: string; correct: boolean }

const formatPercent = (correct: number, total: number) => total ? `${Math.round(correct / total * 100)}%` : '—'
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat('ja-JP', { month: 'short', day: 'numeric' }).format(new Date(value)) : '未回答'

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [screen, setScreen] = useState<Screen>('home')
  const [quiz, setQuiz] = useState<Question[]>([])
  const [mode, setMode] = useState<QuizMode>('normal')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answers, setAnswers] = useState<AnswerResult[]>([])
  const [detailId, setDetailId] = useState<number | null>(null)

  const navigate = (next: Screen) => {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startQuiz = (nextMode: Exclude<QuizMode, 'review'>, category?: Category) => {
    const picked = selectQuestions(questions, data.progress, nextMode, category)
    setQuiz(picked)
    setMode(nextMode)
    setIndex(0)
    setSelected(null)
    setAnswers([])
    navigate('quiz')
  }

  const startReview = () => {
    const missed = answers.filter((answer) => !answer.correct).map((answer) => answer.question)
    if (!missed.length) return
    setQuiz(missed)
    setMode('review')
    setIndex(0)
    setSelected(null)
    setAnswers([])
    navigate('quiz')
  }

  const choose = (choice: string) => {
    if (selected || !quiz[index]) return
    const question = quiz[index]
    const correct = choice === question.answer
    setSelected(choice)
    setAnswers((previous) => [...previous, { question, selected: choice, correct }])
    setData((previous) => recordAnswer(previous, question.id, choice, question.answer))
  }

  const next = () => {
    if (!selected) return
    if (index < quiz.length - 1) {
      setIndex((value) => value + 1)
      setSelected(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (mode !== 'review') {
      const score = answers.filter((answer) => answer.correct).length
      setData((previous) => completeSet(previous, score, quiz.length))
    }
    navigate('result')
  }

  const openDetail = (id: number) => {
    setDetailId(id)
    navigate('detail')
  }

  return (
    <div className="app-shell">
      {screen !== 'quiz' && (
        <header className="site-header">
          <button className="wordmark" onClick={() => navigate('home')} aria-label="ホームへ">mylingo<span>.</span></button>
          <nav aria-label="メインナビゲーション">
            <button className={screen === 'questions' || screen === 'detail' ? 'active' : ''} onClick={() => navigate('questions')}>問題一覧</button>
            <button className={screen === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}>設定</button>
          </nav>
        </header>
      )}

      <main className={screen === 'quiz' ? 'quiz-main' : ''}>
        {screen === 'home' && <Dashboard data={data} onStart={startQuiz} onNavigate={navigate} />}
        {screen === 'quiz' && quiz[index] && (
          <QuizView
            question={quiz[index]}
            current={index + 1}
            total={quiz.length}
            selected={selected}
            onChoose={choose}
            onNext={next}
            onExit={() => navigate('home')}
          />
        )}
        {screen === 'result' && (
          <ResultView
            answers={answers}
            isReview={mode === 'review'}
            setsToday={data.dailyHistory[localDate()]?.setsCompleted ?? 0}
            onAgain={() => startQuiz('normal')}
            onReview={startReview}
            onHome={() => navigate('home')}
          />
        )}
        {screen === 'questions' && <QuestionList data={data} onOpen={openDetail} />}
        {screen === 'detail' && detailId !== null && <QuestionDetail id={detailId} data={data} onBack={() => navigate('questions')} />}
        {screen === 'settings' && <Settings data={data} setData={setData} />}
      </main>
      {screen !== 'quiz' && <footer>Small steps, stronger English.</footer>}
    </div>
  )
}

function Dashboard({ data, onStart, onNavigate }: {
  data: AppData
  onStart: (mode: 'normal' | 'weak' | 'all' | 'category', category?: Category) => void
  onNavigate: (screen: Screen) => void
}) {
  const today = data.dailyHistory[localDate()]
  const learningStreak = streak(data.dailyHistory, 'learning')
  const perfectStreak = streak(data.dailyHistory, 'perfect')
  const totals = Object.values(data.dailyHistory).reduce((acc, day) => ({ answered: acc.answered + day.answered, correct: acc.correct + day.correct }), { answered: 0, correct: 0 })
  const levels = questions.reduce<Record<MasteryLevel, number>>((acc, question) => {
    const p = data.progress[question.id]
    acc[masteryLevel(p?.masteryScore ?? 0, p?.attempts ?? 0)] += 1
    return acc
  }, { unlearned: 0, review: 0, learning: 0, almost: 0, mastered: 0 })
  const [showModes, setShowModes] = useState(false)

  return (
    <>
      <section className={`goal-card ${today?.achievedDailyPerfect ? 'achieved' : ''}`}>
        <div>
          <p className="eyebrow">今日の目標</p>
          {today?.achievedDailyPerfect
            ? <h1><span className="goal-icon">✓</span> 今日の目標達成</h1>
            : <h1>10/10を1回達成する</h1>}
          <p>{today?.perfectSets ? `Perfect × ${today.perfectSets}` : '今日の最初の10問を始めましょう'}</p>
        </div>
        <div className="goal-mark" aria-hidden="true">10<span>/10</span></div>
      </section>

      <button className="primary-cta" onClick={() => onStart('normal')}>
        <span>10問スタート</span><span aria-hidden="true">→</span>
      </button>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>今日の学習</h2></div><span className="date-label">{new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</span></div>
        <div className="stat-grid today-stats">
          <Stat value={today?.setsCompleted ?? 0} label="セット" />
          <Stat value={`${today?.bestScore ?? 0} / 10`} label="Best" />
          <Stat value={formatPercent(today?.correct ?? 0, today?.answered ?? 0)} label={`${today?.correct ?? 0} / ${today?.answered ?? 0} 正解`} />
          <Stat value={today?.perfectSets ?? 0} label="Perfect" accent />
        </div>
      </section>

      <section className="streak-grid">
        <div className="streak-card"><span className="streak-icon fire">↗</span><div><strong>{learningStreak.current}日</strong><span>学習 streak</span></div><small>最長 {learningStreak.longest}日</small></div>
        <div className="streak-card"><span className="streak-icon star">★</span><div><strong>{perfectStreak.current}日</strong><span>Perfect streak</span></div><small>最長 {perfectStreak.longest}日</small></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">PROGRESS</p><h2>100問の定着状況</h2></div><button className="text-button" onClick={() => onNavigate('questions')}>すべて見る →</button></div>
        <div className="mastery-bar" aria-label="定着状況">
          {(['mastered', 'almost', 'learning', 'review', 'unlearned'] as MasteryLevel[]).map((level) => levels[level] > 0 && <span key={level} className={`bar-${level}`} style={{ width: `${levels[level]}%` }} />)}
        </div>
        <div className="legend-grid">
          {(['mastered', 'almost', 'learning', 'review', 'unlearned'] as MasteryLevel[]).map((level) => <div key={level}><i className={`dot bar-${level}`} /><span>{MASTERY_LABELS[level]}</span><strong>{levels[level]}</strong></div>)}
        </div>
        <div className="overall-row">
          <div><span>累計回答</span><strong>{totals.answered}</strong></div>
          <div><span>累計正答率</span><strong>{formatPercent(totals.correct, totals.answered)}</strong></div>
          <div><span>定着済み</span><strong>{levels.mastered}</strong></div>
          <div><span>要復習</span><strong>{levels.review}</strong></div>
        </div>
      </section>

      <Calendar history={data.dailyHistory} />

      <section className="section-block modes">
        <button className="section-heading mode-toggle" onClick={() => setShowModes(!showModes)} aria-expanded={showModes}>
          <div><p className="eyebrow">STUDY MODE</p><h2>学習モードを選ぶ</h2></div><span>{showModes ? '−' : '+'}</span>
        </button>
        {showModes && <div className="mode-list">
          <button onClick={() => onStart('weak')}><strong>苦手問題</strong><span>間違えた問題・正答率の低い問題から</span><b>→</b></button>
          <button onClick={() => onStart('all')}><strong>全問題</strong><span>100問からランダムに出題</span><b>→</b></button>
          <div className="category-mode"><strong>カテゴリ別</strong><div>{(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => <button key={category} onClick={() => onStart('category', category)}>{CATEGORY_LABELS[category]}</button>)}</div></div>
        </div>}
      </section>
    </>
  )
}

function Stat({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
  return <div className={accent ? 'accent-stat' : ''}><strong>{value}</strong><span>{label}</span></div>
}

function Calendar({ history }: { history: AppData['dailyHistory'] }) {
  const days = useMemo(() => {
    const result: { date: string; record?: AppData['dailyHistory'][string] }[] = []
    const cursor = new Date()
    cursor.setDate(cursor.getDate() - 83)
    for (let i = 0; i < 84; i += 1) {
      const key = localDate(cursor)
      result.push({ date: key, record: history[key] })
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }, [history])
  return <section className="section-block calendar-card">
    <div className="section-heading"><div><p className="eyebrow">HISTORY</p><h2>12週間の学習</h2></div></div>
    <div className="calendar-grid">{days.map(({ date, record }) => {
      const level = Math.min(record?.setsCompleted ?? 0, 3)
      return <span key={date} className={`calendar-day level-${level}`} title={`${date}: ${record?.setsCompleted ?? 0}セット`} aria-label={`${date} ${record?.setsCompleted ?? 0}セット`}>{record?.achievedDailyPerfect ? '★' : ''}</span>
    })}</div>
    <div className="calendar-key"><span>少ない</span><i className="level-0"/><i className="level-1"/><i className="level-2"/><i className="level-3"/><span>多い</span></div>
  </section>
}

function QuizView({ question, current, total, selected, onChoose, onNext, onExit }: {
  question: Question
  current: number
  total: number
  selected: string | null
  onChoose: (choice: string) => void
  onNext: () => void
  onExit: () => void
}) {
  const choices = useMemo(() => shuffle([question.answer, ...question.distractors]), [question])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (!selected && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        onChoose(choices[Number(event.key) - 1])
      }
      if (selected && event.key === 'Enter') {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choices, selected, onChoose, onNext])

  return <div className="quiz-wrap">
    <header className="quiz-header"><button onClick={onExit} aria-label="クイズを終了">×</button><div className="quiz-progress"><span style={{ width: `${current / total * 100}%` }} /></div><strong>{current}<span> / {total}</span></strong></header>
    <article className="quiz-card">
      <p className="category-chip">TOEFL COLLOCATION</p>
      <h1>{question.question}</h1>
      <p className="quiz-prompt">空欄に入る最も自然な表現を選んでください。</p>
      <div className="choice-list">
        {choices.map((choice, choiceIndex) => {
          let state = ''
          if (selected) {
            if (choice === question.answer) state = 'correct'
            else if (choice === selected) state = 'wrong'
            else state = 'muted'
          }
          return <button key={choice} className={state} disabled={Boolean(selected)} onClick={() => onChoose(choice)}><kbd>{choiceIndex + 1}</kbd><span>{displayChoice(choice)}</span>{state === 'correct' && <b>✓</b>}{state === 'wrong' && <b>×</b>}</button>
        })}
      </div>
      {selected && <div className={`feedback ${selected === question.answer ? 'success' : 'error'}`} aria-live="polite">
        <p className="feedback-title">{selected === question.answer ? '正解です' : 'もう一度覚えよう'}</p>
        {selected !== question.answer && <p className="answer-line"><span>あなたの回答</span><s>{displayChoice(selected)}</s></p>}
        <p className="answer-line"><span>正解</span><strong>{displayChoice(question.answer)}</strong></p>
        <div className="explanation"><span className="answer-category">{CATEGORY_LABELS[question.category]}</span><h2>{question.collocation}</h2><p>{question.meaning}</p><blockquote>{question.example}</blockquote></div>
      </div>}
      {selected && <button className="next-button" onClick={onNext}>{current === total ? '結果を見る' : '次へ'} <span>↵</span></button>}
    </article>
  </div>
}

function ResultView({ answers, isReview, setsToday, onAgain, onReview, onHome }: {
  answers: AnswerResult[]
  isReview: boolean
  setsToday: number
  onAgain: () => void
  onReview: () => void
  onHome: () => void
}) {
  const score = answers.filter((answer) => answer.correct).length
  const missed = answers.filter((answer) => !answer.correct)
  const perfect = score === answers.length && answers.length === 10
  return <section className="result-card">
    <div className={`result-ring ${perfect ? 'perfect' : ''}`}><strong>{score}</strong><span>/ {answers.length}</span></div>
    <p className="eyebrow">{isReview ? 'REVIEW COMPLETE' : 'SET COMPLETE'}</p>
    <h1>{perfect ? 'Perfect!' : isReview ? '復習完了' : '1セット完了'}</h1>
    <p>{isReview ? `${score}問正解しました` : `今日は ${setsToday}セット完了しました`}</p>
    <div className="result-summary"><div><span>正解</span><strong>{score}</strong></div><div><span>もう一度</span><strong>{missed.length}</strong></div><div><span>正答率</span><strong>{formatPercent(score, answers.length)}</strong></div></div>
    <button className="primary-cta" onClick={onAgain}>もう10問やる <span>→</span></button>
    {missed.length > 0 && <button className="secondary-button" onClick={onReview}>間違えた{missed.length}問を復習</button>}
    <button className="text-button home-link" onClick={onHome}>ホームに戻る</button>
  </section>
}

function QuestionList({ data, onOpen }: { data: AppData; onOpen: (id: number) => void }) {
  const [filter, setFilter] = useState<'all' | MasteryLevel>('all')
  const [category, setCategory] = useState<'all' | Category>('all')
  const [sort, setSort] = useState('mastery-asc')
  const visible = useMemo(() => questions.filter((q) => {
    const p = data.progress[q.id]
    const level = masteryLevel(p?.masteryScore ?? 0, p?.attempts ?? 0)
    return (filter === 'all' || filter === level) && (category === 'all' || category === q.category)
  }).sort((a, b) => {
    const pa = data.progress[a.id] ?? emptyProgress(a.id)
    const pb = data.progress[b.id] ?? emptyProgress(b.id)
    if (sort === 'mastery-desc') return pb.masteryScore - pa.masteryScore
    if (sort === 'accuracy') return (pa.attempts ? pa.correct / pa.attempts : -1) - (pb.attempts ? pb.correct / pb.attempts : -1)
    if (sort === 'recent-wrong') return Number(pb.lastResult === false) - Number(pa.lastResult === false) || (pb.lastAnsweredAt ?? '').localeCompare(pa.lastAnsweredAt ?? '')
    if (sort === 'oldest') return (pa.lastAnsweredAt ?? '').localeCompare(pb.lastAnsweredAt ?? '')
    return pa.masteryScore - pb.masteryScore
  }), [category, data.progress, filter, sort])

  return <section className="page-section">
    <div className="page-title"><p className="eyebrow">ALL QUESTIONS</p><h1>問題一覧</h1><p>100問の学習状況を確認できます。</p></div>
    <div className="filters">
      <select aria-label="定着度で絞り込み" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">すべての定着度</option>{(Object.keys(MASTERY_LABELS) as MasteryLevel[]).map((key) => <option key={key} value={key}>{MASTERY_LABELS[key]}</option>)}</select>
      <select aria-label="カテゴリで絞り込み" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}><option value="all">すべてのカテゴリ</option>{(Object.keys(CATEGORY_LABELS) as Category[]).map((key) => <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>)}</select>
      <select aria-label="並び順" value={sort} onChange={(e) => setSort(e.target.value)}><option value="mastery-asc">定着度が低い順</option><option value="mastery-desc">定着度が高い順</option><option value="accuracy">正答率が低い順</option><option value="recent-wrong">最近間違えた順</option><option value="oldest">最終回答が古い順</option></select>
    </div>
    <p className="result-count">{visible.length}問</p>
    <div className="question-table">
      {visible.map((question) => {
        const p = data.progress[question.id] ?? emptyProgress(question.id)
        const level = masteryLevel(p.masteryScore, p.attempts)
        return <button key={question.id} onClick={() => onOpen(question.id)}>
          <div className="question-name"><span className={`mastery-pill ${level}`}>{MASTERY_LABELS[level]}</span><strong>{question.collocation}</strong><small>{question.meaning}</small></div>
          <div className="question-meta"><span><b>{p.masteryScore}</b>/100</span><span>{formatPercent(p.correct, p.attempts)}</span><span>{p.attempts}回</span><span>{shortDate(p.lastAnsweredAt)}</span><b>›</b></div>
        </button>
      })}
    </div>
  </section>
}

function QuestionDetail({ id, data, onBack }: { id: number; data: AppData; onBack: () => void }) {
  const question = questions.find((item) => item.id === id)!
  const p = data.progress[id] ?? emptyProgress(id)
  const level = masteryLevel(p.masteryScore, p.attempts)
  const wrongChoices = Object.entries(p.wrongChoices).sort((a, b) => b[1] - a[1])
  return <section className="page-section detail-page">
    <button className="back-button" onClick={onBack}>← 問題一覧</button>
    <article className="detail-card">
      <div className="detail-head"><div><span className={`mastery-pill ${level}`}>{MASTERY_LABELS[level]}</span><p>{CATEGORY_LABELS[question.category]}</p></div><div className="mastery-score"><strong>{p.masteryScore}</strong><span>/ 100<br/>mastery</span></div></div>
      <h1>{question.collocation}</h1><p className="meaning">{question.meaning}</p>
      <div className="detail-example"><span>QUESTION</span><p>{question.question}</p><span>ANSWER</span><strong>{displayChoice(question.answer)}</strong><blockquote>{question.example}</blockquote></div>
      <div className="detail-stats"><Stat value={p.attempts} label="回答"/><Stat value={p.correct} label="正解"/><Stat value={p.incorrect} label="不正解"/><Stat value={formatPercent(p.correct, p.attempts)} label="正答率"/><Stat value={p.correctDates.length} label="正解した日数"/><Stat value={shortDate(p.lastAnsweredAt)} label="最終回答"/></div>
      <div className="wrong-choices"><h2>よく選ぶ誤答</h2>{wrongChoices.length ? wrongChoices.map(([choice, count]) => <p key={choice}><span>{displayChoice(choice)}</span><strong>× {count}</strong></p>) : <p className="empty-copy">まだ誤答はありません。</p>}</div>
    </article>
  </section>
}

function Settings({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const next = validateImport(JSON.parse(await file.text()))
      saveData(next)
      setData(next)
      setNotice('学習履歴を復元しました。')
    } catch (error) { setNotice(error instanceof Error ? error.message : '読み込みに失敗しました。') }
    if (fileRef.current) fileRef.current.value = ''
  }
  const reset = () => {
    if (!window.confirm('すべての学習履歴を削除します。この操作は取り消せません。よろしいですか？')) return
    setData(resetData())
    setNotice('学習履歴をリセットしました。')
  }
  return <section className="page-section settings-page">
    <div className="page-title"><p className="eyebrow">SETTINGS</p><h1>設定</h1><p>データのバックアップと復元ができます。</p></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="settings-card"><div><h2>学習履歴をExport</h2><p>問題ごとの定着度や日ごとの学習記録をJSONファイルに保存します。</p></div><button className="secondary-button" onClick={() => exportData(data)}>JSONを保存</button></div>
    <div className="settings-card"><div><h2>学習履歴をImport</h2><p>mylingoからExportしたJSONを読み込んで復元します。</p></div><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])}/><button className="secondary-button" onClick={() => fileRef.current?.click()}>JSONを選択</button></div>
    <div className="storage-note"><strong>この端末だけに保存されます</strong><p>学習履歴はこのブラウザのlocalStorageに保存されます。別デバイスには自動同期されません。定期的なExportをおすすめします。</p></div>
    <div className="settings-card danger-zone"><div><h2>学習履歴をリセット</h2><p>すべての回答履歴、streak、定着度を削除します。</p></div><button onClick={reset}>すべて削除</button></div>
  </section>
}
