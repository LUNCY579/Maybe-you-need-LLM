import type { ModuleId } from './curriculum'

/**
 * How settled each part of the course is.
 *
 * The course is an adaptation of the fourth revision of *Foundations of Large
 * Language Models* (Xiao and Zhu), which is dated 8 October 2026. A book that
 * recent cannot have been overtaken by the literature — but the literature is
 * moving faster than any book, and a reader deserves to know which of the
 * course's claims are settled, which are settling, and which are open.
 *
 * So each module carries two things: what the book establishes, and what is
 * still moving. The sources are the primary ones, not the summaries.
 *
 * The point is not to undermine the course. It is to let the reader place it:
 * a mechanism that has been stable for a decade is a different kind of thing
 * from a result that is three months old, and a course that says which is
 * which is more useful than one that does not.
 */

/**
 * The date the sources below were last checked.
 *
 * A page that claims to know what is current has to say when it last looked.
 * The date is not written by hand: `tools/checkLinks.mjs` writes it, and only
 * after every source has been found to resolve and to be the current revision
 * of its paper. So the date cannot claim a currency the check did not find.
 */
export const STATUS_CHECKED_ON = '2026-10-21'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The checked-on date, written the way the rest of the course writes dates. */
export const STATUS_CHECKED_LABEL = (() => {
  const [year, month, day] = STATUS_CHECKED_ON.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
})()

export type Confidence = 'settled' | 'settling' | 'moving' | 'open'

export interface StatusSource {
  label: string
  href: string
  /** What the source says, in one sentence. */
  note: string
}

export interface ModuleStatus {
  moduleId: ModuleId
  /** How firmly the module's content is established. */
  confidence: Confidence
  /** What the book establishes, and why it holds. */
  settled: string
  /** What is still moving, and what would change the advice. */
  moving: string
  /** The primary sources for the moving part. */
  sources: StatusSource[]
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  settled: 'Settled',
  settling: 'Settling',
  moving: 'Moving',
  open: 'Open',
}

export const CONFIDENCE_TONE: Record<Confidence, 'teal' | 'amber' | 'rose'> = {
  settled: 'teal',
  settling: 'amber',
  moving: 'rose',
  open: 'rose',
}

export const MODULE_STATUS: ModuleStatus[] = [
  {
    moduleId: 'pre-training',
    confidence: 'settled',
    settled:
      'The shape of the objective decides what the model can do. A decoder has only ever continued text, so it cannot fill a hole in the middle; an encoder has only ever filled holes, so it cannot continue. That is a property of the training distribution rather than of the architecture, and it has not changed: the architecture around the objective has moved on a great deal, the objective has not.',
    moving:
      'What has changed is the regime the objective is trained in. The power-law form the book uses was calibrated for abundant data and a single epoch over it, and abundant single-epoch data is now the exception rather than the rule. The book does not cover the data-constrained case, and in that case the qualitative advice of the law it quotes inverts: when data must be repeated, the compute-optimal choice is a smaller model trained for more epochs.',
    sources: [
      {
        label: 'Muennighoff et al. (2023), Scaling Data-Constrained Language Models',
        href: 'https://arxiv.org/pdf/2305.16264v5',
        note: 'Derives the data-constrained law and finds that repeated data should be bought with epochs rather than parameters — the opposite of what the quoted law predicts.',
      },
      {
        label: 'Goel, Sengupta and Chakraborty (ICML 2025), Enough of Scaling LLMs?',
        href: 'https://icml.cc/media/icml-2025/Slides/40165.pdf',
        note: 'Argues that mixture granularity, inference-level scaling and task-specific saturation all break the assumption that parameters and data scale together, and proposes downscaling instead.',
      },
      {
        label: 'Bryant and Liu (2026), Practical Scaling Laws',
        href: 'https://arxiv.org/abs/2605.09189',
        note: 'Gives a closed-form extension that saturates rather than diverging as unique data shrinks, and that can represent overfitting when capacity exceeds the data. It reduces to the quoted law in the data-rich single-epoch limit.',
      },
      {
        label: 'ETH Zürich (2026), When Data Is Scarce',
        href: 'https://spcl.inf.ethz.ch/Publications/.pdf/slide_sparse_scaling_law.pdf',
        note: 'Finds that sparsity delays the point at which repeated data stops helping, so the saturation threshold depends on the architecture as well as on the corpus.',
      },
    ],
  },
  {
    moduleId: 'generative-models',
    confidence: 'settling',
    settled:
      'A decoder-only Transformer is a stack of pre-norm blocks whose attention is causal, and the key–value cache is what makes generation affordable at all. The arithmetic in the course — quadratic attention, linear decode, the cache paid once and then read — is unchanged by anything that has happened since.',
    moving:
      'What moved is the *representation* of the cache, not the idea of it. Grouped-query attention and multi-head latent attention cut the cache by between six and fifty-seven times against the naive form, and the cache rather than the arithmetic is now the first-order limit on serving. A course that explained the cache but not the fact that its size is a design parameter would be teaching a mechanism whose cost has since become an architectural choice.',
    sources: [
      {
        label: 'Ganjihal (2026), Predictive Multi-Tier Memory Management for the KV Cache',
        href: 'https://arxiv.org/html/2604.26968v2',
        note: 'Gives the per-token cost of each attention layout — multi-head, grouped-query, multi-query and latent — and reports that a latent-attention model forced into multi-head-equivalent sizing pays a fifty-seven-fold memory penalty in general-purpose serving frameworks.',
      },
      {
        label: 'Zhang et al. (ACL 2025), Towards Economical Inference',
        href: 'https://aclanthology.org/2025.acl-long.1597.pdf',
        note: 'Converts a trained multi-head or grouped-query model to latent attention using 0.6% to 1% of the data, cutting the cache by 92% to 97%.',
      },
      {
        label: 'KV Cache Optimisation Strategies (2026)',
        href: 'https://arxiv.org/html/2603.20397v1',
        note: 'A review that organises the field into eviction, compression, hybrid memory, new attention mechanisms and combinations.',
      },
    ],
  },
  {
    moduleId: 'prompting',
    confidence: 'moving',
    settled:
      'A prompt has three jobs: the instruction says what to do, the demonstrations show what the answer looks like, and the contract fixes the shape of the answer. The book is right that the third is the one most often left out, and right that without it a human reader and a program will disagree about what the answer should be.',
    moving:
      'The unit of design has grown. The assembled payload — instructions, retrieved passages, memory, tools, policies — is now called the *context*, and prompt engineering is one part of context engineering. Two failure modes have been named that the book does not cover: brevity bias, where a concise summary quietly drops the domain insight, and context collapse, where repeated rewriting erodes detail over a long interaction.',
    sources: [
      {
        label: 'Mei et al. (2025), A Survey of Context Engineering',
        href: 'https://arxiv.org/abs/2507.13334',
        note: 'Over 1,400 papers, and the unit of design is the context bundle rather than the prompt text.',
      },
      {
        label: 'Debnath et al. (2026), Prompt and Context Engineering survey',
        href: 'https://doi.org/10.1016/j.cosrev.2026.100979',
        note: 'Separates the two paradigms by unit of design, temporal horizon, statefulness and failure mode.',
      },
      {
        label: 'Zhang et al. (ICLR 2026), Agentic Context Engineering',
        href: 'https://arxiv.org/abs/2510.04618',
        note: 'Treats a context as an evolving playbook, and names brevity bias and context collapse as the two ways that goes wrong.',
      },
    ],
  },
  {
    moduleId: 'alignment',
    confidence: 'settling',
    settled:
      'A reward model is trained on comparisons because comparisons are what people are reliable at, and the policy is then pushed towards the reward while being held near the reference. The book\'s account of the failure mode — the policy finding the region where the reward model is confidently wrong — has since been measured rather than argued.',
    moving:
      'The comparison between reinforcement learning from human feedback and direct preference optimisation has been settled in a way the book could not have known. Under exact optimisation with a matched reward and policy class the two are equal; the gap in practice comes from mis-specification and from coverage. Direct preference optimisation needs the preference data to cover the policy\'s output distribution globally, while online reinforcement learning needs only partial coverage — which is why the online variants exist at all.',
    sources: [
      {
        label: 'Azar et al. (2026), From RLHF to Direct Alignment',
        href: 'https://arxiv.org/html/2601.06108v1',
        note: 'One framework, in which direct preference optimisation, identity preference optimisation and sequence-likelihood calibration are three choices of loss on the same margin. Its section on length bias finds that models optimised with either method systematically get longer.',
      },
      {
        label: 'Shi et al. (ICML 2026), The Performance Gap in Preference Learning',
        href: 'https://arxiv.org/pdf/2505.19770v5',
        note: 'Shows the gap is one of mis-specification: offline methods need global coverage, online methods need only partial coverage.',
      },
      {
        label: 'When Human Preferences Flip (AAAI 2026)',
        href: 'https://ojs.aaai.org/index.php/AAAI/article/view/41143',
        note: 'Preference flipping is ubiquitous in real annotation and corrupts the data, which is a problem the book does not raise.',
      },
      {
        label: 'Xiao et al. (TPAMI 2026), A Comprehensive Survey of Direct Preference Optimization',
        href: 'https://arxiv.org/html/2410.15595v4',
        note: 'Covers the online and iterative variants that close the loop the closed form leaves open.',
      },
    ],
  },
  {
    moduleId: 'inference',
    confidence: 'settling',
    settled:
      'Prefill and decode are different workloads: one parallel and compute-bound, one sequential and memory-bound. The cache is written once and read many times. None of that has changed, and it is the reason the two phases are treated separately rather than as one cost.',
    moving:
      'Speculative decoding has become a standard part of the serving stack. A small draft model proposes tokens and the large one verifies them in parallel, which turns a memory-bound decode into something closer to a compute-bound one. The old caveat — that it only helps at small batch sizes — has been dropped for long contexts.',
    sources: [
      {
        label: 'MagicDec (ICLR 2026)',
        href: 'https://proceedings.iclr.cc/paper_files/paper/2025/file/13f972adf12bdf886583d48cd528002f-Paper-Conference.pdf',
        note: 'Reports up to 2.51× for LLaMA-3.1-8B at batch sizes from 32 to 256, which is the regime the earlier caveat about speculative decoding excluded.',
      },
      {
        label: 'Beyond KV Reconstruction (2026)',
        href: 'https://arxiv.org/html/2607.27269v1',
        note: 'Shows that a model converted to latent attention can be an efficient generator but a poor draft model, so the conversion has to be trained for the role it is given.',
      },
    ],
  },
  {
    moduleId: 'reasoning',
    confidence: 'moving',
    settled:
      'Reasoning as search needs a proposer and a checker, and the checker is the weak half: the search is adversarial to it, so it finds the candidate the checker is most wrong about. The book warns that the verifier\'s errors are what the search optimises against, and that has since been quantified rather than argued.',
    moving:
      'Process reward models have gone from one option among several to the central machinery of the field, and a 2026 result shows that a reasoning model\'s own hidden states already carry a usable correctness signal — so a verifier can be built without training one. The open problem is verification at small scale: a small model verifies poorly, and the current fix is to hand the memorisation-heavy steps to a tool rather than to the model.',
    sources: [
      {
        label: 'A Survey of Process Reward Models (ACL 2026)',
        href: 'https://aclanthology.org/2026.acl-long.163.pdf',
        note: 'Organises the field into the loop: generating process data, building the model, and using it for test-time scaling and for reinforcement learning.',
      },
      {
        label: 'Liang et al. (ACL 2026), Your Reasoning Model is Secretly a Reward Model',
        href: 'https://aclanthology.org/2026.acl-long.788.pdf',
        note: 'On AIME 24 with a 1.5B model, a training-free verifier lifts accuracy from 56.7% to 70.0%, and the gains are largest for the smaller and less calibrated models.',
      },
      {
        label: 'Beyond Outcome Verification (ACL Findings 2026)',
        href: 'https://aclanthology.org/2026.findings-acl.1611.pdf',
        note: 'Checks each intermediate step with a deterministic rule rather than only the final answer, and reports more coherent traces as well as higher accuracy.',
      },
      {
        label: 'T1: Tool-integrated Verification (ICLR 2026)',
        href: 'https://proceedings.iclr.cc/paper_files/paper/2026/hash/776a5f2c7d6dd4b0d83145fc044e2726-Abstract-Conference.html',
        note: 'A 1B model with test-time scaling outperforms an 8B model when the memorisation-heavy steps are handed to a code interpreter.',
      },
      {
        label: 'Process Reward Models That Think (2025)',
        href: 'https://arxiv.org/html/2504.16828v5',
        note: 'A long chain-of-thought verifier trained on one per cent of the process labels, and better than an LLM-as-judge at the same token budget.',
      },
    ],
  },
]
