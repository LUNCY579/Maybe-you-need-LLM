import { Link } from 'react-router-dom';
import { Panel, Badge, Table } from '../components/ui';
import { EXPERIMENTS } from '../content/experiments';

const LAB_ROUTES: Record<string, string> = {
  initialization: '/labs/initialization',
  landscape: '/labs/landscape',
  'width-depth': '/labs/width-depth',
  ntk: '/labs/ntk',
  representation: '/labs/representation',
  physics: '/labs/physics',
};

const LAB_LABEL: Record<string, string> = {
  initialization: 'Lab A · Initialization',
  landscape: 'Lab B · Optimization',
  'width-depth': 'Lab C · Width & depth',
  ntk: 'Lab D · NTK',
  representation: 'Lab E · Representation',
  physics: 'Physics lab',
};

export function GalleryPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[20px] font-semibold text-lab-100">Experiment gallery</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
          Predefined, reproducible experiments. Each preset fixes the seed and states the expected outcome — including
          the numeric prediction where the theory gives one. Open a preset in its laboratory, change one parameter, and
          see what the mathematics says about your change.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXPERIMENTS.map((exp) => (
          <Panel
            key={exp.id}
            title={exp.name}
            right={<Badge tone="default">{LAB_LABEL[exp.lab]}</Badge>}
            subtitle={<span className="mono">seed {exp.seed}</span>}
          >
            <div className="space-y-2 text-[12.5px] leading-relaxed">
              <p className="text-lab-200">
                <span className="text-lab-400">Hypothesis: </span>
                {exp.hypothesis}
              </p>
              <p className="text-lab-300">{exp.description}</p>
              <p className="rounded border border-signal-blue/40 bg-signal-blue/10 p-2 text-lab-100">
                <span className="text-signal-blue">Expected: </span>
                {exp.expected}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(exp.settings).map(([k, v]) => (
                  <span key={k} className="mono rounded border border-lab-700 bg-lab-850 px-1.5 py-0.5 text-[11px] text-lab-300">
                    {k}={String(v)}
                  </span>
                ))}
              </div>
              <Link to={`${LAB_ROUTES[exp.lab]}?preset=${exp.id}`} className="inline-block text-[12px]">
                open {LAB_LABEL[exp.lab]} with these settings →
              </Link>
            </div>
          </Panel>
        ))}
      </div>

      <Panel
        title="Reproducing a preset by hand"
        subtitle="The app never hides the recipe: every preset below is a settings vector you can type yourself. Clicking a preset loads it into its laboratory."
      >
        <Table
          head={['Preset', 'Activation / objective', 'Key numbers', 'Seed']}
          rows={EXPERIMENTS.map((e) => [
            e.name,
            String(e.settings.activation ?? e.settings.sliceKind ?? '—'),
            `${e.settings.depth ? `depth ${e.settings.depth}, ` : ''}${e.settings.width ? `width ${e.settings.width}, ` : ''}${
              e.settings.Cw !== undefined ? `C_W ${e.settings.Cw}` : ''
            }${e.settings.learningRate ? `η ${e.settings.learningRate}` : ''}`,
            String(e.seed),
          ])}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-lab-400">
          Randomness is always the same kind: a seeded mulberry32 stream feeding either Gaussian or scaled-uniform
          weights. Setting the seed and the settings reproduces a run exactly, in any browser.
        </p>
      </Panel>
    </div>
  );
}
