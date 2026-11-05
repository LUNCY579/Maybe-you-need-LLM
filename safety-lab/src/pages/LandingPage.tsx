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
        <h1 className="hero-title">What a safety claim is worth</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="https://arxiv.org/abs/2212.08073" rel="noreferrer">
            Constitutional AI
          </a>
          , the helpful and harmless dataset of{' '}
          <a href="https://arxiv.org/abs/2204.05862" rel="noreferrer">
            Askell et al.
          </a>
          , the model-driven red team of{' '}
          <a href="https://arxiv.org/abs/2202.03286" rel="noreferrer">
            Perez et al.
          </a>
          , the cued behaviour of{' '}
          <a href="https://arxiv.org/abs/2401.05566" rel="noreferrer">
            Hubinger et al.
          </a>
          , the sycophancy measurements of{' '}
          <a href="https://arxiv.org/abs/2310.13548" rel="noreferrer">
            Shirzad et al.
          </a>{' '}
          and the extraction attack of{' '}
          <a href="https://arxiv.org/abs/2012.07805" rel="noreferrer">
            Carlini et al.
          </a>
          . Every number this site shows is computed in front of you.
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
              <strong>Every number is computed.</strong> The critique loop, the two rounds, the red team, the cued
              corpus, the labeler’s consistency, the flip rate and the extraction and membership attacks are all
              original implementations in pure TypeScript, unit-tested without a browser.
            </li>
            <li>
              <strong>Every claim is measured.</strong> The harmlessness score, the coverage of a red team, the
              agreement of a judge, the exposure of a training set and the power of a membership attack are all
              computed here, with their intervals and their rates.
            </li>
            <li>
              <strong>Nothing is downloaded.</strong> No model, no dataset, no example. Every "model" here is a rule
              over a generated task, run in your browser.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on the setting" accent="amber">
          <Callout tone="warning" title="Rules, not models">
            The exchanges, the attacks, the questions and the training records are generated, and the "model" that
            answers them is a rule. Nothing here measures a language model.
          </Callout>
          <p className="body-text">
            What transfers is the <em>measurement</em>: the agreement of a judge with the labels, the coverage of a red
            team, the gap between the harm a classifier was told about and the harm that is there, the flip rate under
            pressure, and the exposure of a training set. Each of those is a number a safety paper should report and
            most do not, and each of them is a number a reader can insist on.
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
        <CollectionLinks manifest={CATALOGUE} currentAppId="safety-lab" />
      </Panel>
    </div>
  )
}
