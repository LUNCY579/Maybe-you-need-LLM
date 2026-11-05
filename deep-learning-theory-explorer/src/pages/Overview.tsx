import { Link } from 'react-router-dom';
import { Panel, Callout, Stat, Table, Badge } from '../components/ui';
import { Rich, Tex } from '../components/Math';
import { SOURCE } from '../content/references';
import { LESSONS } from '../content/lessons';
import { EXPERIMENTS } from '../content/experiments';
import { QUIZ } from '../content/quizzes';
import { LABS } from '../content/labs';
import { StartHere } from '../components/StartHere';
import { CollectionPanel } from '../components/CollectionPanel';

/**
 * Course overview: what this app is, what it computes, and where it stops.
 * The limitations section is deliberately prominent: this is a teaching tool for
 * a specific theoretical framework, not a claim to reproduce it in full.
 */
export function Overview() {
  return (
    <div className="space-y-5">
      <header className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-[22px] font-semibold text-lab-100">Deep Learning Theory Explorer</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-lab-300">
              An interactive laboratory for the mathematics of neural networks at initialization and during training,
              built around{' '}
              <a href={SOURCE.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                {SOURCE.shortTitle}
              </a>{' '}
              by {SOURCE.authors} ({SOURCE.publisher}; preprint {SOURCE.arxiv}).
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-lab-300">
              Every number you see here is computed in your browser from the definitions: Gaussian integrals by
              quadrature, network statistics by real forward passes with seeded weights, gradients by exact
              backpropagation checked against finite differences, and kernels assembled from Jacobians. Nothing is a
              mock-up and nothing is pretrained.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-2">
            <Stat label="Lessons" value={LESSONS.length} hint="mapped to the source chapters" />
            <Stat label="Laboratories" value={LABS.length} hint="every one driven by the same numerical core" />
            <Stat label="Preset experiments" value={EXPERIMENTS.length} hint="each with a stated expectation" />
            <Stat label="Assessment questions" value={QUIZ.length} hint="all with computed answers" />
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <StartHere />
        <Panel title="The idea" subtitle="Change a parameter, watch the mathematics respond.">
          <div className="space-y-3 text-[13.5px] leading-relaxed text-lab-200">
            <p>
              The theory this app teaches has one organising question: what happens to a signal as it passes through
              many layers? The answer is written as a recursion for a kernel,
            </p>
            <div className="rounded border border-lab-700 bg-lab-850/60 px-3 py-2 text-center">
              <Tex tex="K^{(\ell+1)} = C_b + C_W \, \mathbb{E}_{(u,v)\sim\mathcal{N}(0,K^{(\ell)})}\!\left[\sigma(u)\sigma(v)\right]" display />
            </div>
            <p>
              and everything else — criticality, universality classes, the depth-to-width ratio, the neural tangent
              kernel — follows from analysing this map and its fluctuations. In this app you can move{' '}
              <Tex tex="C_W" />, <Tex tex="C_b" />, the activation, the depth and the width, and see the consequences in
              measured quantities rather than quoted results.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link to="/labs/physics" className="card block p-3 text-[12.5px] hover:border-signal-blue">
                <div className="font-semibold text-lab-100">Start with the physics lab</div>
                <div className="mt-1 text-lab-400">Build a network, sweep the initialization, watch the signals.</div>
              </Link>
              <Link to="/lessons/non-gaussianity" className="card block p-3 text-[12.5px] hover:border-signal-blue">
                <div className="font-semibold text-lab-100">Read lesson 1</div>
                <div className="mt-1 text-lab-400">Gaussians, Wick contraction, and why deviations matter.</div>
              </Link>
              <Link to="/labs/initialization" className="card block p-3 text-[12.5px] hover:border-signal-blue">
                <div className="font-semibold text-lab-100">Reproduce Kaiming</div>
                <div className="mt-1 text-lab-400">Derive C_W = 2 for the ReLU by measuring it.</div>
              </Link>
              <Link to="/dashboard" className="card block p-3 text-[12.5px] hover:border-signal-blue">
                <div className="font-semibold text-lab-100">Let the dashboard choose</div>
                <div className="mt-1 text-lab-400">
                  It reads what you have done and names the one thing to do next, and why.
                </div>
              </Link>
            </div>
          </div>
        </Panel>

        <Panel title="What is verified, and how" subtitle="Claims in this app come with their evidence.">
          <Table
            head={['Claim', 'Evidence in this app']}
            rows={[
              ['Deep linear kernel recursion G^(ℓ) = C_W^ℓ G^(0)', 'Exact closed form compared with seeded networks; test suite'],
              ['ReLU criticality at C_W = 2', 'Quadrature, an independent Simpson rule and 24 seeded networks'],
              ['tanh kernel power law 1/(2ℓ)', 'Exact recursion vs 200-layer measurement, both plotted'],
              ['Sigmoid cannot be critical', 'Scanner reports the root and its negative C_b'],
              ['Var[O^(ℓ)] = 2ℓ(G²)²/n', '400 seeded linear networks vs the analytic line'],
              ['Gradients of the loss', 'Central finite differences on every parameter, < 1e-6 relative'],
              ['NTK is a Gram matrix', 'Symmetry and PSD eigenvalues checked in the browser'],
              ['Two-layer NTK closed form', 'Ensemble average over seeds vs the derived formula'],
              ['η < 2/λmax stability', 'Measured loss curves against the eigen-decomposition prediction'],
            ]}
          />
          <p className="mt-2 text-[11.5px] text-lab-400">
            The same checks run in CI-style tests under <span className="mono">tests/</span>; see{' '}
            <span className="mono">docs/TEST_REPORT.md</span> for the recorded outcomes.
          </p>        </Panel>
      </div>

      <Panel
        title="How the pieces connect"
        subtitle={`${LABS.length} laboratories, one numerical core — and a way to check any of it.`}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'One shared setup',
              body:
                'The activation, the initialization, the depth, the width and the seed are set once and used by every measurement laboratory. Change C_W in one and you have changed it in all of them, which is the book’s claim made operational.',
            },
            {
              title: 'Clickable symbols',
              body:
                'A symbol written in the course style is a link. Click it and its definition opens where you meet it, with the book’s reference and a route to the derivation.',
            },
            {
              title: 'Shareable links',
              body:
                'Every setup has a URL. Send it to somebody and they see the same experiment — the same activation, the same seed, the same numbers.',
            },
            {
              title: 'Data you can check',
              body:
                'Every result table can be downloaded as CSV, with a header recording the settings that produced it. A claim you can’t check is a claim you can’t trust.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded border border-lab-700 bg-lab-850/50 p-3">
              <div className="text-[12.5px] font-semibold text-lab-100">{card.title}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-lab-300">{card.body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <CollectionPanel />

      <Panel title="Honest scope" subtitle="Where the app deliberately stops.">
        <div className="grid gap-3 md:grid-cols-3">
          <Callout tone="limitation" title="Toy scale, not the full effective theory">
            <Rich
              text={
                'The simulations here are small (widths up to a few hundred, depths up to a few hundred). They reproduce the *leading* statements — the kernel recursion, the critical points, the power laws and the L/n fluctuation law — but not the book\'s complete effective action with all of its couplings.'
              }
            />
          </Callout>
          <Callout tone="limitation" title="Two-variable slices, not full landscapes">
            <Rich
              text={
                'The optimization laboratory shows genuine two-parameter slices of real losses. Those slices are real, but they are not the whole high-dimensional landscape, and conclusions about which minima are reachable do not generalise from them.'
              }
            />
          </Callout>
          <Callout tone="limitation" title="Bayesian results are cited, not simulated">
            <Rich
              text={
                'Posterior inference at finite width is beyond a browser simulation of this size. Lessons state those results with citations to §6 and the app marks them as not simulated.'
              }
            />
          </Callout>
        </div>
      </Panel>

      <Panel
        title="Source and licensing"
        subtitle={
          <>
            Original content, cited source. The book is referenced by section and equation number; no figures, extended
            passages or typesetting are reproduced.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-lab-300">
          <Badge tone="good">{SOURCE.arxiv}</Badge>
          <span>
            {SOURCE.authors}, <em>{SOURCE.shortTitle}</em>, {SOURCE.publisher}.
          </span>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            open the preprint
          </a>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-lab-400">
          The arXiv preprint is distributed under a non-exclusive licence and is associated with a Cambridge University
          Press publication; public availability does not grant redistribution rights. All diagrams, prose, dataset
          constructions and code in this app were written for this project. See{' '}
          <span className="mono">docs/LICENSING.md</span>.
        </p>
      </Panel>
    </div>
  );
}
