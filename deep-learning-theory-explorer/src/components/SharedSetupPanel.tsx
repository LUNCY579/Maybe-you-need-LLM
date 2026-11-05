import { Panel, Select, Slider, Badge, Button } from './ui';
import { useSharedSetup } from '../lib/sharedSetup';
import { ACTIVATION_IDS, getActivation } from '../lib/numerics/activations';
import { CopyLinkButton } from './CopyLinkButton';
import { SETUP_LABS } from '../content/labs';

/**
 * The shared experiment setup, shown at the top of every measurement laboratory.
 *
 * The book's central claim is that one recursion — the kernel recursion of
 * Chapter 5 — governs every architecture, every activation and every depth.
 * This panel makes that claim operative: the settings that every laboratory
 * can use are set once, here, and a change is a change everywhere.
 */
export function SharedSetupPanel({ compact = false }: { compact?: boolean }) {
  const { setup, patch, reset, isCustom } = useSharedSetup();
  const act = getActivation(setup.activation);

  return (
    <Panel
      title="Shared setup"
      right={
        <div className="flex items-center gap-1.5">
          {isCustom && <Badge tone="good">custom</Badge>}
          <Button variant="ghost" onClick={reset}>
            reset
          </Button>
        </div>
      }
      subtitle={`These settings are shared by all ${SETUP_LABS.length} measurement laboratories: a change here is a change everywhere.`}
    >
      <div className="space-y-3">
        <CopyLinkButton />
        <Select
          label="Activation"
          value={setup.activation}
          options={ACTIVATION_IDS.map((id) => ({ value: id, label: getActivation(id).label, note: getActivation(id).universality }))}
          onChange={(v) => patch({ activation: v })}
          hint={act.universality === 'none' ? 'This activation cannot be tuned to criticality (Lesson 7).' : undefined}
        />
        <Slider
          label="Weight variance"
          tex="C_W"
          value={setup.Cw}
          min={0.05}
          max={3}
          step={0.01}
          onChange={(v) => patch({ Cw: v })}
          hint={act.scaleInvariantA2 ? `Critical value for ${act.label}: ${(1 / act.scaleInvariantA2).toFixed(4)}` : undefined}
        />
        <Slider label="Bias variance" tex="C_b" value={setup.Cb} min={0} max={2} step={0.01} onChange={(v) => patch({ Cb: v })} />
        <Slider label="Depth (layers)" value={setup.depth} min={2} max={60} integer onChange={(v) => patch({ depth: v })} />
        <Slider label="Width (neurons per hidden layer)" value={setup.width} min={2} max={512} step={2} integer onChange={(v) => patch({ width: v })} />
        <Slider label="Master seed" value={setup.seed} min={1} max={999} integer onChange={(v) => patch({ seed: v })} />

        {!compact && (
          <>
            <Select
              label="Initialization distribution"
              value={setup.initDistribution}
              options={[
                { value: 'gaussian', label: 'Gaussian (the book’s choice)' },
                { value: 'uniform', label: 'Uniform with matched variance' },
              ]}
              onChange={(v) => patch({ initDistribution: v })}
            />
            <Select
              label="Input distribution"
              value={setup.inputDistribution}
              options={[
                { value: 'gaussian', label: 'Gaussian N(0, σ²)' },
                { value: 'uniform', label: 'Uniform, unit variance' },
              ]}
              onChange={(v) => patch({ inputDistribution: v })}
            />
            <Slider label="Input scale" tex="\sigma" value={setup.inputScale} min={0.1} max={3} step={0.05} onChange={(v) => patch({ inputScale: v })} />
            <Slider label="Input dimension" value={setup.inputDim} min={1} max={32} integer onChange={(v) => patch({ inputDim: v })} />
            <Slider label="Input samples" value={setup.samples} min={4} max={256} step={4} integer onChange={(v) => patch({ samples: v })} />
            <Slider label="Networks per measurement" value={setup.seeds} min={1} max={40} integer onChange={(v) => patch({ seeds: v })} />
          </>
        )}
      </div>
    </Panel>
  );
}
