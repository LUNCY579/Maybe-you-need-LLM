import { Link } from 'react-router-dom'
import { MODULES } from '../content/curriculum'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">Diffusion models, from the forward process to the guidance scale</h1>
        <p className="hero-lede">
          A teaching application built on{' '}
          <a href="https://arxiv.org/abs/2006.11239" rel="noreferrer">
            Denoising Diffusion Probabilistic Models
          </a>{' '}
          by Jonathan Ho, Ajay Jain and Pieter Abbeel. Every number this site shows is computed in front of you: change
          an input, watch the matrices, the distributions and the loss curves change with it.
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

      <Panel title="What the course covers" subtitle="Six modules, twelve lessons, six laboratories">
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
              <strong>Every lesson is sourced.</strong> Each one names the section and equation of the paper it was
              written from, and the test suite refuses a lesson that cites a section which does not exist.
            </li>
            <li>
              <strong>Nothing is faked.</strong> Where a laboratory operates on a toy model or a synthetic input, the
              interface says so, in the same place the number appears.
            </li>
            <li>
              <strong>Nothing is redistributed.</strong> No figure, dataset or trained model from the source is
              reproduced here. The denoising network in Laboratory B is trained in your browser, from scratch, every
              time you press the button.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on scale" accent="amber">
          <Callout tone="warning" title="This is a toy model">
            The denoiser in Laboratory B is a two-layer perceptron with 32 hidden units, trained for 900 steps on a
            generated ring of eight Gaussian modes. It is a real diffusion model with a real gradient and a real
            sampler — and it is not a model of images, and it produces none of the sample-quality numbers the paper
            reports.
          </Callout>
          <p className="body-text">
            The parts of the course that <em>are</em> exact are the parts that can be: the forward process, the closed
            form, the posterior, the Gaussian KL divergence, the weighting of the bound, the guided score of a
            Gaussian mixture, and the arithmetic of the compression a latent diffusion model buys. Those are the
            results the paper's argument actually rests on, and they are computed here rather than quoted.
          </p>
        </Panel>
      </div>

      <Panel title="The seven laboratories" accent="emerald">
        <div className="lab-grid">
          <Link className="lab-card" to="/labs/forward">
            <span className="lab-card-name">A · The forward process</span>
            <span className="lab-card-text">The chain, the closed form, and the posterior.</span>
          </Link>
          <Link className="lab-card" to="/labs/reverse">
            <span className="lab-card-name">B · The reverse process</span>
            <span className="lab-card-text">A real denoiser, trained in your browser.</span>
          </Link>
          <Link className="lab-card" to="/labs/schedules">
            <span className="lab-card-name">C · Noise schedules</span>
            <span className="lab-card-text">Linear against cosine, and what they do.</span>
          </Link>
          <Link className="lab-card" to="/labs/latent">
            <span className="lab-card-name">D · Latent diffusion</span>
            <span className="lab-card-text">The compression, measured.</span>
          </Link>
          <Link className="lab-card" to="/labs/guidance">
            <span className="lab-card-name">E · Guidance</span>
            <span className="lab-card-text">The fidelity–diversity trade-off, with an exact score.</span>
          </Link>
          <Link className="lab-card" to="/labs/variational">
            <span className="lab-card-name">F · The variational bound</span>
            <span className="lab-card-text">The weights, and the decomposition.</span>
          </Link>
          <Link className="lab-card" to="/labs/preconditioning">
            <span className="lab-card-name">G · Preconditioning</span>
            <span className="lab-card-text">The σ parametrisation, the coefficients, and a sampler.</span>
          </Link>
        </div>
      </Panel>

      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="diffusion-lab" />
      </Panel>
    </div>
  )
}
