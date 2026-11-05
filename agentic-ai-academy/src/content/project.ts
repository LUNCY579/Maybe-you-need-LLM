/**
 * The final practical project.
 *
 * The textbook assesses four case studies in person (Ch. 5, 10, 14, 18). This
 * course replaces them with one end-to-end project of the student's own,
 * assessed on evaluation discipline rather than demo polish.
 *
 * The rubric below is derived from the book's own evaluation chapters:
 * Ch. 15 (probing behaviour experimentally), Ch. 23 (state of the field and
 * responsibility), Ch. 11 (tool safety) and Ch. 22 (levels of evidence).
 */

export interface RubricCriterion {
  id: string
  title: string
  /** What a strong submission shows for this criterion. */
  detail: string
  /** Where the textbook supports the criterion. */
  source: string
  maxPoints: number
  /** The evidence in this course that the criterion is being exercised. */
  evidenceHint: string
}

export const RUBRIC: RubricCriterion[] = [
  {
    id: 'measurement',
    title: 'Measurement over claims',
    detail:
      'A frozen evaluation set, at least one baseline, and reported error classes. Separate planning errors from execution errors, and report the number of runs rather than a single trace.',
    source: 'Ch. 15, §15.2; Ch. 23, §23.1',
    maxPoints: 4,
    evidenceHint: 'Run every laboratory and record their outcomes.',
  },
  {
    id: 'harness',
    title: 'A documented harness',
    detail:
      'The loop, the tools with their argument schemas, the memory design, the termination condition and the error-recovery policy are written down before the code is written.',
    source: 'Ch. 1, §1.2.2; Ch. 9, §9.2.1; Ch. 11, §11.2',
    maxPoints: 4,
    evidenceHint: 'Build a workflow in the builder and record its execution trace.',
  },
  {
    id: 'traceability',
    title: 'Traceability to the book',
    detail:
      'Every design decision you adopt from the book carries a chapter and section reference, and every claim you make about an agent is labelled by evidence level.',
    source: 'Ch. 22, §22.1.1',
    maxPoints: 3,
    evidenceHint: 'Complete the lessons in Parts I–IV and cite their sections.',
  },
  {
    id: 'honesty',
    title: 'Honest labelling',
    detail:
      'Simulations are labelled as simulations, limitations are stated before they are discovered, and a deterministic teaching instrument is never presented as deployed model behaviour.',
    source: 'Ch. 15, §15.1; Ch. 22, §22.1.2',
    maxPoints: 4,
    evidenceHint: 'Complete the evaluation-discipline section of the final lesson.',
  },
  {
    id: 'safety',
    title: 'Least privilege and error recovery',
    detail:
      'Tools are scoped to the minimum they need, irreversible actions require confirmation, and tool output is treated as untrusted data rather than as instructions.',
    source: 'Ch. 11, §11.5–11.6; Ch. 17, §17.5',
    maxPoints: 4,
    evidenceHint: 'Run the broken-pipeline scenario in the builder and read the error states.',
  },
  {
    id: 'reproducibility',
    title: 'Reproducibility',
    detail:
      'The harness configuration, the model version and the seeds are recorded with every result, so a reader can reproduce the run rather than take it on trust.',
    source: 'Ch. 5, §5.8; Ch. 23, §23.1',
    maxPoints: 3,
    evidenceHint: 'Export your progress and note the exact scenario configuration.',
  },
]

export const RUBRIC_MAX_POINTS = RUBRIC.reduce((sum, criterion) => sum + criterion.maxPoints, 0)

export interface ProjectMilestone {
  id: string
  title: string
  detail: string
  /** The lesson or lab that supports this milestone. */
  reference: string
}

export const PROJECT_MILESTONES: ProjectMilestone[] = [
  {
    id: 'm1',
    title: '1 · Choose a task with a verifiable outcome',
    detail:
      'Pick a task where success can be measured without human judgement: a small grid world, a ticket-routing problem, a retrieval QA set with known answers, or a diagnosis pipeline with separable planner and executor steps.',
    reference: 'Ch. 10, §10.3 (verifiable rewards make evaluation cheap)',
  },
  {
    id: 'm2',
    title: '2 · Specify the harness',
    detail:
      'Write down the loop, the tools with their argument schemas, the memory design, the termination condition and the error-recovery policy. Name the interaction style (Ch. 9) you are implementing.',
    reference: 'Ch. 1, §1.2.2; Ch. 9, §9.2.1',
  },
  {
    id: 'm3',
    title: '3 · Implement the workflow in the builder, then port it',
    detail:
      'Prototype in the Visual Agent Workflow Builder, execute it on the tool-use and reflection scenarios, and record the traces. Then implement the same control flow in code.',
    reference: 'Ch. 6, §6.2.4 (the harness as a prompt improver)',
  },
  {
    id: 'm4',
    title: '4 · Evaluate with the case-study discipline',
    detail:
      'Frozen scenario set, full traces, error taxonomy with counts, cost per run, and at least one baseline. Report planning errors separately from execution errors.',
    reference: 'Ch. 10, §10.3; Ch. 14, §14.4',
  },
  {
    id: 'm5',
    title: '5 · Reflect and document',
    detail:
      'State honestly what worked, what failed, which results are behavioural only, and which parts are simulations rather than deployed model behaviour. Include the licence notes for anything third-party you used.',
    reference: 'Ch. 22, §22.1.1–22.1.2; Ch. 23, §23.1',
  },
]

export const DELIVERABLES = [
  'A working agent (simulated or model-backed) with a documented harness.',
  'A frozen evaluation set and a results table with a baseline.',
  'An execution trace for one success and one failure, annotated.',
  'A short written reflection using the levels-of-evidence framing (Ch. 22).',
  'A provenance/licence note for every external asset used.',
]

/** A suggested brief the student can adapt. */
export const PROJECT_BRIEF: {
  title: string
  body: string
  reference: string
  /** The demonstration that most directly supports this brief. */
  demo?: 'tool-selection' | 'memory' | 'planning' | 'dilemma'
}[] = [
  {
    title: 'Brief A · A retrieval-backed assistant with a verifier',
    body:
      'Build an assistant that answers questions from a small fixed corpus. It must decide *whether* to retrieve, verify its answer against the retrieved text, and fall back to "I cannot answer from the corpus" when verification fails. Success is a decision, not a judgement: does the pipeline answer exactly when the corpus supports an answer?',
    reference: 'Ch. 12, §12.4 (adaptive retrieval) and §12.7 (evaluation)',
    demo: 'tool-selection',
  },
  {
    title: 'Brief B · A tool-using agent with a broken-tool policy',
    body:
      'Build an agent that calls an external tool which fails some of the time. Specify the error taxonomy, the retry budget, and the point at which the agent gives up and reports the limitation. Success is whether the agent avoids infinite loops and never reports a tool result it did not receive.',
    reference: 'Ch. 11, §11.5 (robustness and recovery) and Ch. 6, §6.3.1 (brittleness)',
    demo: 'tool-selection',
  },
  {
    title: 'Brief C · A multi-agent pipeline with a handoff contract',
    body:
      'Build a small team — planner, researcher, executor, verifier — with an explicit handoff contract between roles. Measure how often the verifier catches an executor error, and how often a bad handoff produces confident nonsense.',
    reference: 'Ch. 16, §16.3.1 (complementary pairs) and Ch. 14, §14.2 (diagnosis pipeline)',
    demo: 'dilemma',
  },
  {
    title: 'Brief D · An agent that remembers, and forgets on purpose',
    body:
      'Build an agent with an explicit memory store, and show what it loses when the store is full. Define the write policy, the eviction policy and the retrieval policy separately, then show a case where each of them is the thing that fails.',
    reference: 'Ch. 9, §9.3.2 (memory architectures) and Ch. 6, §6.2.4.2 (reflexion)',
    demo: 'memory',
  },
]
