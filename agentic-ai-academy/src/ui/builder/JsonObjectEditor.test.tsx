import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JsonObjectEditor } from './JsonObjectEditor'

describe('the JSON argument editor', () => {
  it('shows the current value when it opens', () => {
    render(<JsonObjectEditor label="Arguments (JSON)" value={{ query: '{goal}' }} onChange={() => {}} />)
    expect(screen.getByLabelText('Arguments (JSON)')).toHaveValue(JSON.stringify({ query: '{goal}' }, null, 2))
  })

  it('keeps half-typed JSON on screen and says why it is not applied', () => {
    const onChange = vi.fn()
    render(<JsonObjectEditor label="Arguments (JSON)" value={{ query: '{goal}' }} onChange={onChange} />)
    const field = screen.getByLabelText('Arguments (JSON)')

    fireEvent.change(field, { target: { value: '{"query": ' } })

    expect(field).toHaveValue('{"query": ')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/previous valid arguments are still in use/i)
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('applies a complete object and clears the error', () => {
    const onChange = vi.fn()
    render(<JsonObjectEditor label="Arguments (JSON)" value={{ query: '{goal}' }} onChange={onChange} />)
    const field = screen.getByLabelText('Arguments (JSON)')

    fireEvent.change(field, { target: { value: '{"query": ' } })
    fireEvent.change(field, { target: { value: '{"query": "{goal}"}' } })

    expect(onChange).toHaveBeenLastCalledWith({ query: '{goal}' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the text the student typed once the value is applied', () => {
    // The editor must not reformat the field under the cursor: the student's
    // text is what stays on screen, not a re-serialised copy of it.
    const onChange = vi.fn()
    const { rerender } = render(
      <JsonObjectEditor label="Arguments (JSON)" value={{ number: '8191' }} onChange={onChange} />,
    )
    const field = screen.getByLabelText('Arguments (JSON)')

    fireEvent.change(field, { target: { value: '{"number": "8191"}' } })
    rerender(<JsonObjectEditor label="Arguments (JSON)" value={{ number: '8191' }} onChange={onChange} />)

    expect(field).toHaveValue('{"number": "8191"}')
  })

  it('keeps the formatting the student chose when their own edit reaches the parent', () => {
    // Adding a key changes the value coming back down, so the effect that
    // reloads the text has to tell this edit apart from a node switch. The
    // field keeps the compact text as typed instead of a re-serialisation of
    // the same object, which would move the caret and the line breaks.
    const onChange = vi.fn()
    const { rerender } = render(
      <JsonObjectEditor label="Arguments (JSON)" value={{ number: '8191' }} onChange={onChange} />,
    )
    const field = screen.getByLabelText('Arguments (JSON)')

    fireEvent.change(field, { target: { value: '{"number": "8191", "note": "mersenne"}' } })
    expect(onChange).toHaveBeenLastCalledWith({ number: '8191', note: 'mersenne' })

    rerender(
      <JsonObjectEditor
        label="Arguments (JSON)"
        value={{ number: '8191', note: 'mersenne' }}
        onChange={onChange}
      />,
    )

    expect(field).toHaveValue('{"number": "8191", "note": "mersenne"}')
  })

  it('replaces the text when the value changes from outside', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <JsonObjectEditor label="Arguments (JSON)" value={{ number: '8191' }} onChange={onChange} />,
    )
    const field = screen.getByLabelText('Arguments (JSON)')

    fireEvent.change(field, { target: { value: '{"number": ' } })
    rerender(<JsonObjectEditor label="Arguments (JSON)" value={{ number: '4096' }} onChange={onChange} />)

    expect(field).toHaveValue(JSON.stringify({ number: '4096' }, null, 2))
  })
})
