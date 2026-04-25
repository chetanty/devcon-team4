import { useEffect, useMemo, useState } from 'react'
import LessonCard from './components/LessonCard'
import './App.css'
import translations from './translations.js'
import ManualReader from './ManualReader'
import contentData from './content.json'

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? ''

const STORAGE_KEYS = {
  selectedLanguage: 'selectedLanguage',
  xp: 'xp',
  level: 'level',
  hearts: 'hearts',
  questionIndex: 'questionIndex',
}

const LANGUAGES = [
  { code: 'english', label: 'English', flag: '🇨🇦' },
  { code: 'french', label: 'French', flag: '🇫🇷' },
  { code: 'german', label: 'German', flag: '🇩🇪' },
  { code: 'spanish', label: 'Spanish', flag: '🇪🇸' },
  { code: 'tagalog', label: 'Tagalog', flag: '🇵🇭' },
  { code: 'punjabi', label: 'Punjabi', flag: '🇮🇳' },
]

const MODE_META = {
  explain: { label: '📘 Explain', loading: 'Explaining...' },
  quiz: { label: '📝 Quiz Me', loading: 'Building Quiz...' },
  scenario: { label: '🎭 Scenario Practice', loading: 'Creating Scenario...' },
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

function isQuizOptionLine(line) {
  return /^[ABCD]\)\s*/.test(line.trim())
}

function readStoredInteger(key, fallback, min, max) {
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
}

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.selectedLanguage) ?? ''
    } catch {
      return ''
    }
  })

  const t = translations[selectedLanguage] || translations.english

  const MODE_META = useMemo(
    () => ({
      explain: { label: t.explain, loading: t.explaining },
      quiz: { label: t.quiz, loading: t.buildingQuiz },
      scenario: { label: t.scenario, loading: t.creatingScenario },
    }),
    [t],
  )

  const [xp, setXp] = useState(() => readStoredInteger(STORAGE_KEYS.xp, 0, 0, 99))
  const [level, setLevel] = useState(() => readStoredInteger(STORAGE_KEYS.level, 1, 1, 9999))
  const [hearts, setHearts] = useState(() => readStoredInteger(STORAGE_KEYS.hearts, 3, 0, 3))
  const [questions, setQuestions] = useState([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [gameOver, setGameOver] = useState(() => readStoredInteger(STORAGE_KEYS.hearts, 3, 0, 3) === 0)
  const [activeTab, setActiveTab] = useState('lesson')

  const [topic, setTopic] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState('')
  const [answerMode, setAnswerMode] = useState('')

  const endpoint = useMemo(() => getChatEndpoint(API_URL), [])
  const totalQuestions = questions.length

  const activeLanguage = useMemo(
    () => LANGUAGES.find((language) => language.code === selectedLanguage) ?? null,
    [selectedLanguage],
  )

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
    } catch {
      // Ignore storage errors so the app still works in restricted environments.
    }
  }, [xp, level, hearts, questionIndex, selectedLanguage])

  useEffect(() => {
  if (selectedLanguage && questions.length === 0 && !loadingQuestions) {
    fetchQuestions(selectedLanguage)
  }
}, [selectedLanguage])

  const fetchQuestions = async (lang) => {
    const targetLang = lang || selectedLanguage || 'english'
    if (!endpoint) return
    setLoadingQuestions(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'questions',
          language: targetLang,
        }),
      })
      const data = await response.json()
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions)
        setQuestionIndex(0)
      }
    } catch (err) {
      console.error('Failed to fetch questions', err)
    } finally {
      setLoadingQuestions(false)
    }
  }

  const runMode = async (mode) => {
    const cleanTopic = topic.trim()
    if (!cleanTopic) {
      setError('Please enter a topic first.')
      return
    }
    if (!endpoint) {
      setError('VITE_API_URL is missing. Add it to your .env file and restart Vite.')
      return
    }

    setLoading(true)
    setError('')
    setAnswer('')
    setActiveMode(mode)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
       body: JSON.stringify({
                message: `${mode}: ${cleanTopic}`,
                language: selectedLanguage || 'english',
                topic: cleanTopic,
                mode,
              }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Request failed. Please try again.')
      }
      if (!data.answer) {
        throw new Error('Backend returned no answer text.')
      }
      setAnswer(data.answer)
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.')
    } finally {
      setLoading(false)
      setActiveMode('')
    }
  }

  const handleModeClick = (mode) => {
    setAnswerMode(mode)
    runMode(mode)
  }

  const handleLanguageSelection = (languageCode) => {
    setSelectedLanguage(languageCode)
    fetchQuestions(languageCode)
  }

  const handleLanguageReset = () => {
    setSelectedLanguage('')
    setActiveTab('lesson')

    try {
      window.localStorage.removeItem(STORAGE_KEYS.selectedLanguage)
    } catch {
      // Ignore storage errors so users can still switch language in restricted contexts.
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

  const handleQuestionAdvance = () => {
    if (gameOver || totalQuestions === 0) {
      return
    }

    setQuestionIndex((currentIndex) => (currentIndex + 1) % totalQuestions)
  }

  const handleRestartAfterGameOver = () => {
    setHearts(3)
    fetchQuestions()
  }

  const answerIcon =
    answerMode === 'explain' ? '📘' : answerMode === 'scenario' ? '🎭' : ''

  if (!selectedLanguage) {
    return (
      <main className="language-screen">
        <section className="language-card">
          <h1>GuardBuddy AI</h1>
          <p className="landing-tagline">{t.chooseLanguage}</p>

          <div className="language-grid">
            {LANGUAGES.map((language) => (
              <button
                key={language.code}
                type="button"
                className="language-button"
                onClick={() => setSelectedLanguage(language.code)}
              >
                <span className="language-flag" aria-hidden="true">
                  {language.flag}
                </span>
                <span>{language.label}</span>
              </button>
            ))}
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
              <span className="level-text">{t.level} {level}</span>
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
            <p className="subtitle">{t.appTagline}</p>
          </div>
          <button
            type="button"
            className="language-chip language-chip-button"
            onClick={handleLanguageReset}
            aria-label="Change language"
            title="Change language"
          >
            {activeLanguage?.flag} {activeLanguage?.label}
            <span className="language-chip-action">{t.change}</span>
          </button>
          <span className="language-chip">
            {activeLanguage?.flag} {activeLanguage?.label}
          </span>
        </header>

        <nav className="tabs-row" aria-label="Mode Selection">
          <button
            type="button"
            className={`tab-button ${activeTab === 'lesson' ? 'active' : ''}`}
            onClick={() => setActiveTab('lesson')}
          >
            {t.lessonMode}
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'aiTutor' ? 'active' : ''}`}
            onClick={() => setActiveTab('aiTutor')}
          >
            {t.aiTutor}
          </button>
        </nav>

        {gameOver ? (
          <section className="game-over-card">
            <h2>{t.gameOver}</h2>
            <p>{t.gameOverMsg}</p>
            <button type="button" className="restart-button" onClick={handleRestartAfterGameOver}>
              {t.restart}
            </button>
          </section>
        ) : null}

        {!gameOver && activeTab === 'lesson' ? (
          loadingQuestions ? (
            <section className="empty-state">
              <p>{t.loadingQuestions || 'Loading questions...'}</p>
            </section>
          ) : currentQuestion ? (
            <LessonCard
              question={currentQuestion}
              questionNumber={questionIndex + 1}
              totalQuestions={totalQuestions}
              onAnswer={handleQuestionAnswered}
              onAdvance={handleQuestionAdvance}
              t={t}
            />
          ) : (
            <section className="empty-state">{t.noQuestions}</section>
          )
        ) : null}

        {!gameOver && activeTab === 'aiTutor' ? (
          <section className="ai-tutor-section">
            <label htmlFor="topic" className="label">
              {t.topic}
            </label>
            <input
              id="topic"
              className="topic-input"
              type="text"
              placeholder={t.topicPlaceholder}
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

            {loading ? <p className="status">{t.generating}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {answer ? (
              <article className="output-card fade-in">
                <div className="answer-header">
                  <div className="answer-title-wrap">
                    {answerIcon ? <span className="answer-icon">{answerIcon}</span> : null}
                    <h2>{t.aiResponse}</h2>
                  </div>
                  <span className="mode-chip">{MODE_META[answerMode]?.label || 'Response'}</span>
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
              </article>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  )
}

export default App
