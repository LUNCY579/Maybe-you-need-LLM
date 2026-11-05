/**
 * Gaussian expectation machinery.
 *
 * The whole of Chapter 5 of the textbook is built on Gaussian expectations such as
 *
 *    g(K)      = E_{(z,z) ~ N(0, diag(K,K))}[ sigma(z) sigma(z) ]           (5.49)
 *    Kdot(K)   = E_{z ~ N(0,K)}[ sigma'(z) sigma'(z) ]                      (5.51)
 *
 * which have no closed form for general activations but are smooth, one- or
 * two-dimensional integrals. We evaluate them with Gauss-Hermite quadrature
 * (exact for polynomials up to degree 2n-1, spectrally accurate for analytic
 * integrands) and cross-check with an independent composite Simpson rule in the
 * test suite, so that the numbers driving the criticality analysis are never
 * taken on faith.
 *
 * Convention: nodes/weights satisfy (1/sqrt(pi)) * sum_i w_i f(x_i) ~ E[f(X)],
 * X ~ N(0,1).
 */

export interface QuadratureRule {
  n: number;
  /** nodes of the standard normal */
  x: number[];
  /** normalized weights, sum = 1 */
  w: number[];
}

const memo = new Map<number, QuadratureRule>();

/**
 * Gauss-Hermite nodes/weights via Newton iteration on the Hermite recurrence
 * (Numerical Recipes style), then rescaled for the standard normal measure.
 */
export function hermiteRule(n = 60): QuadratureRule {
  if (n < 2) throw new Error('need at least 2 quadrature nodes');
  if (n > 128) {
    // Beyond ~128 nodes the three-term recurrence loses accuracy in double
    // precision; 128 nodes already integrate the smooth integrands used here to
    // far below any tolerance the experiments depend on.
    throw new Error('at most 128 quadrature nodes are supported');
  }
  const cached = memo.get(n);
  if (cached) return cached;

  const MAXIT = 100;
  // 3e-14 is the smallest tolerance the double-precision recurrence reliably
  // reaches; the numerical-Recipes value works for n in the hundreds of nodes.
  const EPS = 3e-14;
  const PIM4 = 0.7511255444649425;
  const x = new Array<number>(n).fill(0);
  const w = new Array<number>(n).fill(0);

  const m = Math.floor((n + 1) / 2);
  let z = 0;
  for (let i = 1; i <= m; i++) {
    // Seeds for the i-th largest root; the i >= 3 cases extrapolate from the roots
    // already found (stored in x), which is what makes the outer roots distinct.
    if (i === 1) {
      z = Math.sqrt(2 * n + 1) - 1.85575 * Math.pow(2 * n + 1, -1 / 6);
    } else if (i === 2) {
      z = z - (1.14 * Math.pow(n, 0.426)) / z;
    } else if (i === 3) {
      z = 1.86 * z - 0.86 * x[0];
    } else if (i === 4) {
      z = 1.91 * z - 0.91 * x[1];
    } else {
      z = 2 * z - x[i - 3];
    }
    let pp = 0;
    let zPrev = 0;
    for (let iter = 0; iter < MAXIT; iter++) {
      let p1 = PIM4;
      let p2 = 0;
      for (let j = 1; j <= n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = z * Math.sqrt(2 / j) * p2 - Math.sqrt((j - 1) / j) * p3;
      }
      pp = Math.sqrt(2 * n) * p2;
      zPrev = z;
      z = zPrev - p1 / pp;
      if (Math.abs(z - zPrev) <= EPS) break;
      if (iter === MAXIT - 1) throw new Error('Gauss-Hermite Newton iteration did not converge');
    }
    const ww = 2 / (pp * pp);
    x[i - 1] = z;
    x[n - i] = -z;
    w[i - 1] = ww;
    w[n - i] = ww;
  }

  // The Newton iteration returns the rule for integral e^{-x^2} f(x) dx, i.e. nodes
  // for X ~ N(0, 1/2). Transform to the standard normal: X = sqrt(2) * x, weights / sqrt(pi).
  const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const xs = order.map((i) => Math.SQRT2 * x[i]);
  const ws = order.map((i) => w[i] / Math.sqrt(Math.PI));
  const sum = ws.reduce((a, b) => a + b, 0);
  const rule: QuadratureRule = { n, x: xs, w: ws.map((v) => v / sum) };
  memo.set(n, rule);
  return rule;
}

/** E[f(X)] for X ~ N(0,1). */
export function expectationNormal(f: (x: number) => number, n = 60): number {
  const { x, w } = hermiteRule(n);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += w[i] * f(x[i]);
  return s;
}

/** E[f(X)] for X ~ N(0,K); requires K >= 0. */
export function expectationNormalVariance(f: (x: number) => number, K: number, n = 60): number {
  if (K < 0) throw new Error(`variance must be non-negative, got ${K}`);
  if (K === 0) return f(0);
  const s = Math.sqrt(K);
  return expectationNormal((x) => f(s * x), n);
}

/**
 * E[f(X,Y)] for (X,Y) ~ N(0, [[K11,K12],[K12,K22]]) using a Cholesky factor.
 * Validates the covariance matrix so that degenerate experiments fail loudly
 * instead of producing silent NaNs.
 */
export function expectationBivariate(
  f: (x: number, y: number) => number,
  K11: number,
  K12: number,
  K22: number,
  n = 60,
): number {
  validateCovariance(K11, K12, K22);
  if (K11 === 0) {
    // both directions collapse to a point mass at the origin
    return f(0, 0);
  }
  const { x, w } = hermiteRule(n);
  const a11 = Math.sqrt(K11);
  const a21 = K12 / a11;
  const a22sq = K22 - K12 * K12 / K11;
  const a22 = a22sq > 0 ? Math.sqrt(a22sq) : 0;
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const u = a11 * x[i];
    for (let j = 0; j < x.length; j++) {
      const v = a21 * x[i] + a22 * x[j];
      s += w[i] * w[j] * f(u, v);
    }
  }
  return s;
}

export function validateCovariance(K11: number, K12: number, K22: number): void {
  if (!Number.isFinite(K11) || !Number.isFinite(K12) || !Number.isFinite(K22)) {
    throw new Error(`non-finite covariance entry: ${K11}, ${K12}, ${K22}`);
  }
  if (K11 < -1e-12 || K22 < -1e-12) {
    throw new Error(`negative variances in covariance matrix: ${K11}, ${K22}`);
  }
  const bound = Math.sqrt(Math.max(K11, 0) * Math.max(K22, 0)) * (1 + 1e-9) + 1e-12;
  if (Math.abs(K12) > bound) {
    throw new Error(
      `covariance matrix is not positive semidefinite: |K12|=${Math.abs(K12)} > sqrt(K11*K22)=${bound.toFixed(6)}`,
    );
  }
}

/**
 * Independent reference integrator: composite Simpson rule for
 * E[f(X)] = integral f(x) (2 pi K)^{-1/2} e^{-x^2/(2K)} dx, X ~ N(0,K).
 * Used to cross-check the quadrature-based expectations in the test suite
 * (two different numerical methods must agree, otherwise neither is trusted).
 */
export function expectationNormalSimpson(
  f: (x: number) => number,
  K: number,
  { panels = 4000, halfWidthInStd = 12 }: { panels?: number; halfWidthInStd?: number } = {},
): number {
  if (K < 0) throw new Error('variance must be non-negative');
  if (K === 0) return f(0);
  const sd = Math.sqrt(K);
  const a = -halfWidthInStd * sd;
  const b = halfWidthInStd * sd;
  const n = panels % 2 === 0 ? panels : panels + 1;
  const h = (b - a) / n;
  const norm = 1 / Math.sqrt(2 * Math.PI * K);
  const pdf = (x: number) => norm * Math.exp(-(x * x) / (2 * K));
  let s = pdf(a) * f(a) + pdf(b) * f(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    s += (i % 2 === 0 ? 2 : 4) * pdf(x) * f(x);
  }
  return (s * h) / 3;
}

/** Monte-Carlo reference for the bivariate expectation (used only for cross-checks). */
export function expectationBivariateMC(
  f: (x: number, y: number) => number,
  K11: number,
  K12: number,
  K22: number,
  samples = 200000,
  seedFn: () => number = mulberryFromSeed(12345),
): { value: number; stderr: number } {
  validateCovariance(K11, K12, K22);
  const a11 = Math.sqrt(K11);
  const a21 = K11 === 0 ? 0 : K12 / a11;
  const a22sq = K11 === 0 ? K22 : K22 - (K12 * K12) / K11;
  const a22 = a22sq > 0 ? Math.sqrt(a22sq) : 0;
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < samples; i++) {
    const z1 = normalFrom(seedFn);
    const z2 = normalFrom(seedFn);
    const v = f(a11 * z1, a21 * z1 + a22 * z2);
    s += v;
    s2 += v * v;
  }
  const mean = s / samples;
  const varv = Math.max(0, s2 / samples - mean * mean);
  return { value: mean, stderr: Math.sqrt(varv / samples) };
}

function mulberryFromSeed(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function normalFrom(u: () => number): number {
  let a = 0;
  let b = 0;
  let s = 0;
  do {
    a = u() * 2 - 1;
    b = u() * 2 - 1;
    s = a * a + b * b;
  } while (s >= 1 || s === 0);
  return a * Math.sqrt((-2 * Math.log(s)) / s);
}
