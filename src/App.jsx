import { useEffect, useRef, useState } from 'react'
import LessonCard from './components/LessonCard'
import questions from './questions.json'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? ''
const DAILY_LIVES = 3

const STORAGE_KEYS = {
  selectedLanguage: 'selectedLanguage',
  xp: 'xp',
  level: 'level',
  hearts: 'hearts',
  lifeDay: 'lifeDay',
  questionIndex: 'questionIndex',
  correctAnswers: 'correctAnswers',
  lessonComplete: 'lessonComplete',
}

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'tagalog', label: 'Tagalog' },
  { value: 'punjabi', label: 'Punjabi' },
]

const STARTER_PROMPTS = [
  'Explain observe, deter, report in simple terms.',
  'What should a security guard do after an arrest?',
  'Give me one practice scenario about use of force.',
]

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ask a short question from the Alberta manual. I will answer only from the manual and reply in your selected language.',
}

function getChatEndpoint(apiUrl) {
  if (!apiUrl) {
    return ''
  }

  if (apiUrl.endsWith('/chat')) {
    return apiUrl
  }

  return `${apiUrl.replace(/\/+$/, '')}/chat`
}

function getTodayStamp() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextDayLabel(dayStamp) {
  const nextDay = new Date(`${dayStamp}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  return nextDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function readStoredValue(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readStoredInteger(key, fallback, min, max) {
  const rawValue = readStoredValue(key)

  if (rawValue === null) {
    return fallback
  }

  const parsedValue = Number.parseInt(rawValue, 10)

  if (Number.isNaN(parsedValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsedValue))
}

function readStoredBoolean(key, fallback) {
  const rawValue = readStoredValue(key)

  if (rawValue === null) {
    return fallback
  }

  return rawValue === 'true'
}

function getInitialProgress() {
  const today = getTodayStamp()
  const totalQuestions = Math.max(questions.length - 1, 0)
  const storedDay = readStoredValue(STORAGE_KEYS.lifeDay)
  const shouldResumeLesson = storedDay === today

  return {
    selectedLanguage: readStoredValue(STORAGE_KEYS.selectedLanguage) ?? '',
    xp: readStoredInteger(STORAGE_KEYS.xp, 0, 0, 99),
    level: readStoredInteger(STORAGE_KEYS.level, 1, 1, 9999),
    hearts: shouldResumeLesson
      ? readStoredInteger(STORAGE_KEYS.hearts, DAILY_LIVES, 0, DAILY_LIVES)
      : DAILY_LIVES,
    lifeDay: today,
    questionIndex: shouldResumeLesson
      ? readStoredInteger(STORAGE_KEYS.questionIndex, 0, 0, totalQuestions)
      : 0,
    correctAnswers: shouldResumeLesson
      ? readStoredInteger(STORAGE_KEYS.correctAnswers, 0, 0, questions.length)
      : 0,
    lessonComplete: shouldResumeLesson ? readStoredBoolean(STORAGE_KEYS.lessonComplete, false) : false,
  }
}

function getLanguageLabel(value) {
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function App() {
  const [progress, setProgress] = useState(() => getInitialProgress())
  const [activeView, setActiveView] = useState('lesson')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showGameOverModal, setShowGameOverModal] = useState(() => getInitialProgress().hearts === 0)

  const bottomRef = useRef(null)
  const nextIdRef = useRef(1)
  const heartsRef = useRef(progress.hearts)
  const endpoint = getChatEndpoint(API_URL)

  const activeLanguageLabel = getLanguageLabel(progress.selectedLanguage || 'english')
  const currentQuestion = progress.lessonComplete ? null : questions[progress.questionIndex] ?? null
  const progressPercent = questions.length
    ? progress.lessonComplete
      ? 100
      : ((progress.questionIndex + 1) / questions.length) * 100
    : 0
  const accuracy = questions.length ? Math.round((progress.correctAnswers / questions.length) * 100) : 0
  const nextLivesLabel = getNextDayLabel(progress.lifeDay)

  const createMessageId = (prefix) => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    return `${prefix}-${id}`
  }

  useEffect(() => {
    heartsRef.current = progress.hearts
  }, [progress.hearts])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, activeView])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.selectedLanguage, progress.selectedLanguage)
      window.localStorage.setItem(STORAGE_KEYS.xp, String(progress.xp))
      window.localStorage.setItem(STORAGE_KEYS.level, String(progress.level))
      window.localStorage.setItem(STORAGE_KEYS.hearts, String(progress.hearts))
      window.localStorage.setItem(STORAGE_KEYS.lifeDay, progress.lifeDay)
      window.localStorage.setItem(STORAGE_KEYS.questionIndex, String(progress.questionIndex))
      window.localStorage.setItem(STORAGE_KEYS.correctAnswers, String(progress.correctAnswers))
      window.localStorage.setItem(STORAGE_KEYS.lessonComplete, String(progress.lessonComplete))
    } catch {
      // Ignore storage errors so the interface still works in restricted environments.
    }
  }, [progress])

  const updateProgress = (updater) => {
    setProgress((current) => {
      if (typeof updater === 'function') {
        return updater(current)
      }

      return { ...current, ...updater }
    })
  }

  const handleLanguageSelection = (languageValue) => {
    updateProgress({ selectedLanguage: languageValue })
    setMessages([INITIAL_MESSAGE])
    setActiveView('lesson')
    setError('')
  }

  const handleQuestionAnswered = (isCorrect) => {
    updateProgress((current) => {
      if (isCorrect) {
        const totalXp = current.xp + 10
        const levelGain = Math.floor(totalXp / 100)

        return {
          ...current,
          xp: totalXp % 100,
          level: current.level + levelGain,
          correctAnswers: current.correctAnswers + 1,
        }
      }

      return {
        ...current,
        hearts: Math.max(current.hearts - 1, 0),
      }
    })

    if (!isCorrect && heartsRef.current === 1) {
      setShowGameOverModal(true)
    }
  }

  const handleQuestionAdvance = () => {
    if (heartsRef.current === 0) {
      return
    }

    updateProgress((current) => {
      const nextIndex = current.questionIndex + 1

      if (nextIndex >= questions.length) {
        return {
          ...current,
          lessonComplete: true,
        }
      }

      return {
        ...current,
        questionIndex: nextIndex,
      }
    })
  }

  const handleLessonReplay = () => {
    updateProgress((current) => ({
      ...current,
      questionIndex: 0,
      correctAnswers: 0,
      lessonComplete: false,
    }))
    setActiveView('lesson')
  }

  const sendMessage = async (rawText) => {
    const cleanText = rawText.trim()

    if (!cleanText || loading) {
      return
    }

    if (!endpoint) {
      setError('Add VITE_API_URL to .env so the tutor can reach your API Gateway URL.')
      setActiveView('tutor')
      return
    }

    const userMessage = {
      id: createMessageId('user'),
      role: 'user',
      text: cleanText,
    }

    setMessages((current) => [...current, userMessage])
    setInput('')
    setError('')
    setLoading(true)
    setActiveView('tutor')

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: progress.selectedLanguage || 'english',
          message: cleanText,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Tutor request failed.')
      }

      if (!data.answer) {
        throw new Error('Backend returned no answer.')
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId('assistant'),
          role: 'assistant',
          text: data.answer,
          sourceTitles: Array.isArray(data.sourceTitles) ? data.sourceTitles : [],
          sourceLanguage: data.sourceLanguage || progress.selectedLanguage,
        },
      ])
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleTutorSubmit = async (event) => {
    event.preventDefault()
    await sendMessage(input)
  }

  if (!progress.selectedLanguage) {
    return (
      <main className="app-shell">
        <div className="ambient-scene" aria-hidden="true">
          <div className="scene-grid"></div>
          <div className="scene-orb orb-one"></div>
          <div className="scene-orb orb-two"></div>
          <div className="scene-orb orb-three"></div>
          <div className="scene-card card-one"></div>
          <div className="scene-card card-two"></div>
        </div>

        <section className="welcome-panel surface-card">
          <p className="eyebrow">GuardBuddy AI</p>
          <h1>Simple, calm study support for the Alberta security manual.</h1>
          <p className="welcome-copy">
            Pick a language, answer one short question at a time, and use the AI tutor whenever
            the English manual gets hard to follow.
          </p>

          <div className="language-grid">
            {LANGUAGE_OPTIONS.map((language) => (
              <button
                key={language.value}
                type="button"
                className="language-button"
                onClick={() => handleLanguageSelection(language.value)}
              >
                <span className="language-button-label">{language.label}</span>
                <span className="language-button-meta">Reply in {language.label}</span>
              </button>
            ))}
          </div>

          <div className="welcome-footnote">
            <span>3 lesson lives each day</span>
            <span>Manual-only AI answers</span>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="ambient-scene" aria-hidden="true">
        <div className="scene-grid"></div>
        <div className="scene-orb orb-one"></div>
        <div className="scene-orb orb-two"></div>
        <div className="scene-orb orb-three"></div>
        <div className="scene-card card-one"></div>
        <div className="scene-card card-two"></div>
      </div>

      <section className="workspace-shell">
        <header className="topbar surface-card">
          <div className="topbar-copy">
            <p className="eyebrow">Alberta Basic Security Training</p>
            <h1>Study one step at a time</h1>
            <p className="subtitle">
              Clear lessons, short questions, and manual-only AI help in {activeLanguageLabel}.
            </p>
          </div>

          <div className="topbar-meta">
            <button
              type="button"
              className="text-button"
              onClick={() => updateProgress({ selectedLanguage: '' })}
            >
              Change language
            </button>

            <div className="hearts-area" aria-label="Lives remaining">
              {[0, 1, 2].map((index) => (
                <span key={index} className={`heart ${index < progress.hearts ? 'active' : 'empty'}`}>
                  ❤
                </span>
              ))}
            </div>
          </div>
        </header>

        <section className="progress-shell surface-card">
          <div className="progress-label-row">
            <span>Lesson progress</span>
            <span>
              {progress.lessonComplete ? questions.length : progress.questionIndex + 1} / {questions.length}
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </section>

        <section className="content-grid">
          <section className="main-column">
            <nav className="mode-switch surface-card" aria-label="Study modes">
              <button
                type="button"
                className={`mode-pill ${activeView === 'lesson' ? 'is-active' : ''}`}
                onClick={() => setActiveView('lesson')}
              >
                Lesson
              </button>
              <button
                type="button"
                className={`mode-pill ${activeView === 'tutor' ? 'is-active' : ''}`}
                onClick={() => setActiveView('tutor')}
              >
                Ask GuardBuddy
              </button>
            </nav>

            {activeView === 'lesson' ? (
              progress.lessonComplete ? (
                <section className="surface-card completion-card motion-frame">
                  <div className="completion-badge" aria-hidden="true">
                    ✦
                  </div>
                  <p className="eyebrow">Lesson Complete</p>
                  <h2>You finished today&apos;s guided practice.</h2>
                  <p className="completion-copy">
                    The lesson stayed short on purpose so learners can move through the manual with less pressure.
                  </p>

                  <div className="stats-grid">
                    <article className="stat-card">
                      <span className="stat-label">Score</span>
                      <strong>{accuracy}%</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">Total XP</span>
                      <strong>{progress.correctAnswers * 10}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">Lives Left</span>
                      <strong>{progress.hearts}</strong>
                    </article>
                  </div>

                  <div className="completion-actions">
                    <button type="button" className="primary-button" onClick={handleLessonReplay}>
                      Practice Again
                    </button>
                    <button type="button" className="ghost-button" onClick={() => setActiveView('tutor')}>
                      Ask About A Weak Spot
                    </button>
                  </div>
                </section>
              ) : (
                <div key={currentQuestion?.id ?? 'lesson'} className="motion-frame">
                  <LessonCard
                    question={currentQuestion}
                    questionNumber={progress.questionIndex + 1}
                    totalQuestions={questions.length}
                    onAnswer={handleQuestionAnswered}
                    onAdvance={handleQuestionAdvance}
                  />
                </div>
              )
            ) : (
              <section className="surface-card tutor-card motion-frame">
                <header className="section-head">
                  <div>
                    <p className="eyebrow">Manual-Only Tutor</p>
                    <h2>Ask GuardBuddy</h2>
                  </div>
                  <span className="language-chip">{activeLanguageLabel}</span>
                </header>

                <p className="section-copy">
                  Keep your questions short. The tutor answers only from the Alberta manual content sent to the backend.
                </p>

                {!endpoint ? (
                  <div className="setup-banner">
                    Set `VITE_API_URL` in `.env` so this panel can call your API Gateway endpoint.
                  </div>
                ) : null}

                <div className="prompt-list">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-chip"
                      onClick={() => void sendMessage(prompt)}
                      disabled={loading}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="message-list">
                  {messages.map((message) => (
                    <article key={message.id} className={`message-bubble ${message.role}`}>
                      <p className="message-text">{message.text}</p>
                      {message.role === 'assistant' && message.sourceTitles?.length ? (
                        <p className="message-meta">
                          Manual source: {message.sourceTitles.join(' • ')}
                          {message.sourceLanguage && message.sourceLanguage !== progress.selectedLanguage
                            ? ` (${getLanguageLabel(message.sourceLanguage)})`
                            : ''}
                        </p>
                      ) : null}
                    </article>
                  ))}

                  {loading ? (
                    <article className="message-bubble assistant pending">
                      <p className="message-text">Searching the manual and preparing a reply…</p>
                    </article>
                  ) : null}

                  <div ref={bottomRef} />
                </div>

                {error ? <p className="error-banner">{error}</p> : null}

                <form className="composer" onSubmit={handleTutorSubmit}>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={3}
                    placeholder={`Ask in ${activeLanguageLabel} or English…`}
                    disabled={loading}
                  ></textarea>
                  <button type="submit" className="primary-button" disabled={loading || !input.trim()}>
                    {loading ? 'Sending…' : 'Send'}
                  </button>
                </form>
              </section>
            )}
          </section>

          <aside className="side-column">
            <article className="surface-card side-card">
              <p className="eyebrow">Today</p>
              <h2>Three lesson lives</h2>
              <p className="section-copy">
                If you use all three lives, the lesson locks until tomorrow and the Rickroll appears.
              </p>
              <div className="side-chip-row">
                <span className="info-chip">{progress.hearts} left</span>
                <span className="info-chip">Resets {nextLivesLabel}</span>
              </div>
            </article>

            <article className="surface-card side-card">
              <p className="eyebrow">Progress</p>
              <h2>Keep it calm and clear</h2>
              <div className="stats-grid compact">
                <article className="stat-card">
                  <span className="stat-label">Level</span>
                  <strong>{progress.level}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">XP</span>
                  <strong>{progress.xp}/100</strong>
                </article>
              </div>
              <p className="section-copy">
                The interface stays simple so students can focus on the manual, not the UI.
              </p>
            </article>
          </aside>
        </section>
      </section>

      {showGameOverModal ? (
        <section className="overlay-shell" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
          <div className="overlay-card">
            <div className="overlay-icon" aria-hidden="true">
              🌙
            </div>

            <p className="eyebrow">Out Of Lives</p>
            <h2 id="game-over-title">You used all 3 lesson lives for today.</h2>
            <p className="completion-copy">
              Lives reset on {nextLivesLabel}. You can still switch to the AI tutor and keep studying the manual.
            </p>

            <div className="completion-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setShowGameOverModal(false)
                  setActiveView('tutor')
                }}
              >
                Keep Learning With AI Tutor
              </button>
              <button type="button" className="ghost-button" onClick={() => setShowGameOverModal(false)}>
                Close
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
