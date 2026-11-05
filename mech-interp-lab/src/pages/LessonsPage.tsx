import { Link } from 'react-router-dom'
import { LESSONS, MODULES, lessonsOfModule } from '../content/curriculum'
import { useProgress } from '@llm-materials/course-ui'
import { Panel, Stat } from '@llm-materials/course-ui'

export function LessonsPage() {
  const { record } = useProgress()

  return (
    <div className="page">
      <h1 className="page-title">The lessons</h1>
      <p className="page-lede">
        {LESSONS.length} lessons in {MODULES.length} modules. Each one names the section of the paper it was written
        from, and each one ends at a laboratory where you can watch the mathematics happen.
      </p>

      <div className="stat-row">
        <Stat label="Modules" value={String(MODULES.length)} />
        <Stat label="Lessons" value={String(LESSONS.length)} />
        <Stat
          label="Total reading time"
          value={`${LESSONS.reduce((acc, lesson) => acc + lesson.minutes, 0)} min`}
        />
      </div>

      {MODULES.map((module) => {
        const lessons = lessonsOfModule(module.id)
        const complete = lessons.filter((lesson) => record.lessons[lesson.id]?.complete).length
        return (
          <Panel key={module.id} title={module.title} subtitle={module.tagline} accent={module.accent}>
            <p className="body-text">{module.summary}</p>
            <ol className="lesson-list">
              {lessons.map((lesson) => {
                const done = record.lessons[lesson.id]?.complete
                return (
                  <li key={lesson.id}>
                    <Link to={`/lessons/${lesson.id}`} className="lesson-link">
                      <span className={done ? 'lesson-number lesson-number-done' : 'lesson-number'}>
                        {done ? '✓' : lesson.number}
                      </span>
                      <span className="lesson-body">
                        <span className="lesson-title">{lesson.title}</span>
                        <span className="lesson-subtitle">{lesson.subtitle}</span>
                      </span>
                      <span className="lesson-minutes">{lesson.minutes} min</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
            <p className="muted">
              {complete} of {lessons.length} complete ·{' '}
              <Link to={`/modules/${module.id}`}>the module in full</Link>
            </p>
          </Panel>
        )
      })}
    </div>
  )
}
