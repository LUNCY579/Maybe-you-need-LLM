import { Link } from 'react-router-dom'
import { MODULES } from '../content/curriculum'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">Where the time and the memory actually go</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="https://arxiv.org/abs/2205.14135" rel="noreferrer">
            FlashAttention
          </a>
          , the paged allocator of{' '}
          <a href="https://arxiv.org/abs/2309.06180" rel="noreferrer">
            Kwon et al.
          </a>
          , the sparse layers of{' '}
          <a href="https://arxiv.org/abs/2006.16668" rel="noreferrer">
            GShard
          </a>{' '}
          and the verification of{' '}
          <a href="https://arxiv.org/abs/2305.09781" rel="noreferrer">
            SpecInfer
          </a>
          . Every number this site shows is computed in front of you: the attention is run here, the memory is accounted
          for here, the router is balanced here, and the acceptance is measured here.
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

      <Panel title="What the course covers" subtitle="Four modules, eight lessons, four laboratories">
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
              <strong>Every number is computed.</strong> The attention, the memory accounting, the allocator, the
              router and the verification are all original implementations in pure TypeScript, unit-tested without a
              browser.
            </li>
            <li>
              <strong>Every answer is checked.</strong> The tiled attention is compared against the naive one
              component by component, and the output of the speculative procedure is compared against the target's own
              distribution.
            </li>
            <li>
              <strong>Nothing is downloaded.</strong> No model, no dataset, no checkpoint. Every algorithm is run in
              your browser, from scratch.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on the setting" accent="amber">
          <Callout tone="warning" title="A model shape, not a model">
            The laboratories use a shape — layers, heads, a width, a parameter count — and they account for what a
            program of that shape would cost. They do not run a transformer.
          </Callout>
          <p className="body-text">
            The accounting is the part that transfers. The memory a score matrix takes, the traffic it causes, the
            intensity of a decode step, the waste of an allocator, the imbalance a router creates, and the acceptance
            rate of a draft model are all quantities that do not care what the weights are — and the course computes
            each of them, so that the arguments in the papers can be checked rather than taken on trust.
          </p>
        </Panel>
      </div>

      <Panel title="The four laboratories" accent="emerald">
        <div className="lab-grid">
          <Link className="lab-card" to="/labs/attention">
            <span className="lab-card-name">A · Attention memory</span>
            <span className="lab-card-text">The matrix you never build.</span>
          </Link>
          <Link className="lab-card" to="/labs/kvcache">
            <span className="lab-card-name">B · The KV cache</span>
            <span className="lab-card-text">Why decoding is a memory problem.</span>
          </Link>
          <Link className="lab-card" to="/labs/moe">
            <span className="lab-card-name">C · Sparse capacity</span>
            <span className="lab-card-text">More experts, fewer used.</span>
          </Link>
          <Link className="lab-card" to="/labs/speculative">
            <span className="lab-card-name">D · Speculation</span>
            <span className="lab-card-text">Propose cheaply, check exactly.</span>
          </Link>
        </div>
      </Panel>

      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="systems-lab" />
      </Panel>
    </div>
  )
}
