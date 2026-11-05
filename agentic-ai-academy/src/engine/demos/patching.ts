/**
 * Locating a decision: probes, the logit lens, and activation patching.
 *
 * Chapter 21 is about how to find out what a model is doing inside, and it
 * is careful about the difference between three kinds of evidence:
 *
 *  - **A probe** is a linear classifier trained on frozen activations to
 *    detect a concept. It answers "is this information *present*?".
 *  - **The logit lens** reads a layer's residual stream through the
 *    unembedding matrix, so it can say "which answer does this layer
 *    prefer?".
 *  - **Activation patching** replaces the activation at one layer in one run
 *    with the activation from another run, and asks whether the behaviour
 *    changes. It answers "does this layer *cause* the behaviour?".
 *
 * The chapter's account of superposition explains why the difference matters.
 * A model packs more features than it has dimensions, so the features are
 * stored as almost-orthogonal vectors in a high-dimensional space: efficient
 * for compression, and a mess to read off. A probe finds a direction that
 * correlates with the concept at *every* layer, because a weak shadow of the
 * information is everywhere. Only patching localises it.
 *
 * This engine makes those three things computable on a toy model: a chain of
 * layers, each carrying a signal that is zero until the decision is made, a
 * shadow that is everywhere, and noise that is not.
 *
 * It is a toy. It is faithful to the *structure* of the argument — what each
 * method can and cannot show — and it is explicit about which layer decides.
 */

/** The two runs of the same model on two different inputs. */
export interface Run {
  id: 'a' | 'b'
  /** What the run is. */
  name: string
  /** The prompt. */
  prompt: string
  /** The answer the run gives. */
  answer: string
  /** The other answer, which the run does not give. */
  otherAnswer: string
}

export interface PatchScenario {
  id: string
  title: string
  context: string
  /** The layers, in order. */
  layers: number
  /** The layer at which the decision is made. */
  decisionLayer: number
  /** How much of the signal survives each layer after the decision. */
  decay: number
  runs: { a: Run; b: Run }
  /**
   * The shadow at each layer: a weak correlation with the *input's* identity,
   * present everywhere. It is what a probe finds.
   */
  shadow: { a: number[]; b: number[] }
  /** The noise at each layer, which is what makes the layers different. */
  noise: { a: number[]; b: number[] }
  note: string
}

/** The state of one layer of one run. */
export interface LayerState {
  layer: number
  /** The evidence that the answer has been decided here. */
  signal: number
  /** The weak correlation a probe would find. */
  shadow: number
  /** The layer-specific noise. */
  noise: number
  /** What the logit lens reads out of this layer. */
  readout: 'a' | 'b' | 'undecided'
}

/**
 * The signal at each layer of a run.
 *
 * It is zero until the decision is made, and then it decays: the answer is
 * carried forward, but less strongly at every step.
 */
export function signalsFor(scenario: PatchScenario, run: 'a' | 'b'): number[] {
  const result: number[] = []
  for (let layer = 0; layer < scenario.layers; layer += 1) {
    if (layer < scenario.decisionLayer) {
      result.push(0)
    } else {
      const base = run === 'a' ? 1 : -1
      result.push(base * Math.pow(scenario.decay, layer - scenario.decisionLayer))
    }
  }
  return result
}

/** The readout of a layer: what the logit lens reads out of it. */
function readoutFor(signal: number): 'a' | 'b' | 'undecided' {
  if (Math.abs(signal) < 0.35) return 'undecided'
  return signal > 0 ? 'a' : 'b'
}

/** Every layer of a run, with its signal, shadow, noise and readout. */
export function layerStates(scenario: PatchScenario, run: 'a' | 'b'): LayerState[] {
  const signals = signalsFor(scenario, run)
  return signals.map((signal, layer) => ({
    layer,
    signal,
    shadow: scenario.shadow[run][layer],
    noise: scenario.noise[run][layer],
    readout: readoutFor(signal),
  }))
}

export interface ProbeResult {
  layer: number
  /** How confident the probe is, as a percentage. */
  confidence: number
  /** Whether the probe clears the threshold. */
  detected: boolean
}

/**
 * Run a linear probe at every layer.
 *
 * The probe detects the *input's identity*, weakly, at every layer — which is
 * the trap. A researcher who stopped there would report that the concept is
 * encoded everywhere.
 */
export function probe(scenario: PatchScenario, threshold: number): ProbeResult[] {
  return scenario.shadow.a.map((shadow, layer) => {
    const confidence = Math.round(Math.abs(shadow) * 100)
    return { layer, confidence, detected: confidence >= threshold }
  })
}

export interface PatchOutcome {
  /** The answer the patched model gives. */
  answer: string
  /** Whether the behaviour changed. */
  changed: boolean
  /** The layer that was patched. */
  layer: number
  /** The state of the layer after patching. */
  signal: number
  /** The readout at the final layer after patching. */
  readout: 'a' | 'b' | 'undecided'
  /** What the patch did, in one sentence. */
  explanation: string
}

/**
 * Patch one layer of run `from` into run `to`, and see what happens.
 *
 * The downstream layers are recomputed from the patched activation, so the
 * effect of the patch propagates the way it does in a real model.
 */
export function patch(scenario: PatchScenario, from: 'a' | 'b', to: 'a' | 'b', layer: number): PatchOutcome {
  const source = layerStates(scenario, from)[layer]
  const target = layerStates(scenario, to)

  /*
   * The downstream layers are recomputed from the patched activation.
   *
   * Before the decision, the patched layer carries no signal, and the
   * decision still happens later exactly as it did: an early patch cannot
   * change what the network decides afterwards. From the decision onwards,
   * the patched signal is carried forward and decays as usual.
   */
  const carriesSignal = layer >= scenario.decisionLayer
  const downstreamSignal = (index: number): number => {
    if (!carriesSignal) return target[index].signal
    if (index <= layer) return index === layer ? source.signal : target[index].signal
    const base = source.signal > 0 ? 1 : source.signal < 0 ? -1 : 0
    return base * Math.pow(scenario.decay, index - scenario.decisionLayer)
  }

  const finalSignal = downstreamSignal(scenario.layers - 1)
  const readout = readoutFor(finalSignal)
  const originalReadout = readoutFor(target[scenario.layers - 1].signal)

  const answer =
    readout === 'a'
      ? scenario.runs.a.answer
      : readout === 'b'
        ? scenario.runs.b.answer
        : 'Neither — the model is undecided.'
  const originalAnswer =
    originalReadout === 'a'
      ? scenario.runs.a.answer
      : originalReadout === 'b'
        ? scenario.runs.b.answer
        : 'Neither — the model is undecided.'

  const changed = answer !== originalAnswer

  let explanation: string
  if (!changed && !carriesSignal) {
    explanation = `The patch changed layer ${layer + 1}, but the answer had not been decided there yet, so nothing downstream depended on it.`
  } else if (!changed) {
    explanation = `The patch changed layer ${layer + 1}, but the signal there was too weak to survive the rest of the network on its own.`
  } else {
    explanation = `Patching layer ${layer + 1} moved the answer from “${originalAnswer}” to “${answer}”. The information that decided it is present here, and using it is what caused the behaviour.`
  }

  return { answer, changed, layer, signal: source.signal, readout, explanation }
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

export const PATCH_SCENARIOS: PatchScenario[] = [
  {
    id: 'capital',
    title: 'Which city is the capital?',
    context:
      'The same model answers two questions. Somewhere in the middle of the network it decides which city to name — and until then, nothing in the activations commits to an answer.',
    layers: 8,
    decisionLayer: 4,
    decay: 0.72,
    runs: {
      a: {
        id: 'a',
        name: 'Run A',
        prompt: 'The capital of France is',
        answer: 'Paris',
        otherAnswer: 'Tokyo',
      },
      b: {
        id: 'b',
        name: 'Run B',
        prompt: 'The capital of Japan is',
        answer: 'Tokyo',
        otherAnswer: 'Paris',
      },
    },
    // A weak shadow of the input's identity, everywhere.
    shadow: {
      a: [0.14, 0.13, 0.15, 0.12, 0.16, 0.11, 0.14, 0.13],
      b: [-0.14, -0.13, -0.15, -0.12, -0.16, -0.11, -0.14, -0.13],
    },
    // Noise, which is what makes the layers different from each other.
    noise: {
      a: [0.31, -0.22, 0.18, 0.27, -0.19, 0.24, -0.15, 0.21],
      b: [-0.28, 0.25, -0.2, 0.16, 0.29, -0.23, 0.17, -0.26],
    },
    note:
      'A probe finds a direction that correlates with the prompt at every layer, because a weak shadow of it is everywhere. Only patching says which layer the decision was actually made in — and even then, patching any layer from the decision onwards transfers the behaviour, because the information is still there.',
  },
  {
    id: 'tool',
    title: 'Which tool should be called?',
    context:
      'Two runs of the same agent reach the same layer with different reasons to act. The decision is made where the evidence for it is, and the layers before it carry none.',
    layers: 10,
    decisionLayer: 6,
    decay: 0.78,
    runs: {
      a: {
        id: 'a',
        name: 'Run A',
        prompt: 'The user asked for the weather in Utrecht',
        answer: 'call the weather tool',
        otherAnswer: 'call the search tool',
      },
      b: {
        id: 'b',
        name: 'Run B',
        prompt: 'The user asked for a paper about sparse autoencoders',
        answer: 'call the search tool',
        otherAnswer: 'call the weather tool',
      },
    },
    shadow: {
      a: [0.11, 0.12, 0.1, 0.13, 0.11, 0.12, 0.1, 0.11, 0.12, 0.1],
      b: [-0.11, -0.12, -0.1, -0.13, -0.11, -0.12, -0.1, -0.11, -0.12, -0.1],
    },
    noise: {
      a: [0.26, 0.19, -0.22, 0.17, -0.25, 0.21, -0.18, 0.23, -0.2, 0.16],
      b: [-0.24, 0.21, -0.18, 0.23, -0.2, 0.18, -0.22, 0.19, -0.24, 0.2],
    },
    note:
      'The decision is made late here, and the layers before it are genuinely undecided rather than faintly committed. A researcher reading the layers too early would find nothing, and a researcher reading them with a lenient threshold would find something everywhere.',
  },
]

export const PATCH_SCENARIO_BY_ID = new Map(PATCH_SCENARIOS.map((entry) => [entry.id, entry]))
