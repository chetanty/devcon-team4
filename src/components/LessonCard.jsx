import { useEffect, useRef, useState } from 'react'

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function LessonCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onAdvance,
}) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    setSelectedIndex(null)
    setIsCorrect(false)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [question?.id])

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

    if (onAnswer) {
      onAnswer(answerIsCorrect)
    }

    timerRef.current = window.setTimeout(() => {
      if (onAdvance) {
        onAdvance()
      }
    }, 1500)
  }

  const getButtonClassName = (optionIndex) => {
    if (selectedIndex === null) {
      return 'lesson-option'
    }

    if (optionIndex === question.correct) {
      return `lesson-option is-correct ${selectedIndex === optionIndex ? 'flash-green' : ''}`
    }

    if (optionIndex === selectedIndex) {
      return 'lesson-option is-wrong flash-red'
    }

    return 'lesson-option is-disabled'
  }

  const correctLabel = OPTION_LABELS[question.correct] || ''
  const correctText = question.options?.[question.correct] || ''

  return (
    <section className="lesson-card">
      <p className="lesson-progress">
        Question {questionNumber} of {totalQuestions}
      </p>

      <h2 className="lesson-question">{question.question}</h2>

      <div className="lesson-options" role="group" aria-label="Answer options">
        {question.options.map((option, optionIndex) => (
          <button
            key={`${question.id}-${optionIndex}-${option}`}
            type="button"
            className={getButtonClassName(optionIndex)}
            onClick={() => handleOptionClick(optionIndex)}
            disabled={selectedIndex !== null}
          >
            <span className="option-prefix">{OPTION_LABELS[optionIndex]})</span>
            <span>{option}</span>
          </button>
        ))}
      </div>

      {selectedIndex !== null ? (
        <div className={`lesson-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
          <p className="feedback-title">{isCorrect ? 'Correct! +10 XP' : 'Incorrect answer.'}</p>
          {!isCorrect ? (
            <p className="feedback-line">
              Correct answer: {correctLabel}) {correctText}
            </p>
          ) : null}
          <p className="feedback-line">{question.explanation}</p>
        </div>
      ) : null}
    </section>
  )
}

export default LessonCard
