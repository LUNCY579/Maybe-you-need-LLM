import { Link } from 'react-router-dom'
import { MODULES } from '../content/curriculum'
import { Callout, Panel } from '@llm-materials/course-ui'
import { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'

export function LandingPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="hero-eyebrow">An interactive course</p>
        <h1 className="hero-title">Finding the document that answers the question</h1>
        <p className="hero-lede">
          A teaching application built on the retrieval pipeline of{' '}
          <a href="https://arxiv.org/abs/2005.11401" rel="noreferrer">
            Lewis et al.
          </a>
          , the dense retriever of{' '}
          <a href="https://arxiv.org/abs/2004.04906" rel="noreferrer">
            Karpukhin et al.
          </a>
          , the late interaction of{' '}
          <a href="https://arxiv.org/abs/2004.12832" rel="noreferrer">
            Khattab et al.
          </a>{' '}
          and the position effect of{' '}
          <a href="https://arxiv.org/abs/2307.03172" rel="noreferrer">
            Liu et al.
          </a>
          . Every number this site shows is computed in front of you: the index is built here, the retriever is trained
          here, the evidence is placed here, and the position effect is measured here.
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
              <strong>Every number is computed.</strong> The index, BM25, the contrastive training and the MaxSim
              score are all original implementations in pure TypeScript, unit-tested without a browser.
            </li>
            <li>
              <strong>Every gradient is checked.</strong> The contrastive objective is differentiated by the shared
              automatic-differentiation engine, and the test suite compares the result against a central finite
              difference.
            </li>
            <li>
              <strong>Every answer is known.</strong> The corpus is generated here, and each question has exactly one
              correct document — so the recall of a retriever is a measurement and not an opinion.
            </li>
          </ul>
        </Panel>

        <Panel title="An honest note on the setting" accent="amber">
          <Callout tone="warning" title="A synthetic corpus, built to make the point">
            The corpus is generated so that the questions and the answers use different words, which is the case the
            course is about. It is not a crawl, and the recall numbers here are not a leaderboard.
          </Callout>
          <p className="body-text">
            What transfers is the <em>method</em>: build the index, fit the score, measure the recall against a known
            answer, and compare the two retrievers on the same questions. The laboratory does each of those, and the
            numbers it produces are the numbers its own corpus produces.
          </p>
        </Panel>
      </div>

      <Panel title="The four laboratories" accent="emerald">
        <div className="lab-grid">
          <Link className="lab-card" to="/labs/sparse">
            <span className="lab-card-name">A · The sparse index</span>
            <span className="lab-card-text">Matching the words, exactly.</span>
          </Link>
          <Link className="lab-card" to="/labs/dense">
            <span className="lab-card-name">B · The dense retriever</span>
            <span className="lab-card-text">Matching the meaning, approximately.</span>
          </Link>
          <Link className="lab-card" to="/labs/late">
            <span className="lab-card-name">C · The late interaction</span>
            <span className="lab-card-text">Word by word, and the index it costs.</span>
          </Link>
          <Link className="lab-card" to="/labs/context">
            <span className="lab-card-name">D · The long context</span>
            <span className="lab-card-text">Where the evidence is put, and whether it is used.</span>
          </Link>
        </div>
      </Panel>

      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="retrieval-lab" />
      </Panel>
    </div>
  )
}
