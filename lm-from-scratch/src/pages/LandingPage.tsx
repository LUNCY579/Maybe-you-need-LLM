import { Link } from 'react-router-dom'
import { MODULES } from '../content/curriculum'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">A language model, from the tokeniser to the bill</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="https://cs336.stanford.edu/" rel="noreferrer">
            CS336: Language Modeling from Scratch
          </a>
          . Every number this site shows is computed in front of you: train the tokeniser, count the parameters, price the
          training step, and run the model.
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

      <Panel title="What the course covers" subtitle="Six modules, eleven lessons, six laboratories">
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
              <strong>Every number is computed.</strong> The algorithms live in pure functions with no DOM and no
              framework, they are unit-tested without a browser, and the interface renders what those functions return.
            </li>
            <li>
              <strong>Every gradient is checked.</strong> The automatic differentiation engine in Laboratory E is
              verified against a central finite difference on every parameter of a real transformer — and that check is
              what caught the bugs in it.
            </li>
            <li>
              <strong>Every lesson is sourced.</strong> Each one names the lecture or the paper section it was written
              from, and the test suite refuses a lesson that cites a lecture which does not exist.
            </li>
            <li>
              <strong>Nothing is downloaded.</strong> The tokeniser and the transformer are built and trained in your
              browser, every time you press the button. There is no checkpoint anywhere in this project.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on scale" accent="amber">
          <Callout tone="warning" title="A toy model on a toy corpus">
            The transformer in Laboratory E has a few thousand parameters and trains on a generated corpus of a few
            thousand tokens. It learns something real — the loss falls, the perplexity falls, and the loss curve has the
            shape a training curve has.
          </Callout>
          <p className="body-text">
            It is not a language model in any sense the field would recognise. What transfers is the
            <em>arithmetic</em>: the parameter counts, the FLOPs, the memory, the roofline position and the scaling
            frontier are all computed from the same formulas the real runs use, at the real shapes. The architecture and
            the accounting are the course; the size is a limitation, and it is labelled.
          </p>
        </Panel>
      </div>

      <Panel title="The six laboratories" accent="emerald">
        <div className="lab-grid">
          <Link className="lab-card" to="/labs/tokenizer">
            <span className="lab-card-name">A · The tokeniser</span>
            <span className="lab-card-text">The merges, and the bytes per token.</span>
          </Link>
          <Link className="lab-card" to="/labs/architecture">
            <span className="lab-card-name">B · The architecture</span>
            <span className="lab-card-text">The parameter budget, broken down.</span>
          </Link>
          <Link className="lab-card" to="/labs/accounting">
            <span className="lab-card-name">C · Resource accounting</span>
            <span className="lab-card-text">The FLOPs, the memory, and the roofline.</span>
          </Link>
          <Link className="lab-card" to="/labs/data">
            <span className="lab-card-name">D · The data pipeline</span>
            <span className="lab-card-text">What the filtering costs.</span>
          </Link>
          <Link className="lab-card" to="/labs/training">
            <span className="lab-card-name">E · The training loop</span>
            <span className="lab-card-text">A real transformer, trained here.</span>
          </Link>
          <Link className="lab-card" to="/labs/scaling">
            <span className="lab-card-name">F · The scaling frontier</span>
            <span className="lab-card-text">The IsoFLOP picture.</span>
          </Link>
        </div>
      </Panel>

      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="lm-from-scratch" />
      </Panel>
    </div>
  )
}
