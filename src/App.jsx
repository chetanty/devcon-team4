import { useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? ''

function getChatEndpoint(apiUrl) {
  if (!apiUrl) {
    return ''
  }

  if (apiUrl.endsWith('/chat')) {
    return apiUrl
  }

  return `${apiUrl.replace(/\/+$/, '')}/chat`
}

function App() {
  const [topic, setTopic] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState('')

  const endpoint = useMemo(() => getChatEndpoint(API_URL), [])

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
          mode,
          topic: cleanTopic,
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

  return (
    <main className="app-shell">
      <section className="card">
        <h1>GuardBuddy AI</h1>
        <p className="subtitle">Multilingual AI tutor for Alberta Security Training</p>

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
          <button type="button" onClick={() => runMode('explain')} disabled={loading}>
            {loading && activeMode === 'explain' ? 'Explaining...' : 'Explain'}
          </button>
          <button type="button" onClick={() => runMode('quiz')} disabled={loading}>
            {loading && activeMode === 'quiz' ? 'Building Quiz...' : 'Quiz Me'}
          </button>
          <button type="button" onClick={() => runMode('scenario')} disabled={loading}>
            {loading && activeMode === 'scenario' ? 'Creating Scenario...' : 'Scenario Practice'}
          </button>
        </div>

        {loading ? <p className="status">GuardBuddy is generating your response...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {answer ? (
          <article className="output-card">
            <h2>AI Response</h2>
            <pre>{answer}</pre>
          </article>
        ) : null}
      </section>
    </main>
  )
}

export default App
