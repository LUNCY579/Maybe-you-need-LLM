import { Link, useParams } from 'react-router-dom'
import { ErrorBoundary } from '@llm-materials/course-ui'
import { labById } from '../content/labs'
import { LAB_GALLERY, labScreen } from '../components/lab'

export function LabsPage() {
  const { labId } = useParams<{ labId: string }>()

  if (!labId) {
    return (
      <div className="page">
        <h1 className="page-title">The laboratories</h1>
        <p className="page-lede">
          Eight screens, each running a real algorithm over a corpus generated in front of you. Every number is
          computed when you look at it, and every random draw comes from a seeded stream. The letter a card carries
          is the letter the screen prints in its own title bar.
        </p>
        <div className="lab-grid">
          {LAB_GALLERY.map((lab) => (
            <Link key={lab.id} className="lab-card" to={`/labs/${lab.id}`}>
              <span className="lab-card-name">{lab.name}</span>
              <span className="lab-card-text">{lab.blurb}</span>
              <span className="lab-card-text">{lab.delivers.length} declared item{lab.delivers.length === 1 ? '' : 's'}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const definition = labById(labId)
  const Screen = labScreen(labId)

  return (
    <div className="page">
      <nav className="lab-tabs" aria-label="Laboratories">
        {LAB_GALLERY.map((lab) => (
          <Link
            key={lab.id}
            to={`/labs/${lab.id}`}
            className={lab.id === labId ? 'lab-tab lab-tab-active' : 'lab-tab'}
            aria-current={lab.id === labId ? 'page' : undefined}
          >
            {lab.name}
          </Link>
        ))}
      </nav>
      {Screen ? (
        <ErrorBoundary>
          <Screen />
          {definition ? (
            <p className="page-lede">
              This screen is the implementation of{' '}
              {definition.delivers.map((item, index) => (
                <span key={item}>
                  {index > 0 ? ', and ' : ''}"{item}"
                </span>
              ))}{' '}
              in the manifest entry <code>{definition.source}</code>.
            </p>
          ) : null}
        </ErrorBoundary>
      ) : (
        <div className="page">
          <h1 className="page-title">No such laboratory</h1>
          <p className="page-lede">
            <Link to="/labs">Back to the laboratories</Link>.
          </p>
        </div>
      )}
    </div>
  )
}
