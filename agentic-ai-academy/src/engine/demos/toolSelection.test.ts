import { describe, expect, it } from 'vitest'
import { TOOL_CASES, evaluateToolCall, validateToolCall } from './toolSelection'

const booking = TOOL_CASES.find((entry) => entry.id === 'book-seat')!
const prime = TOOL_CASES.find((entry) => entry.id === 'prime-check')!
const weather = TOOL_CASES.find((entry) => entry.id === 'weather')!

describe('tool argument validation', () => {
  const bookSeat = booking.tools.find((tool) => tool.id === 'book_seat')!

  it('accepts a well-formed call', () => {
    const issues = validateToolCall(bookSeat, { train: '08:40', destination: 'Utrecht', seat: 'window' })
    expect(issues).toEqual([])
  })

  it('reports a missing required argument', () => {
    const issues = validateToolCall(bookSeat, { train: '08:40', destination: 'Utrecht' })
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('error')
    expect(issues[0].argument).toBe('seat')
  })

  it('reports an argument that is not in the schema', () => {
    const issues = validateToolCall(bookSeat, {
      train: '08:40',
      destination: 'Utrecht',
      seat: 'window',
      date: 'Thursday',
    })
    expect(issues.some((issue) => issue.argument === 'date')).toBe(true)
  })

  it('reports a value outside an enumeration', () => {
    const issues = validateToolCall(bookSeat, { train: '08:40', destination: 'Utrecht', seat: 'middle' })
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/must be one of/)
  })

  it('reports a wrong type', () => {
    const isPrime = prime.tools.find((tool) => tool.id === 'is_prime')!
    const issues = validateToolCall(isPrime, { number: 'not a number' })
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/must be a number/)
  })

  it('treats an empty string as missing', () => {
    const issues = validateToolCall(bookSeat, { train: '08:40', destination: 'Utrecht', seat: '   ' })
    expect(issues).toHaveLength(1)
    expect(issues[0].argument).toBe('seat')
  })

  it('does not require optional arguments', () => {
    const search = booking.tools.find((tool) => tool.id === 'search_trains')!
    expect(validateToolCall(search, { from: 'Amsterdam', to: 'Utrecht', day: 'Thursday' })).toEqual([])
  })
})

describe('tool call evaluation', () => {
  it('succeeds on the right tool with the right arguments', () => {
    const result = evaluateToolCall(booking, 'book_seat', { train: '08:40', destination: 'Utrecht', seat: 'window' })
    expect(result.status).toBe('ok')
    expect(result.rightTool).toBe(true)
    expect(result.rightArguments).toBe(true)
    expect(result.output).toBe(booking.result)
  })

  it('rejects an invalid call before the tool runs', () => {
    const result = evaluateToolCall(booking, 'book_seat', { train: '08:40' })
    expect(result.status).toBe('invalid-arguments')
    expect(result.output).toBeNull()
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('explains why a distractor tool is wrong', () => {
    const result = evaluateToolCall(booking, 'search_trains', { from: 'Amsterdam', to: 'Utrecht', day: 'Thursday' })
    expect(result.status).toBe('wrong-tool')
    expect(result.rightTool).toBe(false)
    expect(result.explanation).toMatch(/does not book|schedule/i)
  })

  it('rejects an unknown tool', () => {
    const result = evaluateToolCall(booking, 'no_such_tool', {})
    expect(result.status).toBe('unknown-tool')
    expect(result.output).toBeNull()
  })

  it('succeeds but flags the wrong arguments', () => {
    const result = evaluateToolCall(booking, 'book_seat', { train: '09:15', destination: 'Utrecht', seat: 'window' })
    expect(result.status).toBe('ok')
    expect(result.rightTool).toBe(true)
    expect(result.rightArguments).toBe(false)
  })

  it('gives every case a correct tool and a reason for each distractor', () => {
    for (const toolCase of TOOL_CASES) {
      expect(toolCase.tools.some((tool) => tool.id === toolCase.correctToolId)).toBe(true)
      for (const tool of toolCase.tools) {
        if (tool.id === toolCase.correctToolId) continue
        expect(toolCase.distractors[tool.id], `${toolCase.id}/${tool.id} has no distractor note`).toBeTruthy()
      }
    }
  })

  it('is deterministic', () => {
    const a = evaluateToolCall(weather, 'get_forecast', { location: 'Utrecht', day: 'Thursday' })
    const b = evaluateToolCall(weather, 'get_forecast', { location: 'Utrecht', day: 'Thursday' })
    expect(a).toEqual(b)
  })
})
