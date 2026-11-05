import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { LessonMeta } from '../curriculum'

export interface LessonBodyProps {
  lesson: LessonMeta
}

export type LessonRegistry = Record<string, ComponentType<LessonBodyProps>>

/**
 * Where each lesson body lives.
 *
 * The bodies are grouped by module, and each group is loaded on its own. A
 * reader who works through the pre-training module downloads that module's
 * three lessons and no more; without the split, opening any lesson would
 * download the prose of all eighteen.
 *
 * The loaders are the single place where a lesson id is bound to the
 * component that renders it, so the content test and the application cannot
 * disagree about which body belongs to which lesson.
 */
export const LESSON_LOADERS: Record<
  string,
  () => Promise<{ default: ComponentType<LessonBodyProps> }>
> = {
  'pretraining-why': () => import('./preTraining').then((m) => ({ default: m.WhyLesson })),
  'pretraining-objectives': () => import('./preTraining').then((m) => ({ default: m.ObjectivesLesson })),
  'pretraining-bert': () => import('./preTraining').then((m) => ({ default: m.BertLesson })),
  'generative-transformer': () =>
    import('./generative').then((m) => ({ default: m.TransformerLesson })),
  'generative-scaling': () => import('./generative').then((m) => ({ default: m.ScalingLesson })),
  'generative-long-context': () =>
    import('./generative').then((m) => ({ default: m.LongContextLesson })),
  'prompting-design': () => import('./prompting').then((m) => ({ default: m.DesignLesson })),
  'prompting-cot': () => import('./prompting').then((m) => ({ default: m.CotLesson })),
  'prompting-rag': () => import('./prompting').then((m) => ({ default: m.RagLesson })),
  'alignment-sft': () => import('./alignment').then((m) => ({ default: m.SftLesson })),
  'alignment-rlhf': () => import('./alignment').then((m) => ({ default: m.RlhfLesson })),
  'alignment-dpo': () => import('./alignment').then((m) => ({ default: m.DpoLesson })),
  'inference-prefill-decode': () =>
    import('./inference').then((m) => ({ default: m.PrefillLesson })),
  'inference-decoding': () => import('./inference').then((m) => ({ default: m.DecodingLesson })),
  'inference-scaling': () =>
    import('./inference').then((m) => ({ default: m.ScalingLesson })),
  'reasoning-compute': () => import('./reasoning').then((m) => ({ default: m.ReasoningComputeLesson })),
  'reasoning-training': () =>
    import('./reasoning').then((m) => ({ default: m.LearningReasonLesson })),
  'reasoning-evaluation': () =>
    import('./reasoning').then((m) => ({ default: m.EvaluationLesson })),
}

/**
 * The bodies, each loaded on demand.
 *
 * The application uses this. The content test uses \`LESSON_LOADERS\`, so that
 * it renders the very component the application renders rather than a copy of
 * it.
 */
export const LESSON_BODIES: Record<
  string,
  LazyExoticComponent<ComponentType<LessonBodyProps>>
> = Object.fromEntries(
  Object.entries(LESSON_LOADERS).map(([id, load]) => [
    id,
    lazy(load) as LazyExoticComponent<ComponentType<LessonBodyProps>>,
  ]),
)
