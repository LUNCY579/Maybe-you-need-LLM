import { Link } from 'react-router-dom';
import { Panel, Callout, Table, Badge, Bullets } from '../components/ui';
import { Tex } from '../components/Math';
import { SOURCE, EQUATION_REFS, NOTATION_GLOSSARY } from '../content/references';
import { LESSONS } from '../content/lessons';
import { EXPERIMENTS } from '../content/experiments';
import { EQUATIONS } from '../content/equations';
import { QUIZ } from '../content/quizzes';

/**
 * Sources, attribution and licensing.
 *
 * This screen is deliberately explicit: the app teaches the mathematics of a
 * specific monograph, so a reader must be able to see, on one page, exactly what
 * comes from the book (the mathematics, cited by section and equation) and what
 * is original to this project (all prose, all code, all figures, all datasets).
 */
export function SourcesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[20px] font-semibold text-lab-100">Sources, attribution and licensing</h1>
        <p className="mt-1 max-w-4xl text-[13px] leading-relaxed text-lab-300">
          This application is an independent, original teaching implementation of the mathematics of one specific
          research monograph. It reproduces no text, no figures, no typesetting and no datasets from that monograph, and
          it makes no claim to have reproduced its results beyond the statements it labels as measured. This page
          records the full attribution chain.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="The source" subtitle="Cited scholarly reference, not a content source.">
          <div className="space-y-3 text-[13px] leading-relaxed text-lab-200">
            <p>
              <em className="text-lab-100">{SOURCE.shortTitle}</em>: An Effective Theory Approach to Understanding Neural
              Networks. {SOURCE.authors}. {SOURCE.publisher}.
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="good">{SOURCE.arxiv}</Badge>
              <a href={SOURCE.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                {SOURCE.url}
              </a>
            </p>
            <Callout tone="warning" title="Licence of the source">
              The arXiv preprint carries a non-exclusive distribution licence and is associated with a Cambridge
              University Press publication. Public availability of a preprint is not a grant of redistribution or
              republication rights. Nothing from the book — text, figures, exercise sets, or typesetting — is
              reproduced here.
            </Callout>
            <p>
              What is used is <em>mathematics</em>: the definitions, recursions and results that the app implements and
              verifies. Equations are written out as mathematical statements and cited by chapter, section and
              equation number (for example <span className="mono">{EQUATION_REFS.criticality.label}</span> for the
              criticality conditions <span className="mono">{EQUATION_REFS.criticality.note}</span>). Citing a
              mathematical result is standard scholarly practice and is not a reproduction of protected expression.
            </p>
          </div>
        </Panel>

        <Panel title="What is original to this project" subtitle="Everything except the mathematics itself.">
          <Bullets
            items={[
              'All lesson prose, intuition, worked examples and exercise answers.',
              'All equation-explorer text: symbol glossaries, assumption lists, derivation walk-throughs and substitution examples.',
              'All quiz questions, answer keys and explanations.',
              'All figure code, chart layouts, dashboards, laboratory controls and the dark visual system.',
              'All numerical code: the MLP, backpropagation, the Gauss-Hermite and bivariate quadrature, the criticality scanner, the optimizers, the linear algebra, the seeded RNG, the datasets and the representation embedding.',
              'All dataset constructions (the two-moons and Gaussian-mixture problems are generated from a seeded RNG in this repository; no dataset from the book or any other source is used).',
            ]}
          />
          <p className="mt-2 text-[12px] leading-relaxed text-lab-400">
            No automated or manual extraction of the book&apos;s prose, figures or tables was performed for this
            project; the PDF was read as a reference for mathematics, exactly as a reader would.
          </p>
        </Panel>
      </div>

      <Panel
        title="Scientific-integrity policy"
        subtitle="The rules this app follows, and where you can see them enforced."
      >
        <Table
          head={['Rule', 'How it appears in the product']}
          rows={[
            [
              'No fabricated numbers',
              'Every plotted value is produced by an actual computation at render time. There are no stored result arrays.',
            ],
            [
              'Empirical vs. theoretical is always labelled',
              'Charts draw measured curves and analytic curves with separate legends; captions state which is which and at what order.',
            ],
            [
              'Sample counts and seeds are shown',
              'Panels state the number of seeds, the number of input samples and the seed value used for the run.',
            ],
            [
              'Gradients are verified independently',
              'Analytic backpropagation is checked against central finite differences; the test suite and the optimization laboratory both do this.',
            ],
            [
              'Kernels are checked for structure',
              'NTK matrices are tested for symmetry and positive semidefiniteness, both offline and in the browser.',
            ],
            [
              'Instability is shown, not hidden',
              'Diverging runs, overflow and non-finite values are reported rather than silently dropped.',
            ],
            [
              'Approximations are named',
              'Gauss-Hermite quadrature, bivariate quadrature and PCA-based embeddings are labelled as approximations with their error characteristics stated.',
            ],
            [
              'Toy scale is never presented as the full theory',
              'Each laboratory carries a limitation callout explaining which part of the book&apos;s effective theory it does and does not capture.',
            ],
            [
              'Findings are not claimed',
              'The app never labels a measurement as a research result. It reports what the code computed under stated conditions.',
            ],
          ]}
        />
      </Panel>

      <Panel
        title="Chapter-by-chapter map"
        subtitle="Where each part of the source is engaged with, and what this app does about it."
      >
        <Table
          head={['Book chapter', 'Lessons', 'Laboratory / screen', 'What the app does']}
          rows={[
            [
              'Ch. 0 — Initialization',
              'Lesson 1 (foundation)',
              'Overview, Physics lab',
              'States the effective-theory programme, the 1/n expansion and the depth-to-width ratio r = L/n, then lets the learner watch signals that the programme is about.',
            ],
            [
              'Ch. 1 — Pretraining (Gaussian integrals, statistics, nearly-Gaussian distributions)',
              'Lesson 1, Lesson 2',
              'Equation explorer',
              'Wick contraction and connected four-point correlators are computed numerically and used to measure non-Gaussianity.',
            ],
            [
              'Ch. 2 — Neural networks (function approximation, activations, ensembles)',
              'Lesson 2',
              'Physics lab, Initialization lab',
              'The activation registry carries the book&apos;s universality classes; the initialization distribution is the book&apos;s Gaussian choice with a matched-variance uniform alternative.',
            ],
            [
              'Ch. 3 — Deep linear networks (criticality, fluctuations, chaos)',
              'Lesson 3, Lesson 4',
              'Lab A, Lab C',
              'G^(ℓ) = C_W^ℓ G^(0) is checked against seeded networks; the fluctuation law 2ℓ(G²)²/n is measured over 400 networks and compared with the analytic line.',
            ],
            [
              'Ch. 4 — RG flow of preactivations',
              'Lesson 5',
              'Lab C, Equation explorer',
              'The RG picture is presented qualitatively; the app does not attempt a numerical coarse-graining flow, and says so.',
            ],
            [
              'Ch. 5 — Effective theory of preactivations (criticality, universality)',
              'Lesson 6, Lesson 7',
              'Lab A, Physics lab',
              'The kernel recursion, the two susceptibilities and the criticality conditions are implemented and evaluated by quadrature; the criticality scanner recovers C_W = 2 for ReLU and C_W = 1 for tanh, and reports the unphysical C_b for sigmoid.',
            ],
            [
              'Ch. 6 — Bayesian learning',
              'Lesson 8',
              'Lesson 8 only',
              'Cited, not simulated: posterior inference at finite width is out of reach for an in-browser toy. The lesson states the results and marks them as not simulated.',
            ],
            [
              'Ch. 7 — Gradient-based learning',
              'Lesson 9, Lesson 10',
              'Lab B, Lab D',
              'Gradient descent, the loss decomposition and the NTK definition are implemented; the stability condition η < 2/λ_max is measured against the eigen-decomposition prediction.',
            ],
            [
              'Ch. 8–9 — RG flow and effective theory of the NTK',
              'Lesson 9',
              'Lab D',
              'The frozen NTK recursion and the 1/n learning-rate rescaling are implemented; the empirical NTK is built from exact Jacobians and checked for symmetry and PSD.',
            ],
            [
              'Ch. 10 — Kernel learning',
              'Lesson 9',
              'Lab D',
              'The two-layer closed form C_W·K̇·(x·x′ + 1) + n₁·g + 1 is derived in-app and compared with the ensemble average of empirical kernels.',
            ],
            [
              'Ch. 11 — Representation learning',
              'Lesson 10',
              'Lab E',
              'Feature drift before and after training is measured on a generated two-moons problem; PCA is used for the 2-D embedding and its limitations are stated.',
            ],
            [
              'Ch. 12 — The end of training',
              'Lesson 9, Lesson 10',
              'Lab B, Lab D, Lab E',
              'The defrosting of the NTK and the movement of hidden features are measured, not asserted.',
            ],
            [
              'Ch. 13 — Epilogue: model complexity',
              'Lesson 7',
              'Lab C',
              'The depth-to-width aspect ratio is exposed as a live quantity in the laboratory.',
            ],
            [
              'App. A — Information in deep learning',
              'Lesson 7',
              'Lab C',
              'The information-theoretic origin of the optimal aspect ratio is discussed; the app measures the fluctuations that the argument bounds, but does not claim to compute the bound.',
            ],
            [
              'App. B — Residual learning',
              'Lesson 7',
              'Physics lab (residual-free)',
              'Not simulated. Residual blocks are out of the current scope; the lesson records the claim and labels it as cited-only.',
            ],
          ]}
        />
      </Panel>

      <Panel title="Third-party software" subtitle="Licences of the libraries this project depends on.">
        <Table
          head={['Package', 'Licence', 'Role']}
          rows={[
            ['react, react-dom', 'MIT', 'User interface'],
            ['react-router-dom', 'MIT', 'Client-side routing'],
            ['vite, @vitejs/plugin-react', 'MIT', 'Build tooling'],
            ['typescript', 'Apache-2.0', 'Type system'],
            ['tailwindcss, postcss, autoprefixer', 'MIT', 'Styling'],
            ['katex', 'MIT', 'Mathematical typesetting'],
            ['plotly.js', 'MIT', 'Charts — bundled with only the traces this application draws'],
            ['vitest, @vitest/*', 'MIT', 'Unit testing'],
            ['@playwright/test', 'Apache-2.0', 'End-to-end testing'],
            ['typescript, jsdom and all transitive dependencies', 'MIT / Apache-2.0 / BSD-2-Clause / ISC', 'Transitive build and test dependencies'],
          ]}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-lab-400">
          All of the above are permissively licensed and redistributable. The package manifests give version ranges and
          the lock file pins the exact versions that were used; the authoritative licence texts ship inside each package
          under <span className="mono">node_modules/&lt;package&gt;/LICENSE</span>.
        </p>
      </Panel>

      <Panel title="Counts and identifiers" subtitle="The inventory this page describes.">
        <div className="grid gap-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Lessons', LESSONS.length],
            ['Equations in the explorer', EQUATIONS.length],
            ['Assessment questions', QUIZ.length],
            ['Preset experiments', EXPERIMENTS.length],
            ['Glossary symbols', NOTATION_GLOSSARY.length],
            ['Laboratory screens', 6],
            ['Citation targets', Object.keys(EQUATION_REFS).length],
            ['Rendering library', 'KaTeX'],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded border border-lab-700 bg-lab-850/60 px-3 py-2">
              <div className="text-[10.5px] uppercase tracking-wider text-lab-400">{label}</div>
              <div className="mono mt-0.5 text-[15px] text-lab-100">{value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-lab-400">
          The criticality conditions implemented throughout the app are the two susceptibility conditions{' '}
          <Tex tex="\chi_{\parallel}(K_\infty)=1" /> and <Tex tex="\chi_{\perp}(K_\infty)=1" /> of{' '}
          <span className="mono">{EQUATION_REFS.criticality.label}</span>, together with the fixed-point condition{' '}
          <Tex tex="K_\infty = C_b + C_W g(K_\infty)" /> of <span className="mono">{EQUATION_REFS.kernelRecursion.label}</span>.
          Their derivation, and the assumptions it relies on, are set out in the equation explorer.
        </p>
        <p className="mt-2 text-[12px] text-lab-400">
          <Link to="/equations" className="underline decoration-dotted">
            open the equation explorer
          </Link>
          {' · '}
          <Link to="/lessons" className="underline decoration-dotted">
            open the lesson index
          </Link>
        </p>
      </Panel>
    </div>
  );
}
