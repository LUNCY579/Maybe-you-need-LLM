# The Course Core

The shared spine of every course application in this collection: numeric primitives, small
dense linear algebra, statistical estimators, preference modelling, persistence, the progress
model, the assessment engine, search, and the curriculum and glossary schemas.

The package is framework-free by design. A course application owns its React layer; everything
that can be tested without a DOM lives here, so that a number two courses print means the same
thing in both.

```bash
npm install          # from the workspace root
npm run build        # tsc -b
npm test             # 129 tests across 7 files
```

## What it holds

| Module | What it provides |
| --- | --- |
| `math` | The small numeric surface the courses print from: formatting, `softmax`, the loss functions, the seeded `createRng`, and the deterministic run that keeps a laboratory's numbers reproducible. |
| `linalg` | Dense linear algebra without a dependency: matrix and vector operations, `cholesky`, `invert`, `solveLinear`, `jacobiEigen`, `powerIteration`, `ols` and a `Tape`-based autodiff. |
| `stats` | The estimators a results panel quotes: descriptive statistics, `gaussian`, effect sizes and intervals, `bootstrapCI`, `permutationTest`, `requiredSampleSize`, `powerLawFit` and the multiple-comparison corrections. |
| `preference` | The reward-model maths: Bradley–Terry log-likelihood and gradient, its fitting from pairs and from a comparison matrix, `elo` and `preferenceProbability`. |
| `storage` | Persistence that survives an uncooperative browser: `createStore` round-trips a value, discards a corrupt record instead of throwing, migrates an older schema, degrades to memory when storage is unavailable, and rejects a file that is not a progress export. |
| `progress` | The progress model and its summary: what is done, what is due, and what the record says when it is read back. |
| `quiz` | The assessment engine: `gradeAnswer`, the `summariseQuiz` numbers, and the glossary helpers that resolve a term. |
| `search` | The ranking the hub and the catalogue both use, over the same documents. |
| `curriculum` | The curriculum schema and its selectors, the prerequisite graph and the course ordering. |

## What the suite holds

`test/math.test.ts`, `test/linalg.test.ts`, `test/stats.test.ts`, `test/preference.test.ts`,
`test/persistence.test.ts`, `test/curriculum.test.ts` and `test/assessment.test.ts` — 129
assertions, each against a value computed in the test rather than pasted from the implementation.

The two rules the package exists to keep are checked here. The first is that a primitive several
courses print has to be right in all of them: the linear algebra is tested against matrices whose
answer is known — the eigenvalues of a diagonal matrix, the coefficients a least-squares fit
recovers, the exponent a power law was generated with — and the estimators against the properties
they claim, an interval that brackets its point estimate and repeats itself for a given seed, an
effect size that is zero for identical groups. The second is that a record survives the browser it
is stored in, because a lost record is a lesson the reader has to sit through twice.
