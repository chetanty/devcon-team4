import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? ''

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'tagalog', label: 'Tagalog' },
  { value: 'punjabi', label: 'Punjabi' },
]

const STARTER_QUESTIONS = [
  'What should a security guard do after making an arrest?',
  'Explain observe, deter, report in simple terms.',
  'Give me a practice scenario about use of force.',
]

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ask anything about the Alberta Basic Security manual. I will answer only from the manual and I will reply in your selected language.',
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

function getLanguageLabel(value) {
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function App() {
  const [isOpen, setIsOpen] = useState(true)
  const [language, setLanguage] = useState('english')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const bottomRef = useRef(null)
  const nextIdRef = useRef(1)
  const endpoint = getChatEndpoint(API_URL)

  const createMessageId = (prefix) => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    return `${prefix}-${id}`
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, isOpen])

  const sendMessage = async (rawText) => {
    const cleanText = rawText.trim()

    if (!cleanText || loading) {
      return
    }

    if (!endpoint) {
      setError('Add VITE_API_URL to .env so the chat can reach API Gateway.')
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

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          message: cleanText,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Chat request failed.')
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
          sourceLanguage: data.sourceLanguage || language,
        },
      ])
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await sendMessage(input)
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">GuardBuddy AI</p>
        <h1>Bedrock-powered study bot for the Alberta security manual</h1>
        <p className="hero-copy">
          The safe architecture for this project is{' '}
          <code>React -&gt; API Gateway -&gt; Lambda -&gt; Bedrock</code>.
          The frontend never holds AWS keys. Lambda loads `content.json`, finds the most relevant
          manual section, and asks Bedrock to answer only from that excerpt.
        </p>

        <div className="workflow-grid">
          <article className="workflow-card">
            <span className="workflow-step">01</span>
            <h2>Test Prompt In Bedrock</h2>
            <p>Use Bedrock playground first so you can see the JSON output shape before automating it.</p>
          </article>
          <article className="workflow-card">
            <span className="workflow-step">02</span>
            <h2>Generate `questions.json`</h2>
            <p>Run the new Python script against `content.json` once your AWS credentials are ready.</p>
          </article>
          <article className="workflow-card">
            <span className="workflow-step">03</span>
            <h2>Ship The Chatbot</h2>
            <p>The floating widget keeps history, lets the learner choose a language, and calls your API.</p>
          </article>
        </div>

        <div className="callout">
          <strong>Important:</strong> do not call Bedrock directly from the browser. That would expose AWS
          credentials to anyone opening the site.
        </div>

        <div className="starter-area">
          <p className="starter-label">Try one of these prompts</p>
          <div className="starter-list">
            {STARTER_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="starter-chip"
                onClick={() => {
                  setIsOpen(true)
                  void sendMessage(question)
                }}
                disabled={loading}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </section>

      <button
        type="button"
        className={`chat-launcher ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? 'Hide Tutor' : 'Open Tutor'}
      </button>

      <section className={`chat-panel ${isOpen ? 'is-visible' : ''}`}>
        <header className="chat-header">
          <div>
            <p className="chat-kicker">Floating Study Bot</p>
            <h2>Manual Chat</h2>
          </div>

          <label className="language-picker">
            <span>Reply Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={loading}>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {!endpoint ? (
          <div className="setup-banner">
            Set `VITE_API_URL` in `.env` to your API Gateway base URL before testing chat.
          </div>
        ) : null}

        <div className="message-list">
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <p className="message-text">{message.text}</p>
              {message.role === 'assistant' && message.sourceTitles?.length ? (
                <p className="message-meta">
                  Manual source: {message.sourceTitles.join(' • ')}
                  {message.sourceLanguage && message.sourceLanguage !== language
                    ? ` (matched in ${getLanguageLabel(message.sourceLanguage)})`
                    : ''}
                </p>
              ) : null}
            </article>
          ))}

          {loading ? (
            <article className="message assistant pending">
              <p className="message-text">Searching the manual and asking Bedrock...</p>
            </article>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Ask in ${getLanguageLabel(language)} or English...`}
            rows={3}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
