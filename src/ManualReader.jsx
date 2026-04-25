import { useMemo, useRef, useState } from 'react'
import { BookOpen, Play } from 'lucide-react'

const CHAPTER_BREAK_TARGET = 2200

function normalizeManualToChapters(rawText) {
  if (!rawText) {
    return []
  }

  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const chapters = []
  let runningText = []
  let runningSize = 0
  let chapterNumber = 1

  paragraphs.forEach((paragraph) => {
    const shouldStartNext = runningSize > CHAPTER_BREAK_TARGET && paragraph.length < 90
    if (shouldStartNext && runningText.length > 0) {
      chapters.push({
        id: chapterNumber,
        title: `Chapter ${chapterNumber}`,
        text: runningText.join('\n\n'),
      })
      chapterNumber += 1
      runningText = []
      runningSize = 0
    }
    runningText.push(paragraph)
    runningSize += paragraph.length
  })

  if (runningText.length > 0) {
    chapters.push({
      id: chapterNumber,
      title: `Chapter ${chapterNumber}`,
      text: runningText.join('\n\n'),
    })
  }

  return chapters
}

const ManualReader = ({ content, apiUrl, currentLanguage }) => {
  const [selectedChapter, setSelectedChapter] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [readerError, setReaderError] = useState('')
  const audioRef = useRef(null)
  const scrollRef = useRef(null)

  const chapters = useMemo(() => normalizeManualToChapters(content[currentLanguage] || ''), [content, currentLanguage])
  const currentChapter = chapters[selectedChapter]

  const handleScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target
    const maxScroll = Math.max(scrollHeight - clientHeight, 1)
    const scrolled = Math.min((scrollTop / maxScroll) * 100, 100)
    setProgress(scrolled)
  }

  const playChapter = async () => {
    if (!currentChapter || !apiUrl) {
      setReaderError('Audio endpoint is not configured yet.')
      return
    }

    setReaderError('')
    setIsPlaying(true)

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tts',
          text: currentChapter.text,
          language: currentLanguage,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to generate audio')
      }
      if (!payload.body) {
        throw new Error('Missing audio data from Polly')
      }

      const audioSrc = `data:audio/mpeg;base64,${payload.body}`
      audioRef.current.src = audioSrc
      await audioRef.current.play()
    } catch (error) {
      setReaderError(error.message || 'Audio playback failed')
      setIsPlaying(false)
    }
  }

  return (
    <section className="reader-shell">
      <aside className="reader-sidebar">
        <h3 className="reader-title">
          <BookOpen size={18} /> Chapters
        </h3>
        <div className="reader-chapter-list">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => {
                setSelectedChapter(index)
                setProgress(0)
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={`reader-chapter-button ${selectedChapter === index ? 'active' : ''}`}
            >
              {chapter.title}
            </button>
          ))}
        </div>
      </aside>

      <main className="reader-content">
        <div className="reader-progress-track">
          <div className="reader-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <article ref={scrollRef} onScroll={handleScroll} className="reader-scroll-area">
          <header className="reader-header">
            <h2>{currentChapter?.title || 'No chapter available'}</h2>
            <button type="button" onClick={playChapter} disabled={isPlaying || !currentChapter} className="reader-play-button">
              <Play size={16} /> {isPlaying ? 'Reading...' : 'Play'}
            </button>
          </header>

          {readerError ? <p className="error">{readerError}</p> : null}
          <p className="reader-progress-label">{Math.round(progress)}% read</p>
          <div className="reader-text">{currentChapter?.text || 'No text found for this language.'}</div>
        </article>
      </main>

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} hidden />
    </section>
  )
}

export default ManualReader