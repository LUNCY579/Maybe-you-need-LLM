import { Link } from 'react-router-dom'
import { MODULES } from '../content/curriculum'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">Reinforcement learning from human feedback, and where it breaks</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="https://arxiv.org/abs/2403.17031" rel="noreferrer">
            The N+ Implementation Details of RLHF with PPO
          </a>{' '}
          by Huang, Noukhovitch, Hosseini, Rasul, Wang and Tunstall. Every number this site shows is computed in front
          of you: change a clip range, a λ, a KL estimator, or a reward model’s error, and watch the objective, the
          estimate and the curve move with it.
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
              <strong>Every gradient is checked.</strong> The policy gradient in Laboratory A is compared against a
              central finite difference on every logit, to the last digit.
            </li>
            <li>
              <strong>Every lesson is sourced.</strong> Each one names the section of the paper it was written from, and
              the test suite refuses a lesson that cites a section which does not exist.
            </li>
            <li>
              <strong>Nothing is faked.</strong> Where a laboratory uses a synthetic reward model, the error in it is
              injected and known — which is what makes the overoptimisation effect exactly computable rather than
              merely described.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on the setting" accent="amber">
          <Callout tone="warning" title="A bandit, not a language model">
            The policy in these laboratories is a softmax over a handful of logits. That is not a language model, and
            the numbers it produces are not the numbers any published RLHF system produces.
          </Callout>
          <p className="body-text">
            It is a deliberate choice. The point of the course is the <em>mechanism</em> — the clip, the advantage
            estimate, the KL estimator, the reward model’s error — and a mechanism is best studied on a problem small
            enough that every gradient, every probability and every divergence can be computed exactly and checked by
            hand. The equations are the paper’s; the setting is the course’s, and the interface says which is which.
          </p>
        </Panel>
      </div>

      <Panel title="The six laboratories" accent="emerald">
        <div className="lab-grid">
          <Link className="lab-card" to="/labs/gradient">
            <span className="lab-card-name">A · The policy gradient</span>
            <span className="lab-card-text">The objective, the estimator, and the trust region.</span>
          </Link>
          <Link className="lab-card" to="/labs/ppo">
            <span className="lab-card-name">B · The clipped objective</span>
            <span className="lab-card-text">Where the clip bites, and what it does to the gradient.</span>
          </Link>
          <Link className="lab-card" to="/labs/gae">
            <span className="lab-card-name">C · Advantages and GAE</span>
            <span className="lab-card-text">The credit assignment, and the dial on its shape.</span>
          </Link>
          <Link className="lab-card" to="/labs/kl">
            <span className="lab-card-name">D · The KL penalty</span>
            <span className="lab-card-text">Three estimators, and what each is unbiased for.</span>
          </Link>
          <Link className="lab-card" to="/labs/pipeline">
            <span className="lab-card-name">E · The pipeline</span>
            <span className="lab-card-text">Three stages, three failure modes, and the checklist.</span>
          </Link>
          <Link className="lab-card" to="/labs/overoptimisation">
            <span className="lab-card-name">F · Reward overoptimisation</span>
            <span className="lab-card-text">The curve, the fits, and where to stop.</span>
          </Link>
        </div>
      </Panel>

      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="rlhf-lab" />
      </Panel>
    </div>
  )
}
