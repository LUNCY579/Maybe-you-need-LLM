/**
 * Tool selection and argument validation.
 *
 * Chapter 11 argues three things about tool interfaces, and this engine makes
 * each of them something the student can *do* rather than read:
 *
 *  1. **Discriminability.** A model chooses between tools by reading their
 *     descriptions. Two descriptions that do not distinguish the tools make the
 *     choice arbitrary.
 *  2. **Arity clarity.** If every tool takes one free-text `query`, the model
 *     has no way to learn the shape of the input and will invent arguments.
 *  3. **Failure signalling.** An error that reads like a result will be
 *     treated as data and built into a plan.
 *
 * The student picks a tool for a goal, fills in the arguments, and the engine
 * reports what the harness would have done: which arguments are missing, which
 * are of the wrong type, whether the right tool was chosen, and what the tool
 * actually returned.
 *
 * Everything is deterministic and scripted. No model is called.
 */

export type ArgumentType = 'string' | 'number' | 'boolean'

export interface ToolArgument {
  name: string
  type: ArgumentType
  description: string
  required: boolean
  /** Accepted values, when the argument is an enumeration. */
  oneOf?: string[]
}

export interface ToolSpec {
  id: string
  name: string
  description: string
  args: ToolArgument[]
  /** What the tool returns on success. */
  returns: string
}

export interface ToolCase {
  id: string
  goal: string
  /** The situation the student is in. */
  context: string
  tools: ToolSpec[]
  /** The tool the harness should use. */
  correctToolId: string
  /** The arguments a correct call needs. */
  expectedArgs: Record<string, string>
  /** Why each wrong tool is wrong. */
  distractors: Record<string, string>
  /** The output of the correct call. */
  result: string
}

export type IssueLevel = 'error' | 'warning'

export interface ValidationIssue {
  level: IssueLevel
  /** Which argument the issue is about, when it is about one. */
  argument?: string
  message: string
}

export type CallStatus = 'ok' | 'wrong-tool' | 'invalid-arguments' | 'unknown-tool'

export interface ToolCallResult {
  status: CallStatus
  issues: ValidationIssue[]
  /** The tool's output, when the call succeeded. */
  output: string | null
  /** A one-sentence explanation of what happened. */
  explanation: string
  /** True when the chosen tool was the intended one. */
  rightTool: boolean
  /** True when the arguments were exactly right. */
  rightArguments: boolean
}

/**
 * Validate a call against a tool's argument schema.
 *
 * The rules are the ones a harness would apply: required arguments must be
 * present, values must have the declared type, and enumeration arguments must
 * hold one of the permitted values.
 */
export function validateToolCall(tool: ToolSpec, args: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const argument of tool.args) {
    const raw = args[argument.name]
    const present = raw !== undefined && raw.trim() !== ''

    if (!present) {
      if (argument.required) {
        issues.push({
          level: 'error',
          argument: argument.name,
          message: `Missing required argument "${argument.name}" — ${argument.description}`,
        })
      }
      continue
    }

    if (argument.type === 'number' && Number.isNaN(Number(raw))) {
      issues.push({
        level: 'error',
        argument: argument.name,
        message: `Argument "${argument.name}" must be a number, but "${raw}" is not.`,
      })
    }

    if (argument.type === 'boolean' && !['true', 'false'].includes(raw.trim().toLowerCase())) {
      issues.push({
        level: 'error',
        argument: argument.name,
        message: `Argument "${argument.name}" must be true or false, but "${raw}" is not.`,
      })
    }

    if (argument.oneOf && !argument.oneOf.includes(raw)) {
      issues.push({
        level: 'error',
        argument: argument.name,
        message: `Argument "${argument.name}" must be one of ${argument.oneOf.join(', ')} — "${raw}" is not.`,
      })
    }
  }

  for (const name of Object.keys(args)) {
    if (!tool.args.some((argument) => argument.name === name)) {
      issues.push({
        level: 'error',
        argument: name,
        message: `Argument "${name}" is not part of the schema for ${tool.name}.`,
      })
    }
  }

  return issues
}

/** Evaluate a call: is it the right tool, are the arguments right, what happens. */
export function evaluateToolCall(
  toolCase: ToolCase,
  toolId: string,
  args: Record<string, string>,
): ToolCallResult {
  const tool = toolCase.tools.find((candidate) => candidate.id === toolId)

  if (!tool) {
    return {
      status: 'unknown-tool',
      issues: [{ level: 'error', message: `No tool with id "${toolId}" is available in this scenario.` }],
      output: null,
      explanation: 'The harness cannot call a tool that is not in the catalogue.',
      rightTool: false,
      rightArguments: false,
    }
  }

  const issues = validateToolCall(tool, args)
  const rightTool = tool.id === toolCase.correctToolId

  if (issues.length > 0) {
    return {
      status: 'invalid-arguments',
      issues,
      output: null,
      explanation: `The call was rejected before the tool ran: ${issues[0].message}`,
      rightTool,
      rightArguments: false,
    }
  }

  if (!rightTool) {
    return {
      status: 'wrong-tool',
      issues,
      output: null,
      explanation: toolCase.distractors[tool.id] ?? `${tool.name} is not the right tool for this goal.`,
      rightTool,
      rightArguments: false,
    }
  }

  const rightArguments = Object.entries(toolCase.expectedArgs).every(
    ([name, value]) => (args[name] ?? '').trim() === value.trim(),
  )

  return {
    status: 'ok',
    issues,
    output: toolCase.result,
    explanation: rightArguments
      ? 'The call succeeded. The harness appends the result to the context as an observation.'
      : 'The call succeeded, but the arguments were not the ones the task needed, so the result does not answer the goal.',
    rightTool,
    rightArguments,
  }
}

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

export const TOOL_CASES: ToolCase[] = [
  {
    id: 'book-seat',
    goal: 'Book a window seat on the 08:40 train to Utrecht for Thursday.',
    context:
      'The user has already said: "I need to travel to Utrecht on Thursday morning for a client meeting", and earlier asked for a window seat. The agent can pick the seat.',
    correctToolId: 'book_seat',
    expectedArgs: { train: '08:40', destination: 'Utrecht', seat: 'window' },
    result: 'Seat 14A booked: 08:40 to Utrecht, window, coach 2.',
    distractors: {
      search_trains: 'Searching for trains only reports the schedule; it does not book anything, so the task would not be completed.',
      read_policy: 'Reading the carriage policy is useful context but makes no progress towards the booking.',
      book_seat_legacy: 'This is the retired booking tool. It still returns a confirmation, but the seat is not held — the agent would report a booking that does not exist.',
    },
    tools: [
      {
        id: 'search_trains',
        name: 'search_trains',
        description: 'List the trains that run between two stations on a given weekday. Read-only.',
        args: [
          { name: 'from', type: 'string', description: 'Origin station.', required: true },
          { name: 'to', type: 'string', description: 'Destination station.', required: true },
          { name: 'day', type: 'string', description: 'Weekday, e.g. "Thursday".', required: true },
        ],
        returns: 'A list of departures with arrival times.',
      },
      {
        id: 'read_policy',
        name: 'read_policy',
        description: 'Read the carriage and seat policy for a journey.',
        args: [{ name: 'journey', type: 'string', description: 'The journey reference.', required: true }],
        returns: 'The policy text.',
      },
      {
        id: 'book_seat',
        name: 'book_seat',
        description: 'Reserve a seat on a specific departure.',
        args: [
          { name: 'train', type: 'string', description: 'Departure time of the train.', required: true },
          { name: 'destination', type: 'string', description: 'Station to travel to.', required: true },
          {
            name: 'seat',
            type: 'string',
            description: 'Seat preference.',
            required: true,
            oneOf: ['window', 'aisle'],
          },
        ],
        returns: 'A confirmation with the seat number.',
      },
      {
        id: 'book_seat_legacy',
        name: 'book_seat_legacy',
        description: 'Reserve a seat on a specific departure.',
        args: [
          { name: 'train', type: 'string', description: 'Departure time of the train.', required: true },
          { name: 'destination', type: 'string', description: 'Station to travel to.', required: true },
          {
            name: 'seat',
            type: 'string',
            description: 'Seat preference.',
            required: true,
            oneOf: ['window', 'aisle'],
          },
        ],
        returns: 'A confirmation with the seat number.',
      },
    ],
  },
  {
    id: 'prime-check',
    goal: 'Determine whether 8191 is prime and report the answer.',
    context:
      'The user asks a single arithmetic question. The answer must be verified rather than asserted, because a wrong answer here is silently plausible.',
    correctToolId: 'is_prime',
    expectedArgs: { number: '8191' },
    result: 'is_prime(8191) = True',
    distractors: {
      compute: 'Computing something else does not answer the question, and the agent would end up guessing.',
      lookup_table: 'The lookup table only holds pre-computed values up to 4096, so it returns nothing for 8191.',
      is_prime_approx: 'The approximate tool returns a probability, not a determination, so the agent cannot report a yes or no.',
    },
    tools: [
      {
        id: 'compute',
        name: 'compute',
        description: 'Evaluate an arithmetic expression.',
        args: [{ name: 'expression', type: 'string', description: 'The expression to evaluate.', required: true }],
        returns: 'The numeric result.',
      },
      {
        id: 'lookup_table',
        name: 'lookup_table',
        description: 'Look up a pre-computed value by key.',
        args: [
          { name: 'key', type: 'string', description: 'The key to look up.', required: true },
          { name: 'domain', type: 'string', description: 'The table domain.', required: true },
        ],
        returns: 'The stored value, or nothing.',
      },
      {
        id: 'is_prime',
        name: 'is_prime',
        description: 'Test whether an integer is prime, by trial division.',
        args: [{ name: 'number', type: 'number', description: 'The integer to test.', required: true }],
        returns: 'True or False.',
      },
      {
        id: 'is_prime_approx',
        name: 'is_prime_approx',
        description: 'Estimate whether an integer is prime.',
        args: [{ name: 'number', type: 'number', description: 'The integer to test.', required: true }],
        returns: 'A probability between 0 and 1.',
      },
    ],
  },
  {
    id: 'weather',
    goal: 'Answer whether the walk to the client meeting will be wet.',
    context:
      'The forecast tool covers only the next 48 hours. The meeting is on Thursday, which is outside that window, so the tool has to be used with a date it can actually answer for.',
    correctToolId: 'get_forecast',
    expectedArgs: { location: 'Utrecht', day: 'Thursday' },
    result: 'Utrecht, Thursday: heavy rain in the afternoon, 14°C, 80% chance of precipitation.',
    distractors: {
      get_current: 'The current conditions do not say anything about Thursday.',
      get_forecast_48h: 'This tool only covers 48 hours, so it cannot answer for Thursday.',
    },
    tools: [
      {
        id: 'get_current',
        name: 'get_current',
        description: 'The current weather at a location.',
        args: [{ name: 'location', type: 'string', description: 'The location.', required: true }],
        returns: 'The current conditions.',
      },
      {
        id: 'get_forecast_48h',
        name: 'get_forecast_48h',
        description: 'The forecast for the next 48 hours at a location.',
        args: [{ name: 'location', type: 'string', description: 'The location.', required: true }],
        returns: 'Hourly forecast for the next 48 hours.',
      },
      {
        id: 'get_forecast',
        name: 'get_forecast',
        description: 'The daily forecast for a location on a named day.',
        args: [
          { name: 'location', type: 'string', description: 'The location.', required: true },
          { name: 'day', type: 'string', description: 'The day of the week.', required: true },
        ],
        returns: 'A daily summary: conditions, temperature, precipitation chance.',
      },
    ],
  },
]

export const TOOL_CASE_BY_ID = new Map(TOOL_CASES.map((entry) => [entry.id, entry]))
