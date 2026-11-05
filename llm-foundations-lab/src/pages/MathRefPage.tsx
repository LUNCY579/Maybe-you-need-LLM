import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from '../components/layout/CourseLink.tsx'
import { FORMULAS } from '../content/glossary'
import { MODULES, getLesson } from '../content/curriculum'
import { Badge, Button, Panel, TextInput } from '../components/ui/primitives'
import { DisplayMath } from '../components/ui/Math'

interface NotationRow {
  symbol: string
  meaning: string
  introduced: string
}

/** Notation used consistently across the course (rewritten, not copied from the book). */
const NOTATION: NotationRow[] = [
  { symbol: 'x, y', meaning: 'input and output token sequences; x_i is the token at position i', introduced: 'Module 1' },
  { symbol: '|x|', meaning: 'sequence length in tokens', introduced: 'Module 1' },
  { symbol: 'V', meaning: 'the vocabulary; |V| is its size', introduced: 'Module 2' },
  { symbol: 'd, d_h', meaning: 'hidden dimension and per-head dimension', introduced: 'Module 2' },
  { symbol: 'm', meaning: 'sequence length processed in one forward pass', introduced: 'Module 2' },
  { symbol: 'H', meaning: 'hidden-state matrix, one row per token', introduced: 'Module 2' },
  { symbol: 'Q, K, V', meaning: 'query, key and value matrices produced from H', introduced: 'Module 2' },
  { symbol: 'M', meaning: 'additive mask matrix; 0 where attention is allowed, −∞ where it is blocked', introduced: 'Module 2' },
  { symbol: 'θ', meaning: 'model parameters', introduced: 'Module 1' },
  { symbol: 'L(·)', meaning: 'loss function', introduced: 'Module 1' },
  { symbol: 'η', meaning: 'learning rate', introduced: 'Module 2' },
  { symbol: 'λ (or β)', meaning: 'weight of the KL / preference penalty term', introduced: 'Module 4' },
  { symbol: 'r(x, y)', meaning: 'reward of response y for prompt x', introduced: 'Module 4' },
  { symbol: 'π_θ, π_ref', meaning: 'policy being trained and its frozen reference', introduced: 'Module 4' },
  { symbol: 'σ(·)', meaning: 'logistic sigmoid', introduced: 'Module 4' },
  { symbol: 'τ', meaning: 'sampling temperature', introduced: 'Module 5' },
  { symbol: 'u_y', meaning: 'logit of token y', introduced: 'Module 5' },
  { symbol: 'T', meaning: 'context length at inference time', introduced: 'Module 5' },
  { symbol: 'L, h_kv, B', meaning: 'layer count, key/value head count and batch size in the cache formula', introduced: 'Module 5' },
  { symbol: 'D_KL(p‖q)', meaning: 'KL divergence from q to p', introduced: 'Module 4' },
  { symbol: 'pass@k', meaning: 'probability that at least one of k sampled attempts is correct', introduced: 'Module 6' },
]

export function MathRefPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  /*
    The formula being read is read from the address rather than held in
    state of its own. It was held in state, initialised from the address
    once, and that meant a reader who arrived at a link to a particular
    formula saw the list with nothing selected, and the back button did
    nothing.
  */
  const selected = searchParams.get('formula') ?? ''
  const [moduleFilter, setModuleFilter] = useState('all')

  const formulas = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return FORMULAS.filter((formula) => {
      if (moduleFilter !== 'all' && formula.moduleId !== moduleFilter) return false
      if (!trimmed) return true
      return (
        formula.name.toLowerCase().includes(trimmed) ||
        formula.explanation.toLowerCase().includes(trimmed) ||
        formula.tex.toLowerCase().includes(trimmed)
      )
    })
  }, [query, moduleFilter])

  const active = FORMULAS.find((formula) => formula.id === selected)

  return (
    <div className="animate-rise space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Mathematical reference</h1>
        <p className="max-w-3xl text-sm text-muted">
          {FORMULAS.length} formulas with symbol-by-symbol explanations, the section of the source they come from, and a
          link to the lesson where they are used interactively. Every formula is rendered by KaTeX and validated by the
          test suite, so a broken expression fails the build rather than appearing as red text.
        </p>
      </header>

      <Panel className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          <TextInput
            label="Search formulas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="try “softmax”, “cache”, “preference”"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={moduleFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setModuleFilter('all')}>
              all modules
            </Button>
            {MODULES.map((module) => (
              <Button
                key={module.id}
                size="sm"
                variant={moduleFilter === module.id ? 'primary' : 'ghost'}
                onClick={() => setModuleFilter(module.id)}
              >
                {module.chapter}. {module.title}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted">
          <span className="font-mono text-fg">{formulas.length}</span> formulas match.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-label="Formula list" className="space-y-3">
          {formulas.map((formula) => (
            <article
              key={formula.id}
              id={formula.id}
              className={`scroll-mt-24 rounded-2xl border p-4 ${
                selected === formula.id ? 'border-indigo bg-indigo/5' : 'border-line bg-panel/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-fg">{formula.name}</h2>
                <div className="flex items-center gap-2">
                  <Badge tone="teal">§{formula.section}</Badge>
                  <Badge tone="neutral">p.{formula.page}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchParams({ formula: formula.id })
                    }}
                  >
                    focus
                  </Button>
                </div>
              </div>
              <DisplayMath tex={formula.tex} />
              <p className="text-sm leading-relaxed text-muted">{formula.explanation}</p>
              <table className="mt-3 w-full text-left text-xs">
                <tbody>
                  {formula.symbols.map((symbol) => (
                    <tr key={symbol.symbol} className="border-t border-line-soft">
                      <td className="w-32 py-1.5 pr-3 font-mono text-teal">{symbol.symbol}</td>
                      <td className="py-1.5 text-muted">{symbol.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
          {formulas.length === 0 ? <p className="text-sm text-faint">No formulas match that search.</p> : null}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {active ? (
            <Panel>
              <h2 className="font-display text-lg font-semibold text-fg">{active.name}</h2>
              <DisplayMath tex={active.tex} />
              <p className="text-sm text-muted">{active.explanation}</p>
              <p className="mt-3 text-xs text-faint">
                Source: §{active.section}, p.{active.page} · module{' '}
                {MODULES.find((module) => module.id === active.moduleId)?.chapter}
              </p>
              {getLesson(active.lessonId) ? (
                <Link to={`/lessons/${active.lessonId}`} className="mt-2 inline-block text-sm text-indigo hover:underline">
                  See it used in {getLesson(active.lessonId)!.title} →
                </Link>
              ) : null}
            </Panel>
          ) : null}

          <Panel>
            <h2 className="font-display text-lg font-semibold text-fg">Notation used in this course</h2>
            <p className="mt-1 text-xs text-muted">
              One symbol, one meaning. Where the source uses alternative letters, the lesson text gives both.
            </p>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="text-faint">
                  <th className="py-1 font-medium">symbol</th>
                  <th className="py-1 font-medium">meaning</th>
                  <th className="py-1 font-medium">first used</th>
                </tr>
              </thead>
              <tbody>
                {NOTATION.map((row) => (
                  <tr key={row.symbol} className="border-t border-line-soft">
                    <td className="w-24 py-1.5 pr-2 font-mono text-teal">{row.symbol}</td>
                    <td className="py-1.5 text-muted">{row.meaning}</td>
                    <td className="whitespace-nowrap py-1.5 text-faint">{row.introduced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

export default MathRefPage
