import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from '@llm-materials/course-core'
import { LESSONS, MODULES, lessonsOfModule } from '../content/curriculum'
import { QUIZ } from '../content/quiz'
import { useProgress } from '@llm-materials/course-ui'
import { Button, Panel, Stat } from '@llm-materials/course-ui'

export function DashboardPage() {
  const { summary, record, reset, exportJson, importJson } = useProgress()
  const [message, setMessage] = useState('')

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mech-interp-lab-progress.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const upload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const ok = importJson(String(reader.result))
      setMessage(ok ? 'Progress imported.' : 'That file is not a progress export.')
    }
    reader.readAsText(file)
  }

  const quizTotal = QUIZ.length
  const perModule = MODULES.map((module) => {
    const lessons = lessonsOfModule(module.id)
    const complete = lessons.filter((lesson) => record.lessons[lesson.id]?.complete).length
    const seconds = lessons.reduce((acc, lesson) => acc + (record.lessons[lesson.id]?.seconds ?? 0), 0)
    return { module, total: lessons.length, complete, seconds }
  })

  return (
    <div className="page">
      <h1 className="page-title">Your progress</h1>
      <p className="page-lede">
        Everything here is stored in this browser, and nothing leaves it. You can export it as a file and import it
        somewhere else.
      </p>

      <div className="stat-row">
        <Stat
          label="Lessons complete"
          value={`${summary.lessonsComplete} / ${summary.lessonsTotal}`}
          tone={summary.lessonsComplete === summary.lessonsTotal && summary.lessonsTotal > 0 ? 'good' : 'default'}
        />
        <Stat
          label="Questions answered"
          value={`${summary.quizAnswered} / ${quizTotal}`}
        />
        <Stat
          label="Quiz accuracy"
          value={`${fmt(summary.quizAccuracy * 100, 1)}%`}
          hint={`${summary.quizCorrect} correct`}
        />
        <Stat label="Study time" value={`${Math.round(summary.totalSeconds / 60)} min`} />
        <Stat label="Bookmarks" value={String(summary.bookmarks.length)} />
      </div>

      <Panel title="By module">
        <div className="progress-list">
          {perModule.map((entry) => (
            <div key={entry.module.id} className="progress-row">
              <Link to={`/modules/${entry.module.id}`} className="progress-name">
                {entry.module.title}
              </Link>
              <div className="progress-bar" role="img" aria-label={`${entry.complete} of ${entry.total} lessons complete`}>
                <span style={{ width: `${entry.total === 0 ? 0 : (entry.complete / entry.total) * 100}%` }} />
              </div>
              <span className="progress-count">
                {entry.complete}/{entry.total}
              </span>
              <span className="progress-time">{Math.round(entry.seconds / 60)} min</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Your data" accent="teal">
        <p className="body-text">
          The progress record is a small JSON file: which lessons are complete, which questions were answered
          correctly, how long you spent, and what you bookmarked. Nothing else is stored.
        </p>
        <div className="button-row">
          <Button onClick={download}>Export the progress</Button>
          <label className="btn btn-default file-label">
            Import the progress
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload(file)
              }}
            />
          </label>
          <Button
            variant="danger"
            onClick={() => {
              reset()
              setMessage('Progress reset.')
            }}
          >
            Reset everything
          </Button>
        </div>
        {message ? <p className="status-message" role="status">{message}</p> : null}
      </Panel>

      <Panel title="The course at a glance" accent="amber">
        <ul className="bullet-list">
          {LESSONS.map((lesson) => (
            <li key={lesson.id}>
              <Link to={`/lessons/${lesson.id}`}>{lesson.title}</Link>
              <span className="muted"> — {lesson.minutes} minutes</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
