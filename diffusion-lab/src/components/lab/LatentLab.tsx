import { useMemo, useState } from 'react'
import { createRng, fmt, gaussian, mean } from '@llm-materials/course-core'
import {
  compressionSaving,
  decode,
  encode,
  fitAutoencoder,
  latentVariances,
  reconstructionError,
  unitVarianceScale,
} from '../../core/latent'
import { buildSchedule } from '../../core/schedules'
import { Callout, Figure, Panel, Slider, Stat } from '@llm-materials/course-ui'
import { DataTable, PointChart } from '@llm-materials/course-ui'

const SCHEDULE = buildSchedule('linear', 200)

export function LatentLab() {
  const [latentDimension, setLatentDimension] = useState(1)
  const [seed, setSeed] = useState(3)

  const data = useMemo(() => {
    const rng = createRng(seed)
    // A dataset with structure the autoencoder can find: two elongated
    // clusters at different angles, so the principal components are visible.
    return Array.from({ length: 300 }, () => {
      const cluster = rng() < 0.5 ? 0 : 1
      const angle = cluster === 0 ? 0.4 : -0.9
      const along = gaussian(rng) * 1.6
      const across = gaussian(rng) * 0.25
      return [
        along * Math.cos(angle) - across * Math.sin(angle),
        along * Math.sin(angle) + across * Math.cos(angle),
      ]
    })
  }, [seed])

  const autoencoder = useMemo(() => fitAutoencoder(data, latentDimension), [data, latentDimension])

  const reconstructions = useMemo(
    () => data.slice(0, 120).map((point) => decode(autoencoder, encode(autoencoder, point))),
    [autoencoder, data],
  )

  const error = useMemo(() => reconstructionError(autoencoder, data), [autoencoder, data])
  const variances = useMemo(() => latentVariances(autoencoder, data), [autoencoder, data])
  const scale = unitVarianceScale(autoencoder, data)

  const roundTrip = useMemo(
    () =>
      data.slice(0, 4).map((point) => {
        const latent = encode(autoencoder, point)
        const reconstructed = decode(autoencoder, latent)
        const squaredError = point.reduce((total, value, index) => total + (value - (reconstructed[index] ?? 0)) ** 2, 0)
        return { point, latent, reconstructed, squaredError }
      }),
    [autoencoder, data],
  )

  const saving = useMemo(
    () => compressionSaving(256, 256, 3, 8, 4),
    [],
  )

  const snrComparison = useMemo(() => {
    const rows: { x: number; pixel: number; latent: number }[] = []
    const latentVariance = mean(variances)
    for (let t = 0; t < SCHEDULE.steps; t += 10) {
      const alphaBar = SCHEDULE.alphaBars[t]
      const signal = alphaBar
      const noise = 1 - alphaBar
      // In the latent space the same schedule is applied to data whose
      // variance is not one, so the effective SNR changes.
      const latentSignal = (alphaBar * latentVariance) / scale ** 2
      const latentNoise = 1 - alphaBar
      rows.push({ x: t, pixel: signal / noise, latent: latentSignal / latentNoise })
    }
    return rows
  }, [variances, scale])

  return (
    <div className="lab">
      <Panel
        title="Laboratory D · Latent diffusion"
        subtitle="A real autoencoder, a measured compression, and the scaling factor that follows"
        accent="emerald"
      >
        <div className="lab-controls">
          <Slider
            label="Latent dimension"
            value={latentDimension}
            min={1}
            max={2}
            onChange={setLatentDimension}
            hint="How many numbers survive the compression."
          />
          <Slider label="Seed" value={seed} min={1} max={50} onChange={setSeed} />
        </div>

        <div className="stat-row">
          <Stat label="Reconstruction MSE" value={fmt(error, 6)} hint="mean squared error over the dataset" />
          <Stat
            label="Variance retained"
            value={`${fmt(autoencoder.explainedVarianceRatio * 100, 1)}%`}
            hint="the fraction of the data's variance the latent keeps"
          />
          <Stat
            label="Unit-variance scale"
            value={fmt(scale, 4)}
            hint="what you would multiply the latents by"
          />
          <Stat
            label="Element saving"
            value={`${fmt(1 / saving.elementRatio, 1)}×`}
            hint="at a compression factor of 8"
          />
        </div>

        <Figure
          title="The compression"
          description="The original data points, in grey, with their reconstructions through the autoencoder, in colour."
          caption="The autoencoder is the principal-component projection of the data: a linear encoder and its matching linear decoder. With one latent dimension the structure along the principal axis survives and the other direction is lost."
        >
          <PointChart
            points={[
              ...data.map((point) => ({ x: point[0], y: point[1], group: 'Data' })),
              ...reconstructions.map((point) => ({ x: point[0], y: point[1], group: 'Reconstruction' })),
            ]}
            series={[
              { key: 'Data', name: 'The data', colour: 'var(--border-strong)' },
              { key: 'Reconstruction', name: 'Reconstruction', colour: 'var(--accent-emerald)' },
            ]}
            xLabel="first coordinate"
            yLabel="second coordinate"
            height={340}
          />
        </Figure>

        <DataTable
          caption="The latent coordinates"
          headers={['Quantity', 'Value']}
          rows={[
            ['input dimension', String(autoencoder.inputDimension)],
            ['latent dimension', String(autoencoder.latentDimension)],
            ['variance retained', `${fmt(autoencoder.explainedVarianceRatio, 6)}`],
            ...variances.map((variance, index) => [`latent variance, coordinate ${index}`, fmt(variance, 6)] as [string, string]),
            ['reconstruction MSE', fmt(error, 8)],
            ['unit-variance scale factor', fmt(scale, 6)],
          ]}
        />

        <Figure
          title="The autoencoder round trip"
          description="Four data points encoded to the latent space and decoded back, with the squared error of each round trip."
          caption="The encoder subtracts the mean, projects onto the principal axes, and the decoder reverses both. At one latent dimension the component across the principal axis is discarded, so the error is the distance the round trip travels in that direction."
        >
          <DataTable
            caption="The round trip, point by point"
            headers={['Point', 'Original', 'Latent', 'Reconstructed', 'Squared error']}
            rows={roundTrip.map((entry, index) => [
              index + 1,
              `(${fmt(entry.point[0] ?? 0, 3)}, ${fmt(entry.point[1] ?? 0, 3)})`,
              entry.latent.map((value) => fmt(value, 3)).join(', '),
              `(${fmt(entry.reconstructed[0] ?? 0, 3)}, ${fmt(entry.reconstructed[1] ?? 0, 3)})`,
              fmt(entry.squaredError, 5),
            ])}
          />
        </Figure>

        <Figure
          title="What the compression buys a 256×256 image"
          description="A table of the reduction in elements and in attention cost for a 256×256 image with three channels, compressed by a factor of eight into four latent channels."
          caption="Latent diffusion does not improve the diffusion model; it moves it into a cheaper space. The element saving is 48× at f = 8, and the attention saving is larger again because attention is quadratic in the number of tokens."
        >
          <DataTable
            caption="The saving from a factor-8 compression of a 256×256 image"
            headers={['Quantity', 'Value']}
            rows={[
              ['pixel elements', fmt(256 * 256 * 3, 0)],
              ['latent elements', fmt(32 * 32 * 4, 0)],
              ['element ratio', fmt(saving.elementRatio, 6)],
              ['attention cost ratio', fmt(saving.attentionRatio, 8)],
            ]}
          />
        </Figure>

        <Figure
          title="The signal-to-noise ratio, before and after the rescaling"
          description="The signal-to-noise ratio along the chain, computed for the pixel data and for the latent data after the scaling factor is applied."
          caption="The schedule assumes data with unit variance. A latent space with a different scale is mismatched to it, and the rescaling factor is what puts it back — which is why the factor of 0.18215 in the paper is not an arbitrary constant."
        >
          <DataTable
            caption="The effective signal-to-noise ratio in pixel space and in latent space"
            headers={['t', 'SNR (pixels)', 'SNR (latents, rescaled)']}
            rows={snrComparison
              .filter((_, index) => index % 5 === 0)
              .map((row) => [row.x, fmt(row.pixel, 4), fmt(row.latent, 4)])}
          />
        </Figure>

        <Callout tone="definition" title="Why the scaling factor exists">
          The forward process is defined for data with roughly unit variance, because that is what makes ᾱ_t
          interpretable as a signal fraction. Latents usually have a much smaller variance, so they are multiplied by
          a constant to bring them back. The paper uses 0.18215.
        </Callout>

        <Callout tone="warning" title="What is being measured here">
          The autoencoder in this laboratory is linear — the principal components of the data — because that makes the
          reconstruction error exactly interpretable. A real latent diffusion model uses a convolutional autoencoder
          trained separately, and its reconstruction error is a different number. What transfers is the arithmetic of
          the saving, not the error.
        </Callout>
      </Panel>
    </div>
  )
}
