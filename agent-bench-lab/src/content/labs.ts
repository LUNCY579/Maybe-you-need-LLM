/**
 * The laboratory registry.
 *
 * Each entry names a screen and the promises from `references/manifest.json`
 * that the screen is responsible for. The strings in `delivers` are copied
 * from the manifest exactly: the coverage audit treats a registry entry as the
 * application's own claim, and a claim near the wording is not the same claim.
 */

export interface Lab {
  id: string
  name: string
  blurb: string
  /** The manifest items this screen computes and shows. */
  delivers: string[]
  /** The sources the screen's argument comes from. */
  sources: string[]
}

export const LABS: Lab[] = [
  {
    id: 'design',
    name: 'A · The task set',
    blurb: 'What a score on a task set means, how large a task is, and what GAIA’s levels ask for.',
    delivers: [
      'Resolution rate as a function of file size',
      'The three question levels',
      'Question difficulty versus tool count',
    ],
    sources: ['jimenez-2023-swebench', 'mialon-2023-gaia'],
  },
  {
    id: 'verifier',
    name: 'B · The verifier',
    blurb: 'The criterion and the cheat, and what each half of the harness decides.',
    delivers: ['The test-based verification harness'],
    sources: ['jimenez-2023-swebench'],
  },
  {
    id: 'baselines',
    name: 'C · The baselines',
    blurb: 'What a score has to beat, what the beating costs, and whether it repeats.',
    delivers: [
      'The agentless baseline',
      'Pass^k: reliability across repeated trials rather than a single pass rate',
    ],
    sources: ['jimenez-2023-swebench', 'yao-2024-taubench'],
  },
  {
    id: 'contamination',
    name: 'D · Contamination',
    blurb: 'Whether the model has seen it.',
    delivers: [],
    sources: ['jimenez-2023-swebench'],
  },
  {
    id: 'environments',
    name: 'E · The environments',
    blurb: 'Eight worlds, one average, and whether the world can be replayed.',
    delivers: [
      'Cross-environment score profiles',
      'Why a single average hides the failure modes',
      'Reproducibility as a benchmark property',
    ],
    sources: ['liu-2023-agentbench', 'zhou-2024-webarena'],
  },
]

export const LAB_IDS = LABS.map((lab) => lab.id)
export const LAB_DELIVERIES = LABS.flatMap((lab) => lab.delivers)

export function labById(id: string): Lab | undefined {
  return LABS.find((lab) => lab.id === id)
}
