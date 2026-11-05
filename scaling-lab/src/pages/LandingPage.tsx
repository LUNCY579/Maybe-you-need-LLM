import { Link } from 'react-router-dom'
import { LESSONS, MODULES } from '../content/curriculum'
import { LABS } from '../content/labs'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">How the loss falls, and what follows from it</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="https://arxiv.org/abs/2001.08361" rel="noreferrer">
            Scaling Laws for Neural Language Models
          </a>
          , the compute-optimal allocation of{' '}
          <a href="https://arxiv.org/abs/2203.15556" rel="noreferrer">
            Hoffmann et al.
          </a>
          , the data-constrained regime of{' '}
          <a href="https://arxiv.org/abs/2305.16264" rel="noreferrer">
            Muennighoff et al.
          </a>{' '}
          and the argument about emergent abilities by{' '}
          <a href="https://arxiv.org/abs/2304.15004" rel="noreferrer">
            Schaeffer et al.
          </a>
          . Every number this site shows is computed in front of you: the training runs happen here, the laws are fitted
          here, and the cliffs are produced here.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/lessons">
            Start the course
          </Link>
          <Link className="btn btn-default" to="/labs">
            Open the laboratories
          </Link>
        </div>
      </section>

      <Panel
        title="What the course covers"
        subtitle={`${MODULES.length} modules, ${LESSONS.length} lessons, ${LABS.length} laboratories`}
      >
        <div className="module-grid">
          {MODULES.map((module) => (
            <Link key={module.id} className="module-card" to={`/modules/${module.id}`}>
              <span className="module-card-index">{module.title}</span>
              <span className="module-card-tagline">{module.tagline}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="two-column">
        <Panel title="The rule this course follows" accent="teal">
          <ul className="bullet-list">
            <li>
              <strong>Every number is computed.</strong> The scaling task, the ridge estimator, the power-law and
              loss-surface fits, the compute-optimum search and the emergence curves are all original
              implementations in pure TypeScript, unit-tested without a browser.
            </li>
            <li>
              <strong>Every training run is real.</strong> The points on the charts are losses of models that were
              fitted on data that was drawn, and measured on data they had never seen.
            </li>
            <li>
              <strong>Nothing is downloaded.</strong> No model, no dataset, no checkpoint. Every run in every
              laboratory happens in your browser, from scratch.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on the setting" accent="amber">
          <Callout tone="warning" title="A spectral task, not a transformer">
            The models here are ridge estimators on a synthetic task with a decaying spectrum. It is not a language
            model, and its exponents are not the language model's exponents.
          </Callout>
          <p className="body-text">
            It is a measuring instrument. The <em>method</em> — fit in log–log space, fit the two-variable surface,
            balance the terms under a budget, and check whether the cliff is in the model or in the metric — is exactly
            the method the papers use, and here every step of it is one you can watch, change, and check against a
            value you can compute.
          </p>
        </Panel>
      </div>

      <Panel
        title="The laboratories"
        subtitle={`${LABS.length} screens, each one a number the course claims, computed in front of you`}
        accent="emerald"
      >
        <div className="lab-grid">
          {LABS.map((lab) => (
            <Link key={lab.id} className="lab-card" to={`/labs/${lab.id}`}>
              <span className="lab-card-name">{lab.name}</span>
              <span className="lab-card-text">{lab.blurb}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="scaling-lab" />
      </Panel>
    </div>
  )
}
