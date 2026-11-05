/** Content schema. All prose here is original writing for this project; the book is cited, never copied. */

export type ContentBlock =
  | { kind: 'p'; text: string }
  | { kind: 'eq'; tex: string; caption?: string; ref?: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'callout'; tone: 'insight' | 'warning' | 'limitation' | 'definition'; title: string; text: string }
  | { kind: 'ref'; label: string; note: string }
  /** a live, interactive computation shown next to the prose */
  | { kind: 'figure'; figure: string };

export interface LessonSection {
  heading: string;
  blocks: ContentBlock[];
}

export type ExerciseKind = 'numerical' | 'conceptual' | 'code';

export interface Exercise {
  kind: ExerciseKind;
  prompt: string;
  /** A computed or derivable answer, not a placeholder. */
  answer: string;
  hint?: string;
  /**
   * Key of a computed answer in `src/lib/exercises.ts`. When present, the
   * exercise becomes guided: the learner may type a number and have it checked
   * against the live computation made by the same code the laboratories run.
   */
  computed?: string;
  /** The tolerance for the check, overriding the registry's default. */
  computedTolerance?: number;
}

export interface Lesson {
  id: string;
  order: number;
  title: string;
  /** book chapters/sections this lesson is built on */
  chapter: string;
  minutes: number;
  tier: 'foundation' | 'core' | 'advanced';
  summary: string;
  objectives: string[];
  prerequisites: string[];
  sections: LessonSection[];
  experiment?: { route: string; note: string };
  /**
   * Further laboratories that make the same lesson concrete. A lesson often
   * has more than one natural experiment — the loss landscape and the neural
   * tangent kernel are two readings of the same argument — and the reader
   * should be able to reach them from the lesson as well as from the rail.
   */
  alsoExperiments?: Array<{ route: string; note: string }>;
  exercises: Exercise[];
  citations: Array<{ label: string; note: string }>;
}

export interface EquationEntry {
  id: string;
  title: string;
  tex: string;
  /** where it comes from in the source */
  ref: string;
  /** the quantity computed */
  meaning: string;
  symbols: Array<{ symbol: string; meaning: string }>;
  assumptions: string[];
  derivation: string[];
  /** an example numeric substitution, evaluated for real by the lab */
  example: { inputs: Array<{ name: string; value: string }>; result: string; note?: string };
  relatedLab?: string;
}

export type QuizDifficulty = 'warmup' | 'core' | 'hard';

export interface QuizQuestion {
  id: string;
  lessonId: string;
  difficulty: QuizDifficulty;
  prompt: string;
  /** rendered with KaTeX if it contains $...$ */
  options: string[];
  answerIndex: number;
  explanation: string;
  /** optional numeric answer for "compute this" questions */
  numeric?: { answer: number; tolerance: number; unit?: string };
  citations: string[];
}

export interface ExperimentPreset {
  id: string;
  name: string;
  lab: 'initialization' | 'landscape' | 'width-depth' | 'ntk' | 'representation' | 'physics';
  hypothesis: string;
  description: string;
  settings: Record<string, number | string | boolean>;
  expected: string;
  /**
   * The numbers the expected outcome states, where they are measurements the
   * application can make. A test recomputes them, so a gallery cannot quote a
   * number the application does not produce.
   */
  measured?: Array<{ width: number; relativeError: number; tolerance: number }>;
  seed: number;
}
