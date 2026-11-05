import { Link, useParams } from 'react-router-dom'
import { ErrorBoundary } from '@llm-materials/course-ui'
import { LABS } from '../content/labs'
import { LAB_SCREENS } from '../components/lab/screens'

export function LabsPage() {
  const { labId } = useParams<{ labId: string }>()

  if (!labId) {
    return (
      <div className="page">
        <h1 className="page-title">The laboratories</h1>
        <p className="page-lede">
          Five screens, each training a model here and measuring something about it: the loss and its temperature,
          the retrieval, the gap between the modalities, the zero-shot classifier, what the instruction tuning costs
          and the projection it is trained through, what the sigmoid loss changes about all of it, what a frozen
          bridge does and does not train, and how a resampler bounds the visual token count.
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

  const Screen = LAB_SCREENS[labId]

  return (
    <div className="page">
      <nav className="lab-tabs" aria-label="Laboratories">
        {LABS.map((lab) => (
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
      <ErrorBoundary>
        {Screen ? <Screen /> : null}
        {!Screen ? (
          <div className="page">
            <h1 className="page-title">No such laboratory</h1>
            <p className="page-lede">
              <Link to="/labs">Back to the laboratories</Link>.
            </p>
          </div>
        ) : null}
      </ErrorBoundary>
    </div>
  )
}
