/**
 * The registered diagram identifiers.
 *
 * The list is the single source of truth: the `DiagramId` type is derived from
 * it, the renderer is typed against it, and the content validator checks that
 * every diagram a lesson refers to is in it. A new diagram therefore has to
 * be added here, and cannot be silently forgotten.
 */
export const DIAGRAM_IDS = [
  'llm-transformer',
  'training-pipeline',
  'scaling-curve',
  'harness-loop',
  'react-cycle',
  'reflection-loop',
  'vlm-architecture',
  'world-model-loop',
  'memory-layers',
  'mcp-topology',
  'rag-pipeline',
  'multi-agent-roles',
  'emergent-society',
  'interpretability-levels',
] as const
