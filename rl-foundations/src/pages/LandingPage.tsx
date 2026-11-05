import { Link } from 'react-router-dom'
import { MODULES } from '../content/curriculum'
import { LABS } from '../content/labs'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">What an agent is trying to do</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="http://incompleteideas.net/book/the-book-2nd.html" rel="noreferrer">
            Reinforcement Learning: An Introduction
          </a>{' '}
          by Sutton and Barto, on the derivations of{' '}
          <a href="https://spinningup.openai.com/" rel="noreferrer">
            Spinning Up in Deep RL
          </a>{' '}
          and on the bootstrap estimator of Williams and Burges. Every number this site shows is computed in front of
          you: the values are swept here, the gradient is estimated here, and the loop is run here — against answers
          that are computed exactly.
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
              <strong>Every number is computed.</strong> The gridworld, its transition kernel, the value function, the
              gradient estimator and the actor–critic loop are all original implementations in pure TypeScript,
              unit-tested without a browser.
            </li>
            <li>
              <strong>Every answer is checked.</strong> The value iteration is checked against the Bellman equation it
              is supposed to satisfy; the policy evaluation is solved as a linear system and compared with the
              iteration; the gradient estimated from samples is compared with a central difference of the exact return;
              and the bias and the variance of the λ-return are measured over thousands of episodes rather than quoted.
            </li>
            <li>
              <strong>Nothing is downloaded.</strong> No model, no dataset, no checkpoint. A four-by-four grid and a
              table of logits, run in your browser, from scratch.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on the setting" accent="amber">
          <Callout tone="warning" title="Tabular, and therefore tractable">
            The laboratories run on a sixteen-cell gridworld and a four-armed bandit, and the policy is a table of
            logits. There is no function approximation anywhere: nothing is generalising from states it has not
            visited, and no network is being trained. That is what makes the exact answers possible — and it is why
            the convergence you can watch here is not a promise about a neural one.
          </Callout>
          <p className="body-text">
            What transfers is the estimator, not the guarantee. The score function, the baseline, the reward-to-go
            weighting and the advantage are the same objects in the deep case, and the same three complaints apply
            there: the variance of a single trajectory, the bias a bad critic injects into the advantage, and the
            dependence of the whole procedure on how far the policy has moved from the data. What does not transfer is
            the exactness: here the reference answer is a linear solve, and there it is whatever the network happens to
            believe. The bandit&apos;s four rewards, and the shape of the grid, are chosen to make the points above
            visible rather than measured from anything.
          </p>
        </Panel>
      </div>

      <Panel title="The four laboratories" accent="emerald">
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
        <CollectionLinks manifest={CATALOGUE} currentAppId="rl-foundations" />
      </Panel>
    </div>
  )
}
