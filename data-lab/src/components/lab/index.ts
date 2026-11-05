import type { ComponentType } from 'react'
import { LABS } from '../../content/labs'
import { PipelineLab } from './PipelineLab'
import { DedupLab } from './DedupLab'
import { MixtureLab } from './MixtureLab'
import { CollapseLab } from './CollapseLab'
import { MidasLab } from './MidasLab'
import { BudgetLab } from './BudgetLab'
import { RefinementLab } from './RefinementLab'
import { ProxyLab } from './ProxyLab'

/**
 * The screens, keyed by the registry id.
 *
 * The registry in `content/labs.ts` says what exists; this file says where the
 * code for it is. Splitting the two keeps the registry free of components — the
 * audit reads it as text, the lessons import it into links — while the gallery
 * and the screen test both cover every laboratory by mapping over one list
 * rather than by naming each of them, which is how a screen used to end up with
 * a card and no component behind it.
 */
export const LAB_SCREENS: Readonly<Record<string, ComponentType>> = {
  pipeline: PipelineLab,
  dedup: DedupLab,
  mixture: MixtureLab,
  collapse: CollapseLab,
  midas: MidasLab,
  budget: BudgetLab,
  refinement: RefinementLab,
  proxy: ProxyLab,
}

/**
 * The labels of each screen's view toggle, in the order the toggle shows them.
 *
 * Written out rather than read off the component so that the test can click
 * every view of every laboratory: a screen that gains a view without declaring
 * it here gets a failing test, not an unvisited view.
 */
export const LAB_VIEWS: Readonly<Record<string, readonly string[]>> = {
  pipeline: ['The pipeline', 'The stages', 'The perplexity', 'The ablation', 'The curves'],
  dedup: ['The near-duplicates', 'The decontamination'],
  mixture: ['The mixtures', 'The optimisation', 'One component at a time'],
  collapse: ['The generations', 'The floor'],
  midas: ['The similar documents', 'The adaptive cut', 'The two views'],
  budget: ['The five rows', 'The three gains', 'How a row is drawn'],
  refinement: ['The passes', 'One pass against four'],
  proxy: ['The handover', 'The trip'],
}

/** Every laboratory that has both a declaration and a screen, in gallery order. */
export const LAB_GALLERY = LABS.filter((lab) => lab.id in LAB_SCREENS).sort((a, b) =>
  a.name.localeCompare(b.name),
)

/** The screen for this registry id, or undefined when the declaration has no code. */
export function labScreen(id: string): ComponentType | undefined {
  return LAB_SCREENS[id]
}
