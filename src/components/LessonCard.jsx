import { useEffect, useRef, useState } from 'react'

const OPTION_LABELS = ['1', '2', '3', '4']

function LessonCard({ question, questionNumber, totalQuestions, onAnswer, onAdvance }) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  if (!question) {
    return null
  }

  const handleOptionClick = (optionIndex) => {
    if (selectedIndex !== null) {
      return
    }

    const answerIsCorrect = optionIndex === question.correct

    setSelectedIndex(optionIndex)
    setIsCorrect(answerIsCorrect)
    onAnswer?.(answerIsCorrect)

    timerRef.current = window.setTimeout(() => {
      onAdvance?.()
    }, 1700)
  }

  const getClassName = (optionIndex) => {
    if (selectedIndex === null) {
      return 'lesson-option'
    }

    if (optionIndex === question.correct) {
      return 'lesson-option is-correct'
    }

    if (optionIndex === selectedIndex) {
      return 'lesson-option is-wrong'
    }

    return 'lesson-option is-muted'
  }

  const correctLabel = OPTION_LABELS[question.correct] || ''
  const correctAnswer = question.options[question.correct] || ''

  return (
    <section className="surface-card lesson-card">
      <div className="lesson-hero">
        <div className="prompt-emblem" aria-hidden="true">
          <span>🛡️</span>
        </div>

        <div>
          <p className="lesson-progress">
            Question {questionNumber} of {totalQuestions}
          </p>
          <h2 className="lesson-question">{question.question}</h2>
          <p className="lesson-support">Tap the best answer. The card will move forward automatically.</p>
        </div>
      </div>

      <div className="lesson-options" role="group" aria-label="Answer options">
        {question.options.map((option, optionIndex) => (
          <button
            key={`${question.id}-${optionIndex}-${option}`}
            type="button"
            className={getClassName(optionIndex)}
            onClick={() => handleOptionClick(optionIndex)}
            disabled={selectedIndex !== null}
          >
            <span className="option-prefix">{OPTION_LABELS[optionIndex]}</span>
            <span className="option-copy">
              <span className="option-title">{option}</span>
              <span className="option-subtitle">Choose this answer</span>
            </span>
          </button>
        ))}
      </div>

      {selectedIndex !== null ? (
        <div className={`lesson-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
          <p className="feedback-title">{isCorrect ? 'Correct. Nice work.' : 'Not quite.'}</p>
          {!isCorrect ? (
            <p className="feedback-line">
              Best answer: {correctLabel} - {correctAnswer}
            </p>
          ) : null}
          <p className="feedback-line">{question.explanation}</p>
        </div>
      ) : null}
    </section>
  )
}

export default LessonCard
