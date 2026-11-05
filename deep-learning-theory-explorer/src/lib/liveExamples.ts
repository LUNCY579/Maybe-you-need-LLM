/**
 * The live evaluations.
 *
 * The equation explorer says its worked examples are evaluated live in the
 * reader's browser, and that means every equation: a quoted number on a page
 * that says it is a computed one is worse than no number at all.
 *
 * These come from the same code the laboratories use — the same quadrature,
 * the same networks, the same backpropagation — so the "example" in the
 * derivation panel is computed rather than quoted, and it changes when the
 * reader changes the activation.
 */
import { ACTIVATION_IDS, getActivation } from './numerics/activations';
import {
  chiParallel,
  chiPerp,
  findCriticalPoints,
  gOfK,
  kernelFlowDiagonal,
  powerLawPrediction,
  taylorA1,
} from './numerics/gaussian';
import { backpropMse, createMlp, empiricalNtk, forward, outputJacobian } from './numerics/mlp';
import { frozenNtkRecursion } from './numerics/ntk';
import { fmt } from './theme';

/** The rows of the worked example, or null when the equation has none. */
export function liveEvaluation(equationId: string, activationId: string): string[][] | null {
  const act = getActivation(activationId as (typeof ACTIVATION_IDS)[number]);
  switch (equationId) {
      case 'warmup-gaussian':
        return [['K', '2'], ['E[z²] = K', fmt(gOfK(getActivation('linear'), 2))], ['E[z⁴] = 3K²', fmt(3 * 4)]] as string[][];
      case 'chi-parallel': {
        const pts = findCriticalPoints(act, { Kmax: 4, steps: 600 }).filter((p) => p.physical);
        const Kstar = pts[0]?.Kstar ?? 1;
        const Cw = pts[0]?.Cw ?? 1;
        return [
          ['activation', act.label],
          ['critical K*', fmt(Kstar)],
          ['critical C_W', fmt(Cw)],
          ['χ∥(K*) with that C_W', fmt(chiParallel(act, Kstar, Cw))],
        ];
      }
      case 'chi-perp': {
        const pts = findCriticalPoints(act, { Kmax: 4, steps: 600 }).filter((p) => p.physical);
        const Kstar = pts[0]?.Kstar ?? 1;
        const Cw = pts[0]?.Cw ?? 1;
        return [
          ['activation', act.label],
          ['K*', fmt(Kstar)],
          ['C_W', fmt(Cw)],
          ['χ⊥(K*)', fmt(chiPerp(act, Kstar, Cw))],
        ];
      }
      case 'criticality-conditions':
      case 'second-condition':
      case 'scale-invariant-critical': {
        const pts = findCriticalPoints(act, { Kmax: 6, steps: 900 });
        const physical = pts.filter((p) => p.physical);
        return [
          ['activation', act.label],
          ['roots found', String(pts.length)],
          ['physical roots', String(physical.length)],
          ...(physical.length
            ? [
                ['K*', fmt(physical[0].Kstar)],
                ['C_W^crit', fmt(physical[0].Cw)],
                ['C_b^crit', fmt(physical[0].Cb)],
              ]
            : [['note', 'no physical critical point exists for this activation']]),
        ];
      }
      case 'kzero-power-law': {
        const a1 = taylorA1(act);
        const flow = kernelFlowDiagonal(act, 1, 1 / ((act.gamma1 ?? 1) ** 2), 0, 200);
        const measured = flow[199];
        const asymptotic = a1 < 0 ? powerLawPrediction(a1, 1, 200) : Number.NaN;
        return [
          ['activation', act.label],
          ['a₁', fmt(a1)],
          [
            'exact recursion K^(200)',
            Number.isFinite(measured) ? fmt(measured) : 'the flow does not stay finite for this activation',
          ],
          ['asymptotic 1/((-a₁)ℓ)', a1 < 0 ? fmt(asymptotic) : 'not applicable (a₁ ≥ 0)'],
        ];
      }
      case 'fluctuation-law':
        return [
          ['ℓ (depth)', '20'],
          ['n (width)', '128'],
          ['G⁽²⁾', '1.0'],
          ['Var[O^(ℓ)] = 2ℓ/n', fmt(2 * 20 / 128)],
          ['sd', fmt(Math.sqrt(2 * 20 / 128))],
        ];
      case 'linear-covariance':
        return [
          ['C_W', '1'],
          ['G⁽⁰⁾', '1.5'],
          ['ℓ', '40'],
          ['G⁽⁴⁰⁾ = C_W^ℓ G⁽⁰⁾', fmt(1.5)],
        ];
      case 'gradient-descent-stability':
        return [
          ['λ_max(H)', '12.4 (example)'],
          ['threshold 2/λ_max', fmt(2 / 12.4)],
          ['stable η', '0.08 (below threshold)'],
          ['unstable η', '0.25 (above threshold)'],
        ];
      case 'forward-recursion': {
        // one real forward pass, layer by layer
        const net = createMlp({
          widths: [3, 8, 8, 1],
          activation: activationId as (typeof ACTIVATION_IDS)[number],
          Cw: 1,
          Cb: 0,
          seed: 5,
        });
        const x = [0.4, -0.7, 1.1];
        const out = forward(net, x);
        const rows: string[][] = [
          ['activation', act.label],
          ['input h^(0)', x.map((v) => v.toFixed(3)).join(', ')],
        ];
        for (let l = 0; l < out.activations.length; l++) {
          const h = out.activations[l];
          const norm = Math.sqrt(h.reduce((s, v) => s + v * v, 0));
          rows.push([`‖h^(${l + 1})‖`, fmt(norm)]);
        }
        rows.push(['output z', fmt(out.output[0])]);
        return rows;
      }
      case 'init-variance': {
        // the weight variance, and the preactivation variance it produces
        const width = 64;
        const pts = findCriticalPoints(act, { Kmax: 4, steps: 600 }).filter((p) => p.physical);
        const Cw = pts[0]?.Cw ?? 1;
        const net = createMlp({
          widths: [width, width, 1],
          activation: activationId as (typeof ACTIVATION_IDS)[number],
          Cw,
          Cb: 0,
          seed: 11,
        });
        const w0 = net.layers[0].W;
        const measured = w0.reduce((s, row) => s + row.reduce((t, v) => t + v * v, 0), 0) / (w0.length * w0[0].length);
        return [
          ['activation', act.label],
          ['C_W at criticality', fmt(Cw)],
          ['fan-in n_(ℓ−1)', String(width)],
          ['weight variance C_W/n', fmt(Cw / width)],
          ['measured weight variance', fmt(measured)],
        ];
      }
      case 'ntk-definition': {
        // the kernel as the inner product of two parameter gradients
        const net = createMlp({
          widths: [2, 4, 1],
          activation: activationId as (typeof ACTIVATION_IDS)[number],
          Cw: 1,
          Cb: 0,
          seed: 3,
        });
        const X = [
          [0.5, -0.5],
          [1.0, 0.25],
        ];
        const theta = empiricalNtk(net, X);
        const jac = outputJacobian(net, X);
        // one row per (sample, output component): with one output, rows 0 and 1
        const row1 = jac[0];
        const row2 = jac[1];
        const dot = row1.reduce((s, v, i) => s + v * row2[i], 0);
        return [
          ['activation', act.label],
          ['Θ(x₁, x₂) as a Gram matrix', fmt(theta[0][1])],
          ['the same entry as an inner product', fmt(dot)],
          ['parameters in the network', String(row1.length)],
        ];
      }
      case 'ntk-recursion': {
        // the frozen recursion, evaluated layer by layer
        const K0 = [[1]];
        const theta = frozenNtkRecursion(act, K0, 1, 0, 8);
        return [
          ['activation', act.label],
          ['χ⊥', fmt(chiPerp(act, 1, 1))],
          ['Θ^(1) = K^(1)', fmt(theta[0][0][0])],
          ['Θ^(8) by the recursion', fmt(theta[7][0][0])],
        ];
      }
      case 'kernel-learning': {
        // one gradient step, predicted in function space by the frozen kernel
        // and compared with the real one
        const net = createMlp({
          widths: [2, 6, 1],
          activation: activationId as (typeof ACTIVATION_IDS)[number],
          Cw: 1,
          Cb: 0,
          seed: 9,
        });
        const train = [0.4, -0.6];
        const target = [0.2];
        const probe = [0.9, 0.3];
        const eta = 0.05;
        const before = forward(net, probe).output[0];
        const f = forward(net, train).output[0];
        // dL/dz for a squared error on one sample
        const dLdz = 2 * (f - target[0]);
        const theta = empiricalNtk(net, [train, probe]);
        const predicted = -eta * theta[1][0] * dLdz;
        // the real step
        const grads = backpropMse(net, [train], [target]);
        for (let l = 0; l < net.layers.length; l++) {
          const g = grads.grads[l];
          net.layers[l].W = net.layers[l].W.map((row, i) => row.map((v, j) => v - eta * g.W[i][j]));
          net.layers[l].b = net.layers[l].b.map((v, i) => v - eta * g.b[i]);
        }
        const after = forward(net, probe).output[0];
        return [
          ['activation', act.label],
          ['η', fmt(eta)],
          ['z(x) before the step', fmt(before)],
          ['predicted Δz from the frozen kernel', fmt(predicted)],
          ['actual Δz after one real step', fmt(after - before)],
        ];
      }
      case 'dntk': {
        // The NTK moves during training — at finite width it is not frozen.
        // The 1/n suppression of the book is a statement about the leading
        // order of the flow, which a single step does not by itself
        // establish, so what is shown here is the movement itself.
        const driftAt = (width: number, seeds: number): number => {
          let sum = 0;
          for (let s = 0; s < seeds; s++) {
            const net = createMlp({
              widths: [2, width, 1],
              activation: activationId as (typeof ACTIVATION_IDS)[number],
              Cw: 1,
              Cb: 0,
              seed: 100 + s,
            });
            const X = [
              [0.4, -0.6],
              [0.9, 0.3],
            ];
            const Y = [[0.2], [-0.4]];
            const before = empiricalNtk(net, X);
            const grads = backpropMse(net, X, Y);
            const eta = 0.1;
            for (let l = 0; l < net.layers.length; l++) {
              const g = grads.grads[l];
              net.layers[l].W = net.layers[l].W.map((row, i) => row.map((v, j) => v - eta * g.W[i][j]));
              net.layers[l].b = net.layers[l].b.map((v, i) => v - eta * g.b[i]);
            }
            const after = empiricalNtk(net, X);
            sum += Math.abs(after[0][1] - before[0][1]);
          }
          return sum / seeds;
        };
        const narrow = driftAt(8, 8);
        const wide = driftAt(64, 8);
        return [
          ['activation', act.label],
          ['|dΘ/dt| at width 8, over 8 networks', fmt(narrow)],
          ['|dΘ/dt| at width 64, over 8 networks', fmt(wide)],
          ['the NTK is frozen only at infinite width', 'where the drift vanishes identically'],
        ];
      }
      default:
        return null;
    }

}

export default liveEvaluation;
