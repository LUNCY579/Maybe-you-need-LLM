import { describe, expect, it } from 'vitest';
import { getActivation, ACTIVATIONS, ACTIVATION_IDS } from '../src/lib/numerics/activations';
import {
  chiParallel,
  chiPerp,
  criticalityRatio,
  findCriticalPoints,
  gOfK,
  gPrimeOfK,
  hOfK,
  kernelDotOfK,
  kernelFlowDiagonal,
  powerLawPrediction,
  taylorA1,
} from '../src/lib/numerics/gaussian';
import { expectationNormalSimpson } from '../src/lib/numerics/quadrature';

describe('activation derivatives', () => {
  it('agrees with central finite differences for every activation', () => {
    for (const id of ACTIVATION_IDS) {
      const act = ACTIVATIONS[id];
      for (const z of [-2.3, -0.7, 0.15, 1.1, 2.9]) {
        if (id === 'relu' && Math.abs(z) < 0.05) continue; // not differentiable at 0
        const h = 1e-6;
        const fd = (act.f(z + h) - act.f(z - h)) / (2 * h);
        expect(Math.abs(fd - act.df(z))).toBeLessThan(2e-5 * Math.max(1, Math.abs(fd)));
      }
    }
  });

  it('reports the documented Taylor coefficients for the K = 0 class', () => {
    const tanh = getActivation('tanh');
    const sin = getActivation('sin');
    expect(tanh.df(0)).toBeCloseTo(1, 10);
    expect(sin.df(0)).toBeCloseTo(1, 10);
    // a_1 = gamma_1 gamma_3 for odd activations: tanh -> -2 (book (5.86)), sin -> -1
    expect(taylorA1(tanh)).toBeCloseTo(-2, 3);
    expect(taylorA1(sin)).toBeCloseTo(-1, 3);
    // and the quadrature reproduces the same coefficient from the exact g(K)
    for (const [act, a1] of [
      [tanh, -2],
      [sin, -1],
    ] as const) {
      // coefficient of K^2 in g(K) = gamma_0^2 + (gamma_1^2 + gamma_0 gamma_2) K + a_1 K^2 + ...
      // Richardson-extrapolated from two finite differences to remove the O(K) error
      const extract = (h: number) => (gOfK(act, h) - gOfK(act, 0) - act.df(0) ** 2 * h) / (h * h);
      const numeric = 2 * extract(0.01) - extract(0.02);
      expect(numeric).toBeCloseTo(a1, 2);
    }
  });
});

describe('g(K) for activations with closed forms', () => {
  it('reproduces the linear and ReLU closed forms', () => {
    const linear = getActivation('linear');
    const relu = getActivation('relu');
    for (const K of [0.2, 1, 3.5]) {
      expect(gOfK(linear, K)).toBeCloseTo(K, 10);
      expect(gOfK(relu, K)).toBeCloseTo(K / 2, 10); // E[ReLU(z)^2] = K/2
      expect(gPrimeOfK(linear, K)).toBeCloseTo(1, 8);
      expect(gPrimeOfK(relu, K)).toBeCloseTo(0.5, 8);
    }
  });

  it('reproduces the quadratic closed form g(K) = 3K^2', () => {
    const q = getActivation('quadratic');
    for (const K of [0.3, 1, 2]) {
      expect(gOfK(q, K)).toBeCloseTo(3 * K * K, 8);
      expect(gPrimeOfK(q, K)).toBeCloseTo(6 * K, 7);
      expect(hOfK(q, K, 1)).toBeCloseTo((6 * K) / 2, 7); // h = (1/2) dchi_parallel/dK
    }
  });

  it('reproduces the sin closed form g(K) = (1 - e^{-2K})/2 from quadrature', () => {
    const sin = getActivation('sin');
    for (const K of [0.1, 0.5, 1.5]) {
      // direct integral for z ~ N(0,K): E[sin^2 z] = (1 - e^{-2K})/2
      const closed = (1 - Math.exp(-2 * K)) / 2;
      const simpson = expectationNormalSimpson((z) => sin.f(z) ** 2, K, { panels: 4000 });
      expect(simpson).toBeCloseTo(closed, 9);
      expect(gOfK(sin, K)).toBeCloseTo(closed, 9);
    }
  });

  it('satisfies g\'(K) = E[z sigma(z) sigma\'(z)]/K (the integration-by-parts identity (5.53))', () => {
    // for F(z) = z^2 both sides equal 1, which is how the power of K is fixed
    for (const K of [0.3, 1.1]) {
      const first = expectationNormalSimpson((z) => z * z * (z * z - K), K, { panels: 20000 }) / (2 * K * K);
      const second = expectationNormalSimpson((z) => z * (2 * z), K, { panels: 20000 }) / (2 * K);
      expect(first).toBeCloseTo(1, 5);
      expect(second).toBeCloseTo(1, 5);
    }
    const linear = getActivation('linear');
    expect(gPrimeOfK(linear, 1.3)).toBeCloseTo(1, 10);
    for (const id of ['tanh', 'gelu', 'relu', 'sin'] as const) {
      const act = getActivation(id);
      for (const K of [0.2, 0.9, 2.0]) {
        const lhs = gPrimeOfK(act, K);
        const rhs = expectationNormalSimpson((z) => (z * act.f(z) * act.df(z)) / K, K, { panels: 20000 });
        expect(Math.abs(lhs - rhs)).toBeLessThan(1e-6 * Math.max(1, Math.abs(rhs)));
      }
    }
  });
});

describe('criticality conditions (Section 5.1-5.3)', () => {
  it('gives constant susceptibilities equal to C_W A^2 for scale-invariant activations', () => {
    for (const id of ['linear', 'relu', 'leakyRelu'] as const) {
      const act = getActivation(id);
      const A2 = act.scaleInvariantA2!;
      for (const K of [0.1, 1, 4]) {
        const Cw = 1 / A2;
        expect(chiParallel(act, K, Cw)).toBeCloseTo(1, 8);
        expect(chiPerp(act, K, Cw)).toBeCloseTo(1, 8);
        expect(criticalityRatio(act, K)).toBeCloseTo(1, 8);
      }
    }
  });

  it('finds the documented critical points: linear (1,0), ReLU (2,0), tanh (1,0), sin (1,0)', () => {
    const cases: Array<[string, number, number]> = [
      ['linear', 1, 0],
      ['relu', 2, 0],
      ['tanh', 1, 0],
      ['sin', 1, 0],
    ];
    for (const [id, Cw, Cb] of cases) {
      const pts = findCriticalPoints(getActivation(id as 'linear'));
      const physical = pts.filter((p) => p.physical);
      expect(physical.length, `${id} should have a physical critical point`).toBeGreaterThan(0);
      const match = physical.some((p) => Math.abs(p.Cw - Cw) < 1e-3 && Math.abs(p.Cb - Cb) < 1e-3);
      expect(match, `${id}: expected (C_W, C_b) = (${Cw}, ${Cb}), got ${JSON.stringify(physical)}`).toBe(true);
    }
  });

  it('rejects the activations that cannot be tuned to criticality, and names which failure it found', () => {
    // Three different findings, and the course distinguishes them because the
    // lesson makes a point of it: the sigmoid has a root that is unphysical,
    // the softplus and the monomial have no root at all.
    const sigmoid = getActivation('sigmoid');
    const sigPts = findCriticalPoints(sigmoid);
    expect(sigPts, 'the sigmoid has exactly one root of eq. (5.73)').toHaveLength(1);
    expect(sigPts[0].Kstar).toBeCloseTo(0, 12);
    expect(sigPts[0].physical).toBe(false);
    // C_b = -sigma(0)^2/sigma'(0)^2 with sigma(0) = 1/2 and sigma'(0) = 1/4,
    // computed by the scanner from the quadrature rather than stored.
    expect(sigPts[0].Cb).toBeCloseTo(-4, 9);
    expect(sigPts[0].Cb).toBeCloseTo(-(sigmoid.f(0) ** 2) / sigmoid.df(0) ** 2, 12);
    expect(sigPts[0].Cw).toBeCloseTo(16, 9);

    for (const id of ['softplus', 'quadratic'] as const) {
      expect(findCriticalPoints(getActivation(id)), `${id} has no root of eq. (5.73)`).toHaveLength(0);
    }

    // The ratio that says so, measured over the window the scanner uses.
    const soft = getActivation('softplus');
    const window = [0, 0.25, 0.5, 1, 2, 3, 4, 5, 6];
    const softRatios = window.map((K) => criticalityRatio(soft, K));
    expect(softRatios[0]).toBeCloseTo(0.59, 1);
    expect(softRatios[softRatios.length - 1]).toBeCloseTo(0.76, 1);
    expect(Math.max(...softRatios)).toBeLessThan(1);

    const quad = getActivation('quadratic');
    // For sigma(z) = z^p the ratio is p/(2p-1), and for the quadratic that is 2/3
    // at every K — a constant below unity, which is why there is no crossing.
    for (const K of window.slice(1)) expect(criticalityRatio(quad, K)).toBeCloseTo(2 / 3, 9);
    // At K = 0 the expression is 0/0, because both gamma_1 and gamma_0 vanish for
    // z^2. The scanner's K -> 0 test is |ratio - 1| < 1e-7, which NaN fails, so
    // the activation is not pushed as a root — which is the right answer.
    expect(Number.isNaN(criticalityRatio(quad, 0))).toBe(true);
  });

  it('reproduces the p/(2p-1) obstruction for monomials', () => {
    for (const p of [2, 3, 4]) {
      const K = 0.7;
      const num = 2 * K * K * p * p * gaussianMoment(2 * p - 2, K);
      const den = gaussianMoment(2 * p + 2, K) - K * gaussianMoment(2 * p, K);
      expect(num / den).toBeCloseTo(p / (2 * p - 1), 10);
    }
  });

  it('measures the p/(2p-1) obstruction with the scanner itself, for every p', () => {
    /*
      The closed-form test above checks the algebra. This one checks the claim
      the lesson makes on screen: that the app's own criticality ratio is
      p/(2p-1), independent of K, and equal to unity only in the linear case it
      is not being asked about. criticalityRatio reads f, df and d2f, so a bare
      monomial is enough to hand it.
    */
    const monomial = (p: number) =>
      ({
        f: (z: number) => Math.pow(z, p),
        df: (z: number) => p * Math.pow(z, p - 1),
        d2f: (z: number) => p * (p - 1) * Math.pow(z, p - 2),
      }) as Parameters<typeof criticalityRatio>[0];

    for (const p of [2, 3, 4, 5]) {
      const act = monomial(p);
      for (const K of [0.1, 0.5, 1, 2.5, 6]) {
        expect(criticalityRatio(act, K), `p = ${p} at K = ${K}`).toBeCloseTo(p / (2 * p - 1), 6);
      }
      // Equality with unity would need p = 1, so the scan can never cross.
      expect(p / (2 * p - 1)).toBeLessThan(1);
      expect(findCriticalPoints(act as Parameters<typeof findCriticalPoints>[0], { Kmax: 6, steps: 300 })).toHaveLength(0);
    }

    // The linear case is exactly the one that does satisfy it, which is what
    // makes 'only for p = 1' a statement rather than a manner of speaking.
    const linear = monomial(1);
    for (const K of [0.1, 1, 6]) expect(criticalityRatio(linear, K)).toBeCloseTo(1, 6);
  });

  it('shows on screen the number the code actually computes', () => {
    /*
      Each activation carries a one-line note, and the initialization lab shows
      it next to the scan. A note that disagrees with the scan is worse than no
      note at all, because the scan is what the student is looking at while
      reading the sentence about it.
    */
    const sig = getActivation('sigmoid');
    expect(sig.criticalityNote).toContain('C_b = -4');
    expect(findCriticalPoints(sig)[0].Cb).toBeCloseTo(-4, 9);

    const quad = getActivation('quadratic');
    // The book's eq. (5.78) is p/(2p-1) = 1, not 2p/(2p-1): the latter is not
    // satisfied even by the linear activation, which is critical.
    expect(quad.criticalityNote).toContain('p/(2p-1) = 1');
    expect(quad.criticalityNote).not.toContain('2p/(2p-1)');
    expect(quad.criticalityNote).toContain('2/3');
    expect(criticalityRatio(quad, 1.3)).toBeCloseTo(2 / 3, 9);

    const soft = getActivation('softplus');
    const stated = soft.criticalityNote.match(/as (0\.\d+) at K = 0 and (0\.\d+) at K = (\d+)/);
    expect(stated, 'the note states the two ratios it is built from').not.toBeNull();
    const [, atZero, atEnd, endK] = stated as RegExpMatchArray;
    expect(criticalityRatio(soft, 0)).toBeCloseTo(Number(atZero), 1);
    expect(criticalityRatio(soft, Number(endK))).toBeCloseTo(Number(atEnd), 1);
  });
});

/** E[z^m] for z ~ N(0,K) */
function gaussianMoment(m: number, K: number): number {
  if (m % 2 === 1) return 0;
  let v = 1;
  for (let k = 1; k <= m / 2; k++) v *= 2 * k - 1;
  return v * Math.pow(K, m / 2);
}

describe('kernel flow', () => {
  it('is exact for the linear activation (book eq. (3.15))', () => {
    const act = getActivation('linear');
    const Cw = 0.8;
    const K1 = 1.7;
    const flow = kernelFlowDiagonal(act, K1, Cw, 0, 12);
    for (let l = 0; l < flow.length; l++) {
      expect(flow[l]).toBeCloseTo(Math.pow(Cw, l) * K1, 10);
    }
  });

  it('keeps the kernel constant at ReLU criticality C_W = 2 (Kaiming)', () => {
    const act = getActivation('relu');
    const flow = kernelFlowDiagonal(act, 1, 2, 0, 50);
    for (const K of flow) expect(K).toBeCloseTo(1, 10);
  });

  it('shows exponential explosion/decay off criticality', () => {
    const act = getActivation('relu');
    const grow = kernelFlowDiagonal(act, 1, 2.2, 0, 12);
    const decay = kernelFlowDiagonal(act, 1, 1.8, 0, 12);
    expect(grow[11]).toBeGreaterThan(grow[10]);
    expect(decay[11]).toBeLessThan(decay[10]);
    expect(Math.log(grow[11] / grow[0]) / 11).toBeCloseTo(Math.log(2.2 / 2), 6);
  });

  it('has a nontrivial fixed point K* = C_b/(1 - C_W) away from criticality for linear nets', () => {
    const act = getActivation('linear');
    const Cw = 0.5;
    const Cb = 0.3;
    const flow = kernelFlowDiagonal(act, 0.05, Cw, Cb, 80);
    expect(flow[79]).toBeCloseTo(Cb / (1 - Cw), 8);
    // exactly zero parallel susceptibility at the fixed point requires C_W = 1
    expect(chiParallel(act, 0.6, 1)).toBeCloseTo(1, 10);
    expect(chiParallel(act, 0.6, Cw)).toBeCloseTo(Cw, 10);
  });

  it('follows the asymptotic 1/((-a_1) l) power law for tanh at criticality (eq. (5.92))', () => {
    const act = getActivation('tanh');
    const K1 = 1;
    const flow = kernelFlowDiagonal(act, K1, 1, 0, 400);
    const last = flow[flow.length - 1];
    const asymptote = powerLawPrediction(-2, K1, flow.length);
    // the exact recursion includes O(K^3) corrections and an O(1) offset: the book
    // states the law as asymptotic, so compare within 15%
    expect(Math.abs(last - asymptote) / asymptote).toBeLessThan(0.15);
    // and the decay must be monotone
    for (let l = 1; l < 60; l++) expect(flow[l]).toBeLessThan(flow[l - 1]);
    // half-life style check: the measured slope in log-log space approaches -1
    const l1 = 200;
    const l2 = 400;
    const slope = Math.log(flow[l2 - 1] / flow[l1 - 1]) / Math.log(l1 / l2);
    expect(slope).toBeGreaterThan(0.85);
    expect(slope).toBeLessThan(1.15);
  });

  it('reports Kdot = E[sigma\'^2] consistent with chi_perp / C_W', () => {
    const act = getActivation('tanh');
    const K = 0.8;
    expect(kernelDotOfK(act, K)).toBeCloseTo(chiPerp(act, K, 1), 12);
    expect(expectationNormalSimpson((z) => act.df(z) ** 2, K, { panels: 8000 })).toBeCloseTo(
      kernelDotOfK(act, K),
      7,
    );
  });
});
