import { Link, useParams } from 'react-router-dom'
import { LESSONS, MODULES, moduleById, lessonsOfModule } from '../content/curriculum'
import { Panel, Stat } from '@llm-materials/course-ui'

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const module = moduleId ? moduleById(moduleId) : undefined

  if (!module) {
    return (
      <div className="page">
        <h1 className="page-title">No such module</h1>
        <p className="page-lede">
          <Link to="/lessons">Back to the lessons</Link>.
        </p>
      </div>
    )
  }

  const lessons = lessonsOfModule(module.id)

  return (
    <div className="page">
      <p className="eyebrow">Module {module.chapter}</p>
      <h1 className="page-title">{module.title}</h1>
      <p className="page-lede">{module.tagline}</p>

      <Panel title="What this module is about" accent={module.accent}>
        <p className="body-text">{module.summary}</p>
        <h2 className="section-heading">By the end you should be able to</h2>
        <ul className="bullet-list">
          {module.outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="The lessons">
        <ol className="lesson-list">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link to={`/lessons/${lesson.id}`} className="lesson-link">
                <span className="lesson-number">{lesson.number}</span>
                <span className="lesson-body">
                  <span className="lesson-title">{lesson.title}</span>
                  <span className="lesson-subtitle">{lesson.subtitle}</span>
                </span>
                <span className="lesson-minutes">{lesson.minutes} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="All modules" accent="amber">
        <div className="module-grid">
          {MODULES.map((entry) => (
            <Link
              key={entry.id}
              className={entry.id === module.id ? 'module-card module-card-active' : 'module-card'}
              to={`/modules/${entry.id}`}
            >
              <span className="module-card-index">{entry.title}</span>
              <span className="module-card-tagline">{entry.tagline}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="stat-row">
        <Stat label="Lessons in this module" value={String(lessons.length)} />
        <Stat
          label="Total study time"
          value={`${lessons.reduce((acc, lesson) => acc + lesson.minutes, 0)} min`}
        />
        <Stat label="Lessons in the course" value={String(LESSONS.length)} />
      </div>
    </div>
  )
}
