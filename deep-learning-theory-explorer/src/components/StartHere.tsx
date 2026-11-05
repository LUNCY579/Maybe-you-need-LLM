import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel, Badge, Button, Callout } from './ui';
import { Tex } from './Math';
import { getActivation, type ActivationId } from '../lib/numerics/activations';
import { useSharedSetup } from '../lib/sharedSetup';
import { findCriticalPoints, taylorA1, type CriticalPoint } from '../lib/numerics/gaussian';

/**
 * "Start here": a two-click path from the idea to a running experiment.
 *
 * The Overview is where a first-time reader arrives, and it used to be a page
 * of prose about prose. This panel does the one thing a reader actually needs
 * first: it asks which activation they want to understand, shows them the
 * critical weight variance that activation has, lets them move away from it and
 * watch what the theory predicts, and then opens the physics laboratory already
 * configured with their choice.
 */

const CANDIDATES: ActivationId[] = ['relu', 'tanh', 'sigmoid', 'gelu'];

const DEPTH = 12;

export function StartHere() {
  const navigate = useNavigate();
  const { patch } = useSharedSetup();
  const [activation, setActivation] = useState<ActivationId>('relu');
  const [Cw, setCw] = useState(2);
  const act = getActivation(activation);
  const criticalHintId = useId();

  /*
    The scan is what says whether this activation can be tuned to criticality,
    and the two ways of failing are different findings: one root that asks for a
    negative bias variance is not the same as no root at all. Both are reported
    from the scan rather than from a table, so the number on the screen is the
    number the code computed.
  */
  const scan = useMemo(() => {
    if (act.scaleInvariantA2) return { Cw: 1 / act.scaleInvariantA2, roots: [] as CriticalPoint[], scanned: 0 };
    const scanned = 6;
    const roots = findCriticalPoints(act, { Kmax: scanned, steps: 900 });
    const physical = roots.filter((p) => p.physical);
    return {
      Cw: physical.length ? physical[physical.length - 1].Cw : null,
      roots,
      scanned,
    };
  }, [act]);
  const critical = scan.Cw;

  const a1 = useMemo(() => taylorA1(act), [act]);

  /** What the theory says happens at this C_W, in one sentence. */
  const prediction = useMemo(() => {
    if (critical === null) {
      return `${act.label} cannot be tuned to criticality: whatever you choose for C_W, the kernel either explodes, decays or plateaus. Lesson 7 works out why.`;
    }
    const ratio = Cw / critical;
    if (Math.abs(ratio - 1) < 1e-9) {
      return act.universality === 'K=0'
        ? `At C_W = ${critical.toFixed(2)} the kernel does not stay flat but decays as a power law, 1/(2ℓ): the benign slow fade of the K = 0 class.`
        : `At C_W = ${critical.toFixed(2)} the kernel stays exactly constant with depth: the critical point.`;
    }
    const growth = Math.pow(ratio, DEPTH - 1);
    const direction = growth > 1 ? 'grows' : 'shrinks';
    return `At C_W = ${Cw.toFixed(2)} the kernel ${direction} by a factor of ${growth.toPrecision(3)} over ${DEPTH} layers: ${growth > 1 ? 'the signal blows up' : 'the signal dies'}.`;
  }, [act, critical, Cw]);

  const open = () => {
    patch({
      activation,
      Cw,
      depth: DEPTH,
      width: 64,
      samples: 32,
      seeds: 8,
    });
    navigate('/labs/physics');
  };

  return (
    <Panel
      title="Start here"
      subtitle="Two clicks: pick an activation, and open the laboratory already configured to test it."
      right={<Badge tone="good">live</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[12px] text-lab-300">Which activation do you want to understand?</div>
            <div className="flex flex-wrap gap-1.5">
              {CANDIDATES.map((id) => {
                const a = getActivation(id);
                const active = id === activation;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActivation(id);
                      const crit = a.scaleInvariantA2 ? 1 / a.scaleInvariantA2 : null;
                      if (crit !== null) setCw(Math.round(crit * 100) / 100);
                    }}
                    className={`rounded border px-2.5 py-1 text-[12px] transition-colors ${
                      active
                        ? 'border-signal-blue bg-signal-blue/15 text-signal-blue'
                        : 'border-lab-700 text-lab-300 hover:border-lab-500'
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-lab-300">
                Weight variance <Tex tex="C_W" />
              </span>
              <span className="mono text-[12.5px] text-lab-100">{Cw.toFixed(2)}</span>
            </div>
            {/*
              The label wraps the explanation as well as the control, so without
              an explicit name every word of it — including the sentence about the
              scanned roots — would be read out as the name of the slider. The name
              is set here and the explanation is attached as a description, which
              is what it is: something that answers a question about the control
              rather than part of what the control is called.
            */}
            <input
              className="mt-1.5 w-full"
              type="range"
              min={0.1}
              max={3}
              step={0.01}
              value={Cw}
              onChange={(e) => setCw(Number(e.target.value))}
              aria-label="Weight variance C_W"
              aria-describedby={criticalHintId}
            />
            {critical !== null && (
              <p id={criticalHintId} className="mt-1 text-[11.5px] text-lab-400">
                The critical value for {act.label} is{' '}
                <span className="mono text-signal-green">{critical.toFixed(4)}</span>.{' '}
                <button
                  type="button"
                  className="underline decoration-dotted text-signal-blue"
                  onClick={() => setCw(Math.round(critical * 100) / 100)}
                >
                  jump to it
                </button>
              </p>
            )}
            {critical === null && (
              <p id={criticalHintId} className="mt-1 text-[11.5px] text-signal-orange">
                {scan.roots.length
                  ? `There is no critical value for ${act.label} that an initialization can have: the scanner finds ${scan.roots.length} root${scan.roots.length === 1 ? '' : 's'} of eq. (5.73), the largest at C_b = ${scan.roots[scan.roots.length - 1].Cb.toFixed(2)}, and a variance cannot be negative. Laboratory A shows the same.`
                  : `There is no critical value for ${act.label}: eq. (5.73) is never met for K in [0, ${scan.scanned}], so the scanner finds no root at all. Laboratory A shows the same.`}
              </p>
            )}
          </label>

          <Button onClick={open}>open the physics laboratory with these settings →</Button>
        </div>

        <div className="space-y-2">
          <div className="rounded border border-lab-700 bg-lab-850/50 p-3">
            <div className="text-[11px] uppercase tracking-wider text-lab-400">What the theory predicts</div>
            <p className="mt-1 text-[13px] leading-relaxed text-lab-100">{prediction}</p>
          </div>
          <div className="rounded border border-lab-700 bg-lab-850/50 p-3 text-[12.5px] leading-relaxed text-lab-300">
            <div>
              <span className="text-lab-400">Universality class: </span>
              <span className="text-lab-100">{act.universality}</span>
            </div>
            {act.universality === 'K=0' && (
              <div>
                <span className="text-lab-400">Quartic coupling: </span>
                <span className="mono text-lab-100">a₁ = {a1.toFixed(2)}</span>
                <span className="text-lab-400"> → the kernel decays as </span>
                <span className="mono text-lab-100">1/{Math.max(1, -a1)}ℓ</span>
              </div>
            )}
            <div className="mt-1">{act.criticalityNote}</div>
          </div>
          {act.universality === 'none' && (
            <Callout tone="warning" title="This activation is on the book's blacklist">
              {act.label} cannot be tuned to criticality. That is not a limitation of this application: it is the
              book's result, and Laboratory A reproduces it.
            </Callout>
          )}
        </div>
      </div>
    </Panel>
  );
}
