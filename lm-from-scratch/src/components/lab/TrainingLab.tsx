import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { decode, generateCorpus, trainTokenizer } from '../../core/tokenizer'
import { encode } from '../../core/tokenizer'
import { generate, splitTokens, trainModel } from '../../core/transformer'
import type { ModelConfig } from '../../core/transformer'
import { evaluateModel } from '../../core/evaluation'
import { Callout, Figure, Panel, SegmentedControl, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, TrendChart } from '@llm-materials/course-ui'

type View = 'run' | 'loop' | 'evaluation' | 'perplexity'

export function TrainingLab() {
  const [view, setView] = useState<View>('run')
  const [steps, setSteps] = useState(120)
  const [learningRate, setLearningRate] = useState(3e-3)
  const [batchSize, setBatchSize] = useState(4)
  const [width, setWidth] = useState(32)
  const [layers, setLayers] = useState(2)
  const [seed, setSeed] = useState(2)
  const [result, setResult] = useState<TrainingResult | null>(null)

  const setup = useMemo(() => {
    const corpus = generateCorpus(120, 400, 11, 20)
    const tokenizer = trainTokenizer(corpus, 320)
    const tokens = encode(tokenizer, corpus)
    const config: ModelConfig = {
      vocabSize: tokenizer.size,
      dModel: width,
      heads: Math.max(1, Math.floor(width / 8)),
      dFf: width * 2,
      layers,
      contextLength: 32,
    }
    const split = splitTokens(tokens.length, 16)
    return { corpus, tokenizer, tokens, config, split }
  }, [width, layers])

  const run = () => {
    const trained = trainModel(setup.config, setup.tokens, {
      steps,
      batchSize,
      learningRate,
      sequenceLength: 16,
      seed,
    })
    setResult(trained)
  }

  const curve = useMemo(
    () => (result ? result.history.map((entry) => ({ x: entry.step, loss: entry.loss, perplexity: entry.perplexity })) : []),
    [result],
  )

  const evaluation = useMemo(
    () => (result ? evaluateModel(result.model, setup.tokens, { sequenceLength: 16, windows: 8 }) : null),
    [result, setup],
  )

  const continuation = useMemo(() => {
    if (!result) return null
    const textOf = (ids: number[]) => new TextDecoder().decode(decode(setup.tokenizer, ids))
    const prompt = setup.tokens.slice(0, 6)
    const sampled = generate(result.model, prompt, 24, 1, seed)
    const generated = sampled.slice(prompt.length)
    return {
      promptText: textOf(prompt),
      tokens: generated,
      tokenTexts: generated.map((id) => textOf([id])),
      text: textOf(generated),
    }
  }, [result, setup, seed])

  const lastSteps = useMemo(() => (result ? result.history.slice(-8) : []), [result])

  return (
    <div className="lab">
      <Panel
        title="Laboratory E · The training loop"
        subtitle="A transformer, built and trained here, from scratch, every time you press the button"
        accent="violet"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'run', label: 'The run' },
              { value: 'loop', label: 'The loop' },
              { value: 'evaluation', label: 'The evaluation' },
              { value: 'perplexity', label: 'The perplexity' },
            ]}
          />
          <Slider label="Steps" value={steps} min={20} max={400} step={10} onChange={setSteps} />
          <Slider
            label="Learning rate"
            value={learningRate}
            min={1e-4}
            max={1e-2}
            step={1e-4}
            onChange={setLearningRate}
            format={(value) => value.toExponential(1)}
          />
          <Slider label="Batch size" value={batchSize} min={1} max={16} onChange={setBatchSize} />
          <Slider label="Width" value={width} min={8} max={64} step={8} onChange={setWidth} />
          <Slider label="Layers" value={layers} min={1} max={4} onChange={setLayers} />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
          <div className="field">
            <span className="field-label">The model</span>
            <button type="button" className="btn btn-primary" onClick={run}>
              Train from scratch
            </button>
            <p className="field-hint">
              The tokeniser, the transformer and the optimiser are all built here. There is no checkpoint to download.
            </p>
          </div>
        </div>

        {view === 'run' ? (
          <>
            {result ? (
              <>
                <div className="stat-row">
                  <Stat
                    label="The final loss"
                    value={fmt(result.history[result.history.length - 1]!.loss, 4)}
                    tone={result.history[result.history.length - 1]!.loss < result.history[0]!.loss ? 'good' : 'warn'}
                    hint={`from ${fmt(result.history[0]!.loss, 4)}`}
                  />
                  <Stat label="The validation loss" value={fmt(result.validationLoss, 4)} hint="on held-out data" />
                  <Stat
                    label="The perplexity"
                    value={fmt(result.validationPerplexity, 2)}
                    hint="the loss, exponentiated"
                  />
                  <Stat label="The time" value={`${result.milliseconds} ms`} hint="in this tab" />
                </div>

                <Figure
                  title="The loss, falling"
                  description="The training loss at every recorded step, from the initialisation to the end of the run."
                  caption="A real optimisation of a real objective. The loss falls because the network is learning the structure of the corpus — the repeated words, the document boundaries, the way one word follows another."
                >
                  <TrendChart
                    data={curve}
                    series={[{ key: 'loss', name: 'the training loss', colour: 'var(--accent-violet)' }]}
                    xLabel="the step"
                    yLabel="the cross-entropy"
                    height={280}
                  />
                </Figure>

                <Callout tone="definition" title="What the loss is measuring">
                  For each token in the batch, the negative log-probability the model gave to the token that actually came
                  next, averaged over the tokens. It is the negative log-likelihood of the corpus under the model, and
                  minimising it is the whole of language-model training.
                </Callout>

                <Figure
                  title="Running a small real model"
                  description="A continuation sampled from the model after this run, from a six-token prompt taken from the corpus."
                  caption="The model is a few hundred thousand parameters trained for a minute in this tab, so the continuation is locally plausible and globally meaningless. That is the honest result at this size: what it has learned is the token statistics of the corpus, not its meaning."
                >
                  <p className="lab-text">
                    <strong>The prompt:</strong> “{continuation!.promptText}”
                  </p>
                  <p className="lab-text">
                    <strong>The continuation:</strong> “{continuation!.text}”
                  </p>
                  <DataTable
                    caption="The generated tokens, one by one"
                    headers={['#', 'The token', 'The id']}
                    rows={continuation!.tokens.map((id, index) => [
                      index + 1,
                      continuation!.tokenTexts[index] ?? '',
                      id,
                    ])}
                  />
                </Figure>
              </>
            ) : (
              <Callout tone="note" title="Nothing trained yet">
                Press <strong>Train from scratch</strong>. The tokeniser is trained on a generated corpus, the transformer
                is initialised, and the loop runs — in this tab, in a second or two. The basics table below describes
                what the loop does before it does it.
              </Callout>
            )}

            <Figure
              title="Built from nothing"
              description="The three pieces of the run, and where each one is in this project."
              caption="Nothing is downloaded and nothing is wrapped: the merges are learned here, the attention head's arithmetic is written here, and the Adam update is written here. That is what makes the run inspectable."
            >
              <DataTable
                caption="The pieces of the run"
                headers={['The piece', 'Where it lives', 'What this run uses']}
                rows={[
                  [
                    'the tokeniser',
                    'core/tokenizer.ts — byte-pair merges learned from the corpus',
                    `${setup.tokenizer.size} tokens, ${setup.tokenizer.merges.length} merges`,
                  ],
                  [
                    'the attention head',
                    'core/transformer.ts — queries, keys, values and a causal softmax',
                    `${setup.config.heads} heads of dimension ${Math.floor(width / Math.max(1, Math.floor(width / 8)))}`,
                  ],
                  [
                    'the optimiser',
                    'core/transformer.ts — Adam with bias corrections',
                    `learning rate ${learningRate.toExponential(1)}, batch ${batchSize}`,
                  ],
                ]}
              />
            </Figure>

            <Figure
              title="Basics"
              description="What a training loop has to contain, and what each part is in this run."
              caption="These six pieces are the whole of a training loop. The rest of language-model engineering is making each of them survive scale."
            >
              <DataTable
                caption="The basics of the loop"
                headers={['The piece', 'What it does', 'In this run']}
                rows={[
                  [
                    'the data',
                    'a tokenised corpus, split into a training part and a held-out validation part',
                    `${setup.tokens.length.toLocaleString()} tokens, ${setup.split.validationSize.toLocaleString()} held out`,
                  ],
                  [
                    'the model',
                    'embeddings, transformer blocks, a final norm and a projection to the vocabulary',
                    `${layers} layers, width ${width}, ${setup.config.heads} heads`,
                  ],
                  [
                    'the loss',
                    'the cross-entropy of the next token, averaged over the batch',
                    result ? `from ${fmt(result.history[0]!.loss, 3)} to ${fmt(result.history[result.history.length - 1]!.loss, 3)}` : 'measured at every step',
                  ],
                  [
                    'the optimiser',
                    'Adam: a first and a second moment per parameter, with bias correction',
                    `${result ? result.model.parameterCount.toLocaleString() : '—'} parameters updated`,
                  ],
                  [
                    'the step',
                    'sample a batch, forward, backward, average the gradients, update',
                    `${steps} steps of batch ${batchSize}`,
                  ],
                  [
                    'the log',
                    'the loss, the perplexity and the gradient norm, at every step',
                    result ? `${result.history.length} records, ${result.milliseconds} ms` : 'kept in memory, plotted here',
                  ],
                ]}
              />
            </Figure>
          </>
        ) : null}

        {view === 'loop' ? (
          <>
            {result ? (
              <>
                <div className="stat-row">
                  <Stat
                    label="The last gradient norm"
                    value={fmt(result.history[result.history.length - 1]!.gradientNorm, 3)}
                    hint="before the update"
                    tone={result.history[result.history.length - 1]!.gradientNorm < result.history[0]!.gradientNorm ? 'good' : 'warn'}
                  />
                  <Stat label="The first gradient norm" value={fmt(result.history[0]!.gradientNorm, 3)} hint="at initialisation" />
                  <Stat label="The batch" value={String(batchSize)} hint="sequences per step" />
                  <Stat label="The sequence" value="17 tokens" hint="16 to predict, 1 carried" />
                </div>

                <Figure
                  title="The last eight steps, as the loop recorded them"
                  description="The loss, the perplexity and the gradient norm at every one of the final eight steps."
                  caption="The loss is the mean over the batch, the perplexity is its exponential, and the gradient norm is measured after averaging and before the Adam update."
                >
                  <DataTable
                    caption="The recorded steps"
                    headers={['Step', 'Loss', 'Perplexity', 'Gradient norm']}
                    rows={lastSteps.map((entry) => [
                      entry.step + 1,
                      fmt(entry.loss, 4),
                      fmt(entry.perplexity, 3),
                      fmt(entry.gradientNorm, 3),
                    ])}
                  />
                </Figure>
              </>
            ) : (
              <Callout tone="note" title="Nothing trained yet">
                Press <strong>Train from scratch</strong> to get a run to read.
              </Callout>
            )}

            <Figure
              title="Reading a real training loop"
              description="The seven things the loop does at every step, in the order it does them."
              caption="This is the entire loop in core/transformer.ts, read as seven statements. Every large language model's training loop is a longer version of this one."
            >
              <DataTable
                caption="The loop, line by line"
                headers={['The step', 'What it does', 'Why it is there']}
                rows={[
                  [
                    '1 · clear the gradients',
                    'sets every parameter gradient to zero before the batch',
                    'the batch accumulates into the same buffer',
                  ],
                  [
                    '2 · sample a batch',
                    `${batchSize} sequences of 17 tokens, drawn at random from the training split`,
                    'random windows decorrelate the steps',
                  ],
                  [
                    '3 · forward',
                    'runs the transformer and computes the cross-entropy',
                    'the loss is the objective',
                  ],
                  [
                    '4 · backward',
                    'back-propagates each sequence into the same parameter gradients',
                    'this is gradient accumulation across the batch',
                  ],
                  [
                    '5 · average and measure',
                    'divides the gradient by the batch size and takes its norm',
                    'a common scale, and a diagnostic for divergence',
                  ],
                  [
                    '6 · update with Adam',
                    'applies the bias-corrected first and second moments',
                    'the step size is adaptive per parameter',
                  ],
                  [
                    '7 · record',
                    'stores the loss, the perplexity and the norm',
                    'the curve is a record, not a measurement',
                  ],
                ]}
              />
            </Figure>

            <Callout tone="warning" title="Read the loss, then read the gradient norm">
              A loss that falls while the gradient norm grows is a run that is about to break. A loss that is flat while
              the norm is tiny is a learning rate that is too small. This run records both at every step for exactly that
              reason — the gradient norm is often the first number to show trouble.
            </Callout>
          </>
        ) : null}

        {view === 'evaluation' ? (
          <>
            {result && evaluation ? (
              <>
                <div className="stat-row">
                  <Stat
                    label="The held-out loss"
                    value={fmt(evaluation.loss, 4)}
                    hint={`on ${evaluation.tokens} token positions`}
                  />
                  <Stat
                    label="The top-1 accuracy"
                    value={`${(evaluation.top1 * 100).toFixed(1)}%`}
                    hint={`chance is ${(evaluation.chance * 100).toFixed(2)}%`}
                    tone={evaluation.top1 > evaluation.chance * 2 ? 'good' : 'warn'}
                  />
                  <Stat
                    label="The top-5 accuracy"
                    value={`${(evaluation.top5 * 100).toFixed(1)}%`}
                    hint="the target in the five best logits"
                  />
                  <Stat
                    label="The standard error"
                    value={`±${(evaluation.standardError * 100).toFixed(2)}%`}
                    hint="nominal: tokens are correlated"
                  />
                </div>

                <Figure
                  title="Evaluation harnesses"
                  description="The harness’s report on a held-out slice the training loop never sampled."
                  caption="The comparison that matters is against chance, not against zero. A model that assigned every token the same probability would score one over the vocabulary on top-1 — and the loss of that model is the logarithm of the vocabulary."
                >
                  <DataTable
                    caption="The harness’s report"
                    headers={['The quantity', 'The value', 'What it is']}
                    rows={[
                      ['the held-out loss', fmt(evaluation.loss, 4), 'the mean negative log-likelihood per token'],
                      ['the perplexity', fmt(evaluation.perplexity, 2), 'the loss, exponentiated'],
                      ['the top-1 accuracy', `${(evaluation.top1 * 100).toFixed(1)}%`, 'the argmax is the target'],
                      ['the top-5 accuracy', `${(evaluation.top5 * 100).toFixed(1)}%`, 'the target is among the five best'],
                      ['the chance rate', `${(evaluation.chance * 100).toFixed(2)}%`, 'one over the vocabulary'],
                      ['the nominal standard error', `±${(evaluation.standardError * 100).toFixed(2)}%`, 'treating tokens as independent draws'],
                      ['the tokens scored', evaluation.tokens.toLocaleString(), `${evaluation.windows} non-overlapping windows`],
                    ]}
                  />
                </Figure>

                <Callout tone="note" title="A harness names its data, its metric and its baseline">
                  The data is the held-out split, the metric is the mean negative log-likelihood and the two accuracies,
                  and the baseline is the chance rate. A number without the three is not an evaluation. The standard
                  error here is nominal: the tokens inside a window are correlated, so the true uncertainty is larger
                  than the formula suggests.
                </Callout>
              </>
            ) : (
              <Callout tone="note" title="Nothing trained yet">
                Press <strong>Train from scratch</strong> to measure a model on held-out data.
              </Callout>
            )}
          </>
        ) : null}

        {view === 'perplexity' ? (
          <>
            {result ? (
              <>
                <Figure
                  title="The perplexity, falling"
                  description="The training perplexity at every recorded step, against the validation perplexity at the end."
                  caption="The perplexity is the loss, exponentiated: a number of effective choices per token. It is only comparable against another model at the same tokenisation."
                >
                  <TrendChart
                    data={curve}
                    series={[{ key: 'perplexity', name: 'the training perplexity', colour: 'var(--accent-violet)' }]}
                    xLabel="the step"
                    yLabel="the perplexity"
                    height={280}
                  />
                </Figure>

                <DataTable
                  caption="What the run measured"
                  headers={['Quantity', 'Value']}
                  rows={[
                    ['the vocabulary', String(setup.tokenizer.size)],
                    ['the tokens in the corpus', setup.tokens.length.toLocaleString()],
                    ['the model', `${setup.config.layers} layers, width ${setup.config.dModel}`],
                    ['the parameters', result.model.parameterCount.toLocaleString()],
                    ['the first loss', fmt(result.history[0]!.loss, 4)],
                    ['the final loss', fmt(result.history[result.history.length - 1]!.loss, 4)],
                    ['the validation loss', fmt(result.validationLoss, 4)],
                    ['the training perplexity', fmt(result.history[result.history.length - 1]!.perplexity, 3)],
                    ['the validation perplexity', fmt(result.validationPerplexity, 3)],
                    ['the gap', fmt(result.validationLoss - result.history[result.history.length - 1]!.loss, 4)],
                  ]}
                />

                <Callout tone="warning" title="A training loss is a diagnostic; a validation loss is a measurement">
                  The training loss tells you the optimiser is working. The validation loss tells you something about the
                  model. The gap between them is the overfitting — and on a corpus this small, with a model this big, it
                  is large, and that is the correct observation to make.
                </Callout>
              </>
            ) : (
              <Callout tone="note" title="Nothing trained yet">
                Press <strong>Train from scratch</strong> to get a run to read.
              </Callout>
            )}
          </>
        ) : null}
      </Panel>
    </div>
  )
}

type TrainingResult = NonNullable<ReturnType<typeof trainModel>>
