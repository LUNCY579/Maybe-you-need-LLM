import { describe, expect, it } from 'vitest'
import {
  cholesky,
  frobeniusNorm,
  invert,
  isSymmetric,
  jacobiEigen,
  powerIteration,
  solveLinear,
  symmetrize,
  trace,
} from '../src/linalg.js'
import { identity, matmul, matVec, transpose } from '../src/math.js'

describe('jacobiEigen', () => {
  it('diagonalises a symmetric matrix', () => {
    const a = [
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ]
    const { values, vectors } = jacobiEigen(a)
    expect(values.length).toBe(3)
    // Values must be ascending.
    expect(values[0]).toBeLessThanOrEqual(values[1])
    expect(values[1]).toBeLessThanOrEqual(values[2])
    // A·V = V·Λ
    for (let j = 0; j < 3; j++) {
      const v = [vectors[0][j], vectors[1][j], vectors[2][j]]
      const av = matVec(a, v)
      const expected = v.map((x) => x * values[j])
      av.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 8))
    }
  })

  it('reproduces the eigenvalues of a diagonal matrix', () => {
    const { values } = jacobiEigen([
      [3, 0, 0],
      [0, 1, 0],
      [0, 0, 2],
    ])
    expect([...values].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('returns unit eigenvectors', () => {
    const { vectors } = jacobiEigen([
      [2, 1],
      [1, 2],
    ])
    for (const v of vectors) {
      const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0))
      expect(norm).toBeCloseTo(1, 8)
    }
  })
})

describe('powerIteration', () => {
  it('finds the dominant eigenvalue of a symmetric matrix', () => {
    const a = [
      [4, 1],
      [1, 3],
    ]
    const { value } = powerIteration(a, [1, 0])
    // Eigenvalues are (7 ± √5)/2.
    expect(value).toBeCloseTo((7 + Math.sqrt(5)) / 2, 6)
  })
})

describe('cholesky', () => {
  it('factorises a positive definite matrix', () => {
    const a = [
      [4, 2],
      [2, 3],
    ]
    const l = cholesky(a)
    expect(l).not.toBeNull()
    const reconstructed = matmul(l!, transpose(l!))
    reconstructed.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(a[i][j], 10)))
  })

  it('returns null for a matrix that is not positive definite', () => {
    expect(cholesky([[1, 2], [2, 1]])).toBeNull()
  })
})

describe('solveLinear', () => {
  it('solves a square system', () => {
    const x = solveLinear(
      [
        [2, 1],
        [1, 3],
      ],
      [3, 4],
    )
    expect(x[0]).toBeCloseTo(1, 10)
    expect(x[1]).toBeCloseTo(1, 10)
  })

  it('throws on a singular system', () => {
    expect(() =>
      solveLinear(
        [
          [1, 1],
          [2, 2],
        ],
        [1, 2],
      ),
    ).toThrow(/singular/)
  })
})

describe('invert', () => {
  it('produces a true inverse', () => {
    const a = [
      [4, 7],
      [2, 6],
    ]
    const inv = invert(a)
    const product = matmul(a, inv)
    const expected = identity(2)
    product.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i][j], 10)))
  })
})

describe('matrix utilities', () => {
  it('computes the trace and Frobenius norm', () => {
    expect(
      trace([
        [1, 2],
        [3, 4],
      ]),
    ).toBe(5)
    expect(
      frobeniusNorm([
        [3, 0],
        [0, 4],
      ]),
    ).toBe(5)
  })

  it('detects symmetry', () => {
    expect(
      isSymmetric([
        [1, 2],
        [2, 1],
      ]),
    ).toBe(true)
    expect(
      isSymmetric([
        [1, 2],
        [3, 1],
      ]),
    ).toBe(false)
  })

  it('symmetrises', () => {
    const s = symmetrize([
      [1, 2],
      [0, 1],
    ])
    expect(s[0][1]).toBe(1)
    expect(s[1][0]).toBe(1)
  })
})
