import type { LessonBlock } from '../../types/curriculum'
import { Badge, Button, Card, Callout } from '../primitives'
import { Diagram } from '../diagrams'
import { Formula, Markdown } from '../Markdown'
import { navigate } from '../../app/router'
import { LABS } from '../../content/labs'
import { LessonDemo } from '../demos/LessonDemo'
import { PredictBlock } from './PredictBlock'

export function LessonBlockView({ block, lessonSlug }: { block: LessonBlock; lessonSlug: string }) {
  switch (block.kind) {
    case 'prose':
      return (
        <div className="text-sm leading-relaxed sm:text-[15px]">
          <Markdown text={block.markdown} />
        </div>
      )

    case 'list':
      return block.ordered ? (
        <ol className="ml-5 list-decimal space-y-1.5 text-sm leading-relaxed">
          {block.items.map((item) => (
            <li key={item}>
              <Markdown text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="ml-5 list-disc space-y-1.5 text-sm leading-relaxed">
          {block.items.map((item) => (
            <li key={item}>
              <Markdown text={item} />
            </li>
          ))}
        </ul>
      )

    case 'formula':
      return (
        <figure className="surface-2 rounded-xl border p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <Formula latex={block.latex} />
          {block.caption ? <figcaption className="text-muted mt-2 text-xs">{block.caption}</figcaption> : null}
        </figure>
      )

    case 'diagram':
      return <Diagram id={block.diagram} caption={block.caption} />

    case 'code':
      return (
        <figure className="surface-2 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: 'var(--border-soft)' }}>
            <span className="text-muted text-[11px] uppercase">{block.language}</span>
          </div>
          <pre className="thin-scroll overflow-x-auto p-3 font-mono text-[12px] leading-relaxed">
            <code>{block.code}</code>
          </pre>
          {block.caption ? <figcaption className="text-muted border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--border-soft)' }}>{block.caption}</figcaption> : null}
        </figure>
      )

    case 'callout':
      return (
        <Callout tone={block.tone} title={block.title}>
          <Markdown text={block.markdown} />
        </Callout>
      )

    case 'table':
      return (
        <figure className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <caption className="text-muted mb-2 text-left text-xs">{block.caption}</caption>
            <thead>
              <tr>
                {block.headers.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="surface-2 border-b px-2 py-1.5 text-left text-[11px] font-semibold tracking-wide uppercase"
                    style={{ borderColor: 'var(--border-soft)' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cell}-${cellIndex}`}
                      className="border-b px-2 py-1.5 align-top"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      <Markdown text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )

    case 'example':
      return (
        <Card className="p-4">
          <h4 className="mb-3 text-sm font-semibold">{block.title}</h4>
          <ol className="space-y-2">
            {block.steps.map((step, index) => (
              <li key={step.label} className="flex gap-3 text-sm">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-slate-950"
                  style={{ background: 'var(--accent)' }}
                >
                  {index + 1}
                </span>
                <span>
                  <strong className="font-semibold">{step.label}: </strong>
                  <Markdown text={step.detail} />
                </span>
              </li>
            ))}
          </ol>
          <p className="text-muted mt-3 border-t pt-3 text-xs" style={{ borderColor: 'var(--border-soft)' }}>
            {block.takeaway}
          </p>
        </Card>
      )

    case 'checkpoint':
      return <CheckpointBlock question={block.question} answer={block.answer} />

    case 'predict':
      return <PredictBlock question={block.question} lessonSlug={lessonSlug} />

    case 'lab-link': {
      const lab = LABS.find((candidate) => candidate.id === block.labId)
      return (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
              Hands-on
            </p>
            <p className="text-sm font-semibold">{block.title}</p>
            <p className="text-muted text-xs">{block.description}</p>
            {lab ? <Badge tone="cyan" className="mt-2">{lab.runtime}</Badge> : null}
          </div>
          <Button variant="primary" onClick={() => navigate(`/${lab?.route ?? `labs/${block.labId}`}`)}>
            Open {lab?.name ?? 'lab'}
          </Button>
        </Card>
      )
    }

    case 'demo':
      return (
        <section id={`demo-${block.demo}`} className="scroll-mt-24 space-y-2">
          <p className="text-sm leading-relaxed">{block.intro}</p>
          <LessonDemo demo={block.demo} />
        </section>
      )

    default:
      return null
  }
}

function CheckpointBlock({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="surface-2 rounded-xl border p-3" style={{ borderColor: 'var(--border-soft)' }}>
      <summary className="focus-ring cursor-pointer text-sm font-medium">
        Checkpoint: {question}
      </summary>
      <div className="mt-3 border-t pt-3 text-sm leading-relaxed" style={{ borderColor: 'var(--border-soft)' }}>
        <Markdown text={answer} />
      </div>
    </details>
  )
}
