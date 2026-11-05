import { useMemo, useState } from 'react'
import { TOOL_CASES, evaluateToolCall, type ToolCase } from '../../engine/demos/toolSelection'
import { Badge, Button, Field } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Choosing and calling a tool.
 *
 * This is the skill Chapter 11 is really about, and it is a skill rather than
 * a fact: pick the right tool from a catalogue of near-duplicates, fill in
 * arguments that satisfy its schema, and read the error when you get it wrong.
 *
 * The catalogue deliberately contains two *pairs* of near-identical tools
 * (`book_seat` / `book_seat_legacy`, `is_prime` / `is_prime_approx`). Choosing
 * between them is not a matter of remembering which is which — it is a matter
 * of reading the descriptions, which is exactly the point the lesson makes.
 */
export function ToolSelectionDemo() {
  const [caseId, setCaseId] = useState(TOOL_CASES[0].id)
  const [toolId, setToolId] = useState<string>('')
  const [args, setArgs] = useState<Record<string, string>>({})

  const toolCase: ToolCase = useMemo(
    () => TOOL_CASES.find((entry) => entry.id === caseId) ?? TOOL_CASES[0],
    [caseId],
  )

  const selectedTool = toolCase.tools.find((entry) => entry.id === toolId)
  const result = toolId ? evaluateToolCall(toolCase, toolId, args) : null

  const reset = (id: string) => {
    setCaseId(id)
    setToolId('')
    setArgs({})
  }

  return (
    <DemoShell
      title="Choosing a tool and filling in its arguments"
      source="Ch. 11, §11.2–11.5 Tool use architectures and error handling"
      summary="Pick the tool that actually does what the goal asks, fill in its arguments, and see what the harness would do — including the errors it raises before the tool ever runs."
      controls={
        <div className="space-y-2">
          <Field label="Scenario">
            <select
              aria-label="Choose a tool-selection scenario"
              value={caseId}
              onChange={(event) => reset(event.target.value)}
              className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
            >
              {TOOL_CASES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.goal}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-muted text-[11px] leading-relaxed">{toolCase.context}</p>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">
          <strong>Goal:</strong> {toolCase.goal}
        </p>

        <fieldset className="space-y-2">
          <legend className="text-muted text-[11px] font-semibold tracking-wide uppercase">Which tool?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {toolCase.tools.map((tool) => (
              <label
                key={tool.id}
                className="surface-2 flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 text-xs"
                style={{ borderColor: tool.id === toolId ? 'var(--accent)' : 'var(--border-soft)' }}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="demo-tool"
                    value={tool.id}
                    checked={tool.id === toolId}
                    onChange={() => {
                      setToolId(tool.id)
                      setArgs({})
                    }}
                    className="focus-ring"
                  />
                  <code className="font-mono text-[11px] font-semibold">{tool.name}</code>
                </span>
                <span className="text-muted leading-relaxed">{tool.description}</span>
                <span className="text-muted text-[10px]">
                  {tool.args.map((argument) => (
                    <code key={argument.name} className="mr-1.5 font-mono">
                      {argument.name}:{argument.type}
                      {argument.required ? '' : '?'}
                    </code>
                  ))}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {selectedTool ? (
          <fieldset className="space-y-2">
            <legend className="text-muted text-[11px] font-semibold tracking-wide uppercase">
              Arguments for {selectedTool.name}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedTool.args.map((argument) => (
                <Field key={argument.name} label={`${argument.name}${argument.required ? '' : ' (optional)'}`} hint={argument.description}>
                  <input
                    type="text"
                    value={args[argument.name] ?? ''}
                    onChange={(event) => setArgs({ ...args, [argument.name]: event.target.value })}
                    className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs"
                    style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
                    aria-label={`Argument ${argument.name}`}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-muted text-xs">Choose a tool to see its argument schema.</p>
        )}

        {result ? (
          <div
            className="rounded-lg border p-3 text-xs"
            style={{
              borderColor:
                result.status === 'ok' ? 'rgba(52,211,153,0.5)' : 'rgba(251,113,133,0.5)',
              background: result.status === 'ok' ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.07)',
            }}
            role="status"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.status === 'ok' ? 'emerald' : 'rose'}>{result.status.replace('-', ' ')}</Badge>
              {result.rightTool ? <Badge tone="emerald">right tool</Badge> : <Badge tone="rose">wrong tool</Badge>}
              {result.rightArguments && result.status === 'ok' ? <Badge tone="emerald">right arguments</Badge> : null}
            </div>
            <p className="mt-2 leading-relaxed">{result.explanation}</p>
            {result.issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {result.issues.map((issue) => (
                  <li key={issue.message}>
                    <Badge tone={issue.level === 'error' ? 'rose' : 'amber'}>{issue.level}</Badge> {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.output ? (
              <p className="mt-2 font-mono text-[11px]">
                <span className="text-muted">observation → </span>
                {result.output}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setArgs(toolCase.expectedArgs)} disabled={!selectedTool}>
            Fill in the correct arguments
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setToolId(toolCase.correctToolId)
              setArgs({})
            }}
          >
            Use the right tool, with no arguments
          </Button>
        </div>
      </div>
    </DemoShell>
  )
}
