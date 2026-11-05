import { useId, useLayoutEffect, useRef, useState } from 'react'

/**
 * A JSON editor that reports invalid input instead of discarding it.
 *
 * The previous version derived the textarea's value straight from the parsed
 * config, so a half-typed JSON object was silently thrown away and the field
 * snapped back to the last valid value. That is the worst possible behaviour
 * for a form field: the user sees their keystrokes disappear with no
 * explanation.
 *
 * This component keeps the raw text as the source of truth while the user is
 * typing, parses it on every change, and:
 *
 *  - calls `onChange` only when the text parses to a plain object;
 *  - shows the parser's message and marks the field invalid when it does not;
 *  - keeps the last valid configuration, so the graph stays runnable.
 *
 * One detail is worth spelling out, because it was a bug:
 *
 * *The last value the editor emitted is remembered.* That is how the editor
 * tells "the value changed because I changed it" from "the value changed
 * because the student selected a different node", so the second case can
 * replace the text and the first can keep what was typed — including its
 * formatting, which the student chose.
 */
export function JsonObjectEditor({
  value,
  onChange,
  label,
  hint,
}: {
  /** The current (valid) value. */
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  label: string
  hint?: string
}) {
  const [text, setText] = useState<string>(() => JSON.stringify(value ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const errorId = useId()
  const hintId = useId()

  /** The value this editor last handed to the parent. */
  const emitted = useRef<string | null>(null)
  /** The incoming value, compared without regard to formatting. */
  const canonical = JSON.stringify(value ?? {})
  /** The text to show when the student has not typed anything of their own. */
  const external = JSON.stringify(value ?? {}, null, 2)

  // When the value changes from outside — a different node, or the reference
  // graph being restored — the text in the field is stale and must be
  // replaced. A change the editor made itself is recognised and ignored.
  useLayoutEffect(() => {
    if (emitted.current !== null && emitted.current === canonical) {
      emitted.current = null
      return
    }
    emitted.current = null
    setText(external)
  }, [canonical, external])

  const handleChange = (next: string) => {
    setText(next)
    try {
      const parsed = JSON.parse(next) as unknown
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Arguments must be a JSON object, for example {"query": "{goal}"}.')
        return
      }
      const normalised: Record<string, string> = {}
      for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
        normalised[key] = typeof entry === 'string' ? entry : JSON.stringify(entry)
      }
      setError(null)
      emitted.current = JSON.stringify(normalised)
      onChange(normalised)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The arguments are not valid JSON.')
    }
  }

  return (
    <div>
      <label htmlFor={fieldId} className="text-muted text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        rows={3}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
        className="focus-ring surface-2 mt-1 w-full rounded-lg border p-2 font-mono text-[11px]"
        style={{
          color: 'var(--text-strong)',
          borderColor: error ? 'rgba(251,113,133,0.7)' : 'var(--border-soft)',
        }}
      />
      {hint ? (
        <p id={hintId} className="text-muted mt-1 text-[11px]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-[11px]" style={{ color: '#fb7185' }}>
          {error} The previous valid arguments are still in use.
        </p>
      ) : null}
    </div>
  )
}
