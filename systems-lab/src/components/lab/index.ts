import type { ComponentType } from 'react'
import { AttentionLab, ATTENTION_VIEWS } from './AttentionLab'
import { KvCacheLab, KVCACHE_VIEWS } from './KvCacheLab'
import { MoeLab, MOE_VIEWS } from './MoeLab'
import { QuantisationLab, QUANTISATION_VIEWS } from './QuantisationLab'
import { SpeculativeLab, SPECULATIVE_VIEWS } from './SpeculativeLab'
import { FineTuneLab, FINETUNE_VIEWS } from './FineTuneLab'

/**
 * The screen for each registered laboratory id.
 *
 * A record rather than a chain of conditionals, so that the test over the registry
 * can ask one question — is there a screen for every id, and an id for every screen —
 * and answer it for all six at once.
 *
 * The key is the route segment: `/labs/quantisation` renders the fourth value here,
 * and `src/content/labs.ts` is the list of keys this one has to cover.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  attention: AttentionLab,
  kvcache: KvCacheLab,
  moe: MoeLab,
  quantisation: QuantisationLab,
  speculative: SpeculativeLab,
  finetune: FineTuneLab,
}

/**
 * The tabs each screen offers, read off the screen itself.
 *
 * A lesson deep-links to one of these by name, so this is the list the curriculum
 * is checked against: a lesson that asks for a view the screen does not have is a
 * link that would quietly open the wrong panel.
 */
export const LAB_VIEWS: Record<string, readonly { value: string; label: string }[]> = {
  attention: ATTENTION_VIEWS,
  kvcache: KVCACHE_VIEWS,
  moe: MOE_VIEWS,
  quantisation: QUANTISATION_VIEWS,
  speculative: SPECULATIVE_VIEWS,
  finetune: FINETUNE_VIEWS,
}
