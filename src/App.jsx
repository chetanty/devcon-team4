import { useEffect, useRef, useState } from 'react'
import LessonCard from './components/LessonCard'
import questions from './questions.json'
import './App.css'
import ManualReader from './ManualReader'
import contentData from './content.json'

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

const LANGUAGES = [
  { code: 'english', label: 'English', flag: '🇨🇦' },
  { code: 'french', label: 'French', flag: '🇫🇷' },
  { code: 'german', label: 'German', flag: '🇩🇪' },
  { code: 'spanish', label: 'Spanish', flag: '🇪🇸' },
  { code: 'tagalog', label: 'Tagalog', flag: '🇵🇭' },
  { code: 'punjabi', label: 'Punjabi', flag: '🇮🇳' },
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
    const rawValue = window.localStorage.getItem(key)
    if (rawValue === null) {
      return fallback
    }
    const parsedValue = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsedValue)) {
      return fallback
    }
    return Math.min(max, Math.max(min, parsedValue))
  } catch {
    return fallback
  }

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.selectedLanguage) ?? ''
    } catch {
      return ''
    }
  })
  const [xp, setXp] = useState(() => readStoredInteger(STORAGE_KEYS.xp, 0, 0, 99))
  const [level, setLevel] = useState(() => readStoredInteger(STORAGE_KEYS.level, 1, 1, 9999))
  const [hearts, setHearts] = useState(() => readStoredInteger(STORAGE_KEYS.hearts, 3, 0, 3))
  const [questionIndex, setQuestionIndex] = useState(() => {
    const maxIndex = Math.max(questions.length - 1, 0)
    return readStoredInteger(STORAGE_KEYS.questionIndex, 0, 0, maxIndex)
  })
  const [activeTab, setActiveTab] = useState('reader')
  const [topic, setTopic] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState('')
  const [answerMode, setAnswerMode] = useState('')

  const endpoint = useMemo(() => getChatEndpoint(API_URL), [])
  const totalQuestions = questions.length
  const gameOver = hearts === 0

  if (rawValue === null) {
    return fallback
  }

  const currentQuestion = useMemo(() => {
    if (totalQuestions === 0) {
      return null
    }
    const safeIndex = questionIndex % totalQuestions
    return questions[safeIndex]
  }, [questionIndex, totalQuestions])

  const answerBlocks = useMemo(() => {
    if (!answer) {
      return []
    }
    return answer
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
  }, [answer])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.xp, String(xp))
      window.localStorage.setItem(STORAGE_KEYS.level, String(level))
      window.localStorage.setItem(STORAGE_KEYS.hearts, String(hearts))
      window.localStorage.setItem(STORAGE_KEYS.questionIndex, String(questionIndex))
      if (selectedLanguage) {
        window.localStorage.setItem(STORAGE_KEYS.selectedLanguage, selectedLanguage)
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

  const runMode = async (mode) => {
    const cleanTopic = topic.trim()
    if (!cleanTopic) {
      setError('Please enter a topic first.')
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
      setAnswer(data.answer)
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionAnswered = (isCorrect) => {
    if (isCorrect) {
      setXp((currentXp) => {
        const nextXp = currentXp + 10
        if (nextXp >= 100) {
          setLevel((currentLevel) => currentLevel + 1)
          return nextXp - 100
        }
        return nextXp
      })
      return
    }
    setHearts((currentHearts) => Math.max(currentHearts - 1, 0))
  }

  const answerIcon = answerMode === 'explain' ? '📘' : answerMode === 'scenario' ? '🎭' : ''

  if (!selectedLanguage) {
    return (
      <main className="language-screen">
        <section className="language-card">
          <h1>GuardBuddy AI</h1>
          <p className="landing-tagline">Choose your language</p>
          <div className="language-grid">
            {LANGUAGE_OPTIONS.map((language) => (
              <button
                key={language.value}
                type="button"
                className="language-button"
                onClick={() => setSelectedLanguage(language.code)}
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
      <section className="app-card">
        <header className="top-status-row">
          <section className="xp-area" aria-label="XP">
            <div className="xp-text-row">
              <span className="level-text">Level {level}</span>
              <span className="xp-text">{xp}/100 XP</span>
            </div>
            <div className="xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xp}>
              <div className="xp-fill" style={{ width: `${xp}%` }}></div>
            </div>
          </section>
          <section className="hearts-area" aria-label="Lives">
            {[0, 1, 2].map((index) => (
              <span key={index} className={`heart ${index < hearts ? 'active' : 'empty'}`}>
                ❤️
              </span>
            ))}
          </section>
        </header>

        <header className="title-row">
          <div>
            <h1>GuardBuddy AI</h1>
            <p className="subtitle">Your AI trainer for Alberta Security Guard exam</p>
          </div>

        <nav className="tabs-row" aria-label="Mode Selection">
          <button type="button" className={`tab-button ${activeTab === 'reader' ? 'active' : ''}`} onClick={() => setActiveTab('reader')}>
            Manual Reader
          </button>
          <button type="button" className={`tab-button ${activeTab === 'lesson' ? 'active' : ''}`} onClick={() => setActiveTab('lesson')}>
            Lesson Mode
          </button>
          <button type="button" className={`tab-button ${activeTab === 'aiTutor' ? 'active' : ''}`} onClick={() => setActiveTab('aiTutor')}>
            AI Tutor
          </button>
        </nav>

        {activeTab === 'reader' ? (
          <ManualReader key={selectedLanguage} content={contentData} apiUrl={endpoint} currentLanguage={selectedLanguage} />
        ) : null}

        {!gameOver && activeTab === 'lesson' ? (
          currentQuestion ? (
            <LessonCard
              question={currentQuestion}
              questionNumber={questionIndex + 1}
              totalQuestions={totalQuestions}
              onAnswer={handleQuestionAnswered}
              onAdvance={() => setQuestionIndex((currentIndex) => (currentIndex + 1) % totalQuestions)}
            />
          ) : (
            <section className="empty-state">No questions available yet.</section>
          )
        ) : null}

        {!gameOver && activeTab === 'aiTutor' ? (
          <section className="ai-tutor-section">
            <label htmlFor="topic" className="label">
              Topic
            </label>
            <input
              id="topic"
              className="topic-input"
              type="text"
              placeholder="Example: arrest authority"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={loading}
            />
            <div className="button-row">
              {Object.entries(MODE_META).map(([modeKey, meta]) => (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => {
                    setAnswerMode(modeKey)
                    runMode(modeKey)
                  }}
                  disabled={loading}
                  className="mode-button"
                >
                  {loading && activeMode === modeKey ? (
                    <span className="loading-inline">
                      <span className="spinner" aria-hidden="true"></span>
                      {meta.loading}
                    </span>
                  ) : (
                    <span>{meta.label}</span>
                  )}
                </button>
              ))}
            </div>
            {loading ? <p className="status">GuardBuddy is generating your response...</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {answer ? (
              <article className="output-card fade-in">
                <div className="answer-header">
                  <div className="answer-title-wrap">
                    {answerIcon ? <span className="answer-icon">{answerIcon}</span> : null}
                    <h2>AI Response</h2>
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
                <div className="answer-content">
                  {answerBlocks.map((block, blockIndex) => {
                    const lines = block
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                    const hasQuizOptions = answerMode === 'quiz' && lines.some((line) => isQuizOptionLine(line))
                    if (hasQuizOptions) {
                      return (
                        <div key={`${blockIndex}-${block.slice(0, 20)}`} className="answer-block">
                          {lines.map((line, lineIndex) =>
                            isQuizOptionLine(line) ? (
                              <span key={`${lineIndex}-${line}`} className="option-pill">
                                {line}
                              </span>
                            ) : (
                              <p key={`${lineIndex}-${line}`} className="answer-paragraph">
                                {line}
                              </p>
                            ),
                          )}
                        </div>
                      )
                    }
                    return (
                      <p key={`${blockIndex}-${block.slice(0, 20)}`} className="answer-paragraph">
                        {block}
                      </p>
                    )
                  })}
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