import { Link } from '../components/layout/CourseLink.tsx'
import { MODULES, LESSONS } from '../content/curriculum'
import { GLOSSARY, FORMULAS } from '../content/glossary'
import { QUIZ_BANK } from '../content/quiz'
import { MODULE_STATUS } from '../content/status'
import { Badge, Callout, Panel, Stat } from '../components/ui/primitives'

/**
 * How many primary papers the status page cites.
 *
 * Counted from the data rather than written down, so the number on the page
 * is the number of papers the page cites.
 */
const PRIMARY_SOURCE_COUNT = MODULE_STATUS.reduce((total, entry) => total + entry.sources.length, 0)

const BIBLIOGRAPHY = [
  {
    label: 'Vaswani et al. (2017) — Attention Is All You Need',
    href: 'https://arxiv.org/abs/1706.03762',
    note: 'Scaled dot-product attention, multi-head attention and sinusoidal positional encoding.',
  },
  {
    label: 'Devlin et al. (2019) — BERT',
    href: 'https://arxiv.org/abs/1810.04805',
    note: 'Masked language modelling and the [CLS]/[SEP] conventions.',
  },
  {
    label: 'Raffel et al. (2020) — T5',
    href: 'https://arxiv.org/abs/1910.10683',
    note: 'Span corruption for encoder–decoder pre-training.',
  },
  {
    label: 'Brown et al. (2020) — GPT-3',
    href: 'https://arxiv.org/abs/2005.14165',
    note: 'In-context learning at scale.',
  },
  {
    label: 'Wei et al. (2022) — Chain-of-Thought Prompting',
    href: 'https://arxiv.org/abs/2201.11903',
    note: 'Step-by-step prompting.',
  },
  {
    label: 'Lewis et al. (2020) — Retrieval-Augmented Generation',
    href: 'https://arxiv.org/abs/2005.11401',
    note: 'Retrieval as part of generation.',
  },
  {
    label: 'Li & Liang (2021) — Prefix-Tuning',
    href: 'https://arxiv.org/abs/2101.00190',
    note: 'Soft prompts as learned continuous prefixes.',
  },
  {
    label: 'Hu et al. (2021) — LoRA',
    href: 'https://arxiv.org/abs/2106.09685',
    note: 'Freezing the base weights and training low-rank adapters.',
  },
  {
    label: 'Ouyang et al. (2022) — InstructGPT',
    href: 'https://arxiv.org/abs/2203.02155',
    note: 'The SFT → reward model → RLHF pipeline.',
  },
  {
    label: 'Christiano et al. (2017) — Deep RL from Human Preferences',
    href: 'https://arxiv.org/abs/1706.03741',
    note: 'Learning rewards from pairwise comparisons.',
  },
  {
    label: 'Rafailov et al. (2024) — Direct Preference Optimization',
    href: 'https://arxiv.org/abs/2305.18290',
    note: 'The derivation re-implemented numerically in Laboratory D.',
  },
  {
    label: 'Holtzman et al. (2020) — Nucleus Sampling',
    href: 'https://arxiv.org/abs/1904.09751',
    note: 'Top-p sampling.',
  },
  {
    label: 'Fan et al. (2018) — Top-k Sampling',
    href: 'https://arxiv.org/abs/1805.04833',
    note: 'Top-k sampling.',
  },
  {
    label: 'Hoffmann et al. (2022) — Chinchilla',
    href: 'https://arxiv.org/abs/2203.15556',
    note: 'Compute-optimal model/data trade-off.',
  },
  {
    label: 'Fedus et al. (2021) — Switch Transformer',
    href: 'https://arxiv.org/abs/2101.03961',
    note: 'Sparse mixture-of-experts routing at trillion-parameter scale.',
  },
  {
    label: 'Gu & Dao (2023) — Mamba',
    href: 'https://arxiv.org/abs/2312.00752',
    note: 'A selective state-space model that scales linearly with sequence length.',
  },
  {
    label: 'Ainslie et al. (2023) — GQA',
    href: 'https://arxiv.org/abs/2305.13245',
    note: 'Grouped-query attention and cache reduction.',
  },
  {
    label: 'Shazeer (2019) — Multi-Query Attention',
    href: 'https://arxiv.org/abs/1911.02150',
    note: 'Sharing a single key/value head.',
  },
  {
    label: 'Dao et al. (2022) — FlashAttention',
    href: 'https://arxiv.org/abs/2205.14135',
    note: 'Exact attention computed tile by tile to cut memory traffic.',
  },
  {
    label: 'Kwon et al. (2023) — PagedAttention / vLLM',
    href: 'https://arxiv.org/abs/2309.06180',
    note: 'Memory management for KV caches.',
  },
  {
    label: 'Pope et al. (2022) — Efficiently Scaling Transformer Inference',
    href: 'https://arxiv.org/abs/2211.05102',
    note: 'Analytical treatment of prefill and decode costs.',
  },
  {
    label: 'Leviathan et al. (2023) — Speculative Decoding',
    href: 'https://arxiv.org/abs/2211.17192',
    note: 'A small draft model proposes tokens and the target model verifies them in parallel.',
  },
  {
    label: 'Lightman et al. (2023) — Let’s Verify Step by Step',
    href: 'https://arxiv.org/abs/2305.20050',
    note: 'Process supervision and verification.',
  },
  {
    label: 'Yao et al. (2023) — Tree of Thoughts',
    href: 'https://arxiv.org/abs/2305.10601',
    note: 'Search over reasoning steps.',
  },
  {
    label: 'Snell et al. (2024) — Scaling Test-Time Compute',
    href: 'https://arxiv.org/abs/2408.03314',
    note: 'Comparing test-time strategies under a budget.',
  },
]

export function SourcesPage() {
  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Sources, attribution and licensing</h1>
        <p className="max-w-3xl text-sm text-muted">
          This page states exactly what this course is derived from, what was verified about that source, and what the
          licence permits. It also lists the third-party works referenced by individual lessons.
        </p>
      </header>

      <Panel className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-fg">Source work</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Title</dt>
            <dd className="text-sm text-fg">Foundations of Large Language Models</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Authors</dt>
            <dd className="text-sm text-fg">Tong Xiao and Jingbo Zhu</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Affiliation</dt>
            <dd className="text-sm text-fg">NLP Lab, Northeastern University &amp; NiuTrans Research</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Identifier</dt>
            <dd className="text-sm text-fg">
              arXiv:2501.09223v4 [cs.CL] —{' '}
              <a
                className="text-indigo underline underline-offset-2"
                href="https://arxiv.org/abs/2501.09223"
                target="_blank"
                rel="noreferrer noopener"
              >
                arxiv.org/abs/2501.09223
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Revision used</dt>
            <dd className="text-sm text-fg">
              v4, submitted 8 October 2026 (PDF dated 9 October 2026); stated on the title page as “Minor corrections”.
              The arXiv listing shows v1 (16 Jan 2025), v2 (15 Jun 2025), v3 (24 Sep 2026) and v4 (8 Oct 2026).
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Verified structure</dt>
            <dd className="text-sm text-fg">
              Six chapters: 1 Pre-training (pp. 1–35), 2 Generative Models (36–94), 3 Prompting (96–152), 4 Alignment
              (154–201), 5 Inference (203–245), 6 Reasoning (247–278), followed by the bibliography (p. 280). Section
              numbering and page numbers cited throughout this course come from that revision.
            </dd>
          </div>
        </dl>
        <Callout tone="amber" title="Licence: CC BY-NC 4.0 — not CC BY 4.0">
          The v4 title page licenses the work under the{' '}
          <a className="underline" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer noopener">
            Creative Commons Attribution-NonCommercial 4.0 Unported licence
          </a>
          , and the copyright notice reads “Copyright © 2021–2026 Tong Xiao and Jingbo Zhu”. The tasking brief for this
          project mentioned CC BY 4.0; the PDF in this workspace says CC BY-NC 4.0, and the stricter, actual terms are
          followed here. This course is therefore a non-commercial educational adaptation and must not be used
          commercially.
        </Callout>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-fg">What was adapted, and how</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-fg">Structure.</strong> The six-module curriculum mirrors the book’s six chapters, and
            every lesson lists the source sections and printed page numbers it draws on. Navigation is data-driven from
            the same metadata, so the mapping cannot drift out of sync silently.
          </li>
          <li>
            <strong className="text-fg">Explanations.</strong> All lesson prose, worked examples, quiz items, feedback
            text, glossary definitions and formula commentary are original writing for this course. Interactive figures
            were designed and implemented independently.
          </li>
          <li>
            <strong className="text-fg">Mathematics.</strong> Equations are restated from the source with the same symbols
            and semantics (for example QKV attention with a causal mask, Eq. 2.6; the DPO derivation, Eq. 4.73–4.82;
            top-k, top-p and temperature, Eq. 5.23–5.29). Derivations in the alignment module follow the source’s steps
            because the derivation is the content.
          </li>
          <li>
            <strong className="text-fg">No figures reproduced.</strong> No tables, diagrams, screenshots or extended
            verbatim passages from the book or its incorporated third-party material appear on this site. Where the book
            builds on another work, this course cites that work directly.
          </li>
          <li>
            <strong className="text-fg">Third-party rights.</strong> Cited papers (BERT, T5, GPT-3, DPO, Chinchilla, GQA,
            vLLM, process supervision, and others) remain under their own licences and terms; only citations and short
            factual descriptions are used. No third-party figure is reproduced.
          </li>
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Modules" value={MODULES.length} tone="indigo" />
        <Stat label="Lessons" value={LESSONS.length} tone="teal" />
        <Stat label="Quiz items" value={QUIZ_BANK.length} tone="amber" />
        <Stat label="Glossary terms" value={GLOSSARY.length} tone="indigo" />
        <Stat label="Formulas documented" value={FORMULAS.length} tone="teal" />
        <Stat
          label="Source sections cited"
          value={new Set(LESSONS.flatMap((lesson) => lesson.sourceRefs.map((ref) => ref.section))).size}
          tone="amber"
        />
        <Stat label="Lesson references" value={LESSONS.reduce((sum, lesson) => sum + lesson.sourceRefs.length, 0)} />
        <Stat label="External works listed" value={BIBLIOGRAPHY.length} />
        <Stat label="Primary sources for currency" value={PRIMARY_SOURCE_COUNT} tone="indigo" />
      </div>

      <Panel>
        <h2 className="font-display text-xl font-semibold text-fg">Licensing of this course</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            <Badge tone="indigo">code</Badge> The application source in this repository is released under the MIT licence
            (see <span className="font-mono">LICENSE</span>).
          </p>
          <p>
            <Badge tone="teal">course content</Badge> The original educational text, questions, glossary and figures of
            LLM Foundations Lab are offered under{' '}
            <a className="text-indigo underline" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer noopener">
              CC BY-NC 4.0
            </a>
            , matching the licence of the source it adapts. Attribution must credit both this course and the source work
            by Tong Xiao and Jingbo Zhu.
          </p>
          <p>
            <Badge tone="amber">third-party dependencies</Badge> React, Vite, Tailwind CSS, KaTeX, Recharts, React Router,
            Vitest, Testing Library, Playwright and the Fontsource fonts are used under their respective licences (MIT,
            Apache-2.0 or OFL); they are runtime dependencies, not redistributed content of this course.
          </p>
        </div>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-semibold text-fg">Referenced literature</h2>
        <p className="mt-1 text-xs text-muted">
          These works are listed for further reading. They are not redistributed here, and the summaries are one-line
          factual descriptions.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {BIBLIOGRAPHY.map((entry) => (
            <li key={entry.href} className="rounded-xl border border-line bg-panel-2/40 p-3">
              <a className="text-sm text-indigo hover:underline" href={entry.href} target="_blank" rel="noreferrer noopener">
                {entry.label} ↗
              </a>
              <p className="mt-1 text-xs text-muted">{entry.note}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-semibold text-fg">The literature the course is measured against</h2>
        <p className="mt-1 text-xs text-muted">
          The page{' '}
          <Link to="/status" className="text-indigo underline">
            How settled is this?
          </Link>{' '}
          says which parts of the course have been overtaken by work published since the book was written, and cites{' '}
          {PRIMARY_SOURCE_COUNT} primary papers for that — the papers themselves, not summaries of them. Every one of them
          is named, linked, and given a line on what it shows.
        </p>
        <p className="mt-2 text-xs text-muted">
          Those papers are cited, not reproduced, and the judgements on that page are the course's own. A reader who
          disagrees with one of them can follow the link and check it. The list is checked against the network by the
          project's own tooling, and the page says when it was last checked.
        </p>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-semibold text-fg">Provenance of the interactive content</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="py-1.5 font-medium">Figure / laboratory</th>
              <th className="py-1.5 font-medium">Computed by</th>
              <th className="py-1.5 font-medium">Claim type</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {[
              ['Transformer Explorer', 'core/attention.ts, core/embeddings.ts, core/transformer.ts', 'Exact arithmetic on a toy model'],
              ['Tokenizer laboratory', 'core/tokenizer.ts', 'Exact counts for the demonstrative vocabulary'],
              ['Sampling laboratory', 'core/sampling.ts', 'Exact probabilities; Monte-Carlo validation of the sampler'],
              ['Learning laboratory', 'core/training.ts', 'Real SGD trajectory; gradient checked against finite differences'],
              ['Scaling calculator', 'core/training.ts (illustrative fit)', 'Illustrative power law, not published constants'],
              ['Alignment laboratory', 'core/alignment.ts, core/reasoning.ts', 'Exact losses and gradients on a linear toy policy'],
              ['Inference laboratory', 'core/inference.ts, core/reasoning.ts', 'Real decoding and search; analytic cache model; local timing'],
              ['Prompting laboratory', 'core/retrieval.ts, core/tokenizer.ts', 'Exact cosine scores and token counts for toy vectors'],
            ].map(([figure, file, claim]) => (
              <tr key={figure} className="border-t border-line-soft">
                <td className="py-2 pr-3 text-fg">{figure}</td>
                <td className="py-2 pr-3 font-mono text-xs">{file}</td>
                <td className="py-2">{claim}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-faint">
          Nothing on this site is a performance benchmark of a real model. Where timing appears, it measures JavaScript
          running in your browser and is labelled as such in the figure itself.
        </p>
      </Panel>

      <Callout tone="indigo" title="Reporting an error">
        If a formula, page reference or claim disagrees with the source revision, the lesson’s source list makes it
        checkable: every lesson names its sections and pages so the discrepancy can be verified directly against
        arXiv:2501.09223v4. Corrections are welcome, and the glossary, formula reference and quiz bank all carry the same
        references.
      </Callout>

      <p className="text-xs text-faint">
        Ready to continue? <Link to="/playground" className="text-indigo underline">Open the playground</Link> or{' '}
        <Link to="/lessons/pretraining-why" className="text-indigo underline">restart the course</Link>.
      </p>
    </div>
  )
}

export default SourcesPage
