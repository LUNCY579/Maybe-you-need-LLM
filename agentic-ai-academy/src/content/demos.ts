/**
 * The interactive demonstrations the course contains.
 *
 * This list is the source of truth, and the `DemoId` type is derived from it,
 * in the same way the diagram identifiers are. A demonstration therefore
 * cannot be added to the renderer without the content validator knowing
 * about it, and a lesson cannot reference a demonstration that does not
 * exist.
 *
 * Every one of these is a projection of a tested engine rather than a
 * scripted animation, so what the student manipulates is the same
 * computation the corresponding laboratory runs.
 */
export const DEMO_IDS = [
  'planning',
  'memory',
  'tool-selection',
  'dilemma',
  'context-window',
  'retrieval',
  'curation',
  'attention',
  'patching',
  'escalation',
  'valence',
] as const

export type DemoId = (typeof DEMO_IDS)[number]
