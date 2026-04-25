import { useEffect, useRef, useState } from 'react'
import './App.css'
import ManualReader from './ManualReader'
import contentData from './content.json' 

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
  if (!apiUrl) return ''
  if (apiUrl.endsWith('/chat')) return apiUrl
  return `${apiUrl.replace(/\/+$/, '')}/chat`
}

function getLanguageLabel(value) {
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function App() {
  // New state for switching between Reader and Chat
  const [view, setView] = useState('reader') 
  
  // Existing Chat States
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
    if (!cleanText || loading) return
    if (!endpoint) {
      setError('Add VITE_API_URL to .env so the chat can reach API Gateway.')
      return
    }

    const userMessage = { id: createMessageId('user'), role: 'user', text: cleanText }
    setMessages((current) => [...current, userMessage])
    setInput('')
    setError('')
    setLoading(true)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, message: cleanText }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Chat request failed.')
      
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
      {/* 1. View Switcher Navigation */}
      <nav className="view-switcher" style={{ display: 'flex', gap: '10px', padding: '10px', background: '#f4f4f4', borderBottom: '1px solid #ddd' }}>
        <button 
          className={`nav-btn ${view === 'reader' ? 'active' : ''}`} 
          onClick={() => setView('reader')}
          style={{ fontWeight: view === 'reader' ? 'bold' : 'normal' }}
        >
          📖 Manual Reader
        </button>
        <button 
          className={`nav-btn ${view === 'chat' ? 'active' : ''}`} 
          onClick={() => setView('chat')}
          style={{ fontWeight: view === 'chat' ? 'bold' : 'normal' }}
        >
          💬 Study Chat
        </button>
      </nav>

      {view === 'reader' ? (
        /* 2. The Working Reader Page */
        <ManualReader 
          content={contentData} 
          apiUrl={endpoint} 
          currentLanguage={language} 
        />
      ) : (
        /* 3. The Original Chatbot UI */
        <>
          <section className="hero-card">
            <p className="eyebrow">GuardBuddy AI</p>
            <h1>Bedrock-powered study bot</h1>
            <div className="starter-area">
              <p className="starter-label">Try one of these prompts</p>
              <div className="starter-list">
                {STARTER_QUESTIONS.map((q) => (
                  <button key={q} className="starter-chip" onClick={() => {setIsOpen(true); sendMessage(q)}} disabled={loading}>{q}</button>
                ))}
              </div>
            </div>
          </section>

          <button type="button" className={`chat-launcher ${isOpen ? 'is-open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? 'Hide Tutor' : 'Open Tutor'}
          </button>

          <section className={`chat-panel ${isOpen ? 'is-visible' : ''}`}>
            <header className="chat-header">
              <div><p className="chat-kicker">Study Bot</p><h2>Manual Chat</h2></div>
              <label className="language-picker">
                <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}>
                  {LANGUAGE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </label>
            </header>
            <div className="message-list">
              {messages.map((m) => (
                <article key={m.id} className={`message ${m.role}`}>
                  <p className="message-text">{m.text}</p>
                </article>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="composer" onSubmit={handleSubmit}>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." rows={3} disabled={loading} />
              <button type="submit" disabled={loading || !input.trim()}>Send</button>
            </form>
          </section>
        </>
      )}
    </main>
  )
}

export default App