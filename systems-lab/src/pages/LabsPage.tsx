import { Link, useParams } from 'react-router-dom'
import { ErrorBoundary } from '@llm-materials/course-ui'
import { LABS, labById } from '../content/labs'
import { LAB_SCREENS } from '../components/lab'

export function LabsPage() {
  const { labId } = useParams<{ labId: string }>()

  if (!labId) {
    return (
      <div className="page">
        <h1 className="page-title">The laboratories</h1>
        <p className="page-lede">
          Six screens, each running a real algorithm over data generated in front of you: the matrix attention never
          builds, the cache a decode step reads, the router that spends a sparse layer's capacity, the grid that
          quantisation chooses and the outlier that chooses it for you, the proposals a draft makes and the target
          checks, and the bytes a fine-tune needs term by term. Every number is computed when you look at it, and every
          random draw comes from a seeded stream.
        </p>
        <div className="lab-grid">
          {LABS.map((lab) => (
            <Link key={lab.id} className="lab-card" to={`/labs/${lab.id}`}>
              <span className="lab-card-name">{lab.name}</span>
              <span className="lab-card-text">{lab.blurb}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const lab = labById(labId)
  const Screen = lab ? LAB_SCREENS[lab.id] : undefined

  return (
    <div className="page">
      <nav className="lab-tabs" aria-label="Laboratories">
        {LABS.map((entry) => (
          <Link
            key={entry.id}
            to={`/labs/${entry.id}`}
            className={entry.id === labId ? 'lab-tab lab-tab-active' : 'lab-tab'}
            aria-current={entry.id === labId ? 'page' : undefined}
          >
            {entry.name}
          </Link>
        ))}
      </nav>
      {Screen ? (
        <ErrorBoundary>
          <Screen />
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
