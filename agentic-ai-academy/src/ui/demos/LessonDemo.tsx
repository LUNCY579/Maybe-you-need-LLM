import type { DemoId } from '../../types/curriculum'
import { AttentionDemo } from './AttentionDemo'
import { ContextWindowDemo } from './ContextWindowDemo'
import { CurationDemo } from './CurationDemo'
import { DilemmaDemo } from './DilemmaDemo'
import { EscalationDemo } from './EscalationDemo'
import { MemoryDemo } from './MemoryDemo'
import { PatchingDemo } from './PatchingDemo'
import { PlanningDemo } from './PlanningDemo'
import { RetrievalDemo } from './RetrievalDemo'
import { ToolSelectionDemo } from './ToolSelectionDemo'
import { ValenceDemo } from './ValenceDemo'

/**
 * The interactive demonstrations that can be embedded in a lesson.
 *
 * Every one of them is a projection of a tested engine rather than a
 * scripted animation, so what the student manipulates is the same computation
 * the corresponding laboratory runs.
 */
export function LessonDemo({ demo }: { demo: DemoId }) {
  switch (demo) {
    case 'memory':
      return <MemoryDemo />
    case 'planning':
      return <PlanningDemo />
    case 'tool-selection':
      return <ToolSelectionDemo />
    case 'dilemma':
      return <DilemmaDemo />
    case 'context-window':
      return <ContextWindowDemo />
    case 'retrieval':
      return <RetrievalDemo />
    case 'curation':
      return <CurationDemo />
    case 'attention':
      return <AttentionDemo />
    case 'patching':
      return <PatchingDemo />
    case 'escalation':
      return <EscalationDemo />
    case 'valence':
      return <ValenceDemo />
    default:
      // The switch is exhaustive over `DemoId`, so a demonstration added to
      // the registry without a renderer here is a compile error rather than a
      // blank space in the lesson.
      return unreachable(demo)
  }
}

function unreachable(value: never): never {
  throw new Error(`No renderer for the demonstration "${value}"`)
}
