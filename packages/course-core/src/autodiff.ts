/**
 * A minimal reverse-mode automatic differentiation engine.
 *
 * Writing the backward pass of a transformer by hand is a reliable way to
 * ship a broken model: the forward pass looks right, the loss falls, and the
 * samples are nonsense. So this module makes the gradient *automatic* — the
 * forward pass is written once, and the backward pass is derived from the
 * tape by construction.
 *
 * It is deliberately tiny: dense tensors with a row-major layout, a handful of
 * operations, and a topological tape. The test suite checks every parameter
 * against a central finite difference, which is what makes it trustworthy.
 */

export interface Tensor {
  /** The values, row-major. */
  data: number[]
  /** The gradients, same layout. */
  grad: number[]
  /** The shape. */
  shape: number[]
  /** The nodes this one was computed from. */
  parents: Tensor[]
  /** The backward pass, for a computed node. */
  backward?: (out: Tensor) => void
}

export class Tape {
  private nodes: Tensor[] = []

  /**
   * Allocate a parameter.
   *
   * A parameter is *not* part of the graph: it is a leaf that gradients
   * accumulate into, and it survives a `clear()`. The graph holds only the
   * intermediate values of one forward pass.
   */
  parameter(data: number[], shape: number[]): Tensor {
    return {
      data: data.slice(),
      grad: new Array<number>(data.length).fill(0),
      shape: shape.slice(),
      parents: [],
    }
  }

  /** Allocate a leaf tensor of zeros. */
  zeros(shape: number[]): Tensor {
    return this.parameter(new Array<number>(shape[0]! * (shape[1] ?? 1)).fill(0), shape)
  }

  /** Record an operation and its backward pass. */
  op(
    data: number[],
    shape: number[],
    parents: Tensor[],
    backward: (out: Tensor) => void,
  ): Tensor {
    const tensor: Tensor = {
      data,
      grad: new Array<number>(data.length).fill(0),
      shape,
      parents,
      backward,
    }
    this.nodes.push(tensor)
    return tensor
  }

  /** Accumulate a gradient into a leaf. */
  static accumulate(target: Tensor, values: number[]): void {
    for (let i = 0; i < values.length; i++) {
      target.grad[i] = (target.grad[i] ?? 0) + (values[i] ?? 0)
    }
  }

  /** Forget the graph, keeping the parameters and their gradients. */
  clear(): void {
    this.nodes = []
  }

  /**
   * Back-propagate from a scalar loss.
   *
   * The tape is in creation order, so reversing it is a valid topological
   * order: every node's backward runs after its consumers', and every
   * gradient reaches its leaf before the pass ends.
   */
  backward(loss: Tensor): void {
    loss.grad[0] = 1
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i]!
      node.backward?.(node)
    }
  }
}

/* ------------------------------------------------------------------ helpers */

function rows(t: Tensor): number {
  return t.shape[0] ?? 1
}

function cols(t: Tensor): number {
  return t.shape[1] ?? 1
}

/** Matrix–matrix product, with the shapes checked. */
export function matmul(tape: Tape, a: Tensor, b: Tensor): Tensor {
  const m = rows(a)
  const k = cols(a)
  const k2 = rows(b)
  const n = cols(b)
  if (k !== k2) {
    throw new Error(`matmul: incompatible shapes (${m}x${k}) x (${k2}x${n})`)
  }

  const data = new Array<number>(m * n).fill(0)
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const av = a.data[i * k + p]!
      if (av === 0) continue
      for (let j = 0; j < n; j++) {
        data[i * n + j] = (data[i * n + j] ?? 0) + av * b.data[p * n + j]!
      }
    }
  }

  const out = tape.op(data, [m, n], [a, b], (out) => {
    const da = new Array<number>(m * k).fill(0)
    const db = new Array<number>(k * n).fill(0)
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const d = out.grad[i * n + j]!
        if (d === 0) continue
        for (let p = 0; p < k; p++) {
          da[i * k + p] = (da[i * k + p] ?? 0) + d * b.data[p * n + j]!
          db[p * n + j] = (db[p * n + j] ?? 0) + d * a.data[i * k + p]!
        }
      }
    }
    Tape.accumulate(a, da)
    Tape.accumulate(b, db)
  })

  return out
}

/** Element-wise addition of two tensors of the same shape. */
export function add(tape: Tape, a: Tensor, b: Tensor): Tensor {
  if (a.data.length !== b.data.length) {
    throw new Error('add: shapes must match')
  }
  const data = a.data.map((value, i) => value + (b.data[i] ?? 0))
  return tape.op(data, a.shape, [a, b], (out) => {
    Tape.accumulate(a, out.grad)
    Tape.accumulate(b, out.grad)
  })
}

/** Add a scalar to every element. */
export function addScalar(tape: Tape, a: Tensor, value: number): Tensor {
  const data = a.data.map((v) => v + value)
  return tape.op(data, a.shape, [a], (out) => {
    Tape.accumulate(a, out.grad)
  })
}

/** Multiply every element by a scalar. */
export function scale(tape: Tape, a: Tensor, factor: number): Tensor {
  const data = a.data.map((v) => v * factor)
  return tape.op(data, a.shape, [a], (out) => {
    Tape.accumulate(a, out.grad.map((g) => g * factor))
  })
}

/** Transpose a matrix. */
export function transpose(tape: Tape, a: Tensor): Tensor {
  const m = rows(a)
  const n = cols(a)
  const data = new Array<number>(m * n).fill(0)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      data[j * m + i] = a.data[i * n + j]!
    }
  }
  return tape.op(data, [n, m], [a], (out) => {
    const da = new Array<number>(m * n).fill(0)
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        da[i * n + j] = (da[i * n + j] ?? 0) + out.grad[j * m + i]!
      }
    }
    Tape.accumulate(a, da)
  })
}

/** A row-wise softmax. */
export function softmaxRows(tape: Tape, a: Tensor): Tensor {
  const r = rows(a)
  const c = cols(a)
  const data = new Array<number>(r * c).fill(0)
  const probs: number[][] = []

  for (let i = 0; i < r; i++) {
    const row = a.data.slice(i * c, i * c + c)
    const max = Math.max(...row)
    const exps = row.map((v) => Math.exp(v - max))
    const total = exps.reduce((a, b) => a + b, 0)
    const p = exps.map((v) => v / total)
    probs.push(p)
    for (let j = 0; j < c; j++) data[i * c + j] = p[j]!
  }

  return tape.op(data, a.shape, [a], (out) => {
    const da = new Array<number>(r * c).fill(0)
    for (let i = 0; i < r; i++) {
      const p = probs[i]!
      let dot = 0
      for (let j = 0; j < c; j++) dot += (out.grad[i * c + j] ?? 0) * p[j]!
      for (let j = 0; j < c; j++) {
        da[i * c + j] = (da[i * c + j] ?? 0) + p[j]! * ((out.grad[i * c + j] ?? 0) - dot)
      }
    }
    Tape.accumulate(a, da)
  })
}

/**
 * Root-mean-square normalisation, row-wise.
 *
 * RMSNorm has no mean subtraction and no bias, which makes it a little
 * simpler than LayerNorm and is what most current models use.
 */
export function rmsNorm(tape: Tape, a: Tensor, gain: Tensor, epsilon = 1e-6): Tensor {
  const r = rows(a)
  const c = cols(a)
  const data = new Array<number>(r * c).fill(0)
  const invRms: number[] = []

  for (let i = 0; i < r; i++) {
    let sumSquares = 0
    for (let j = 0; j < c; j++) sumSquares += (a.data[i * c + j] ?? 0) ** 2
    const inv = 1 / Math.sqrt(sumSquares / c + epsilon)
    invRms.push(inv)
    for (let j = 0; j < c; j++) {
      data[i * c + j] = (a.data[i * c + j] ?? 0) * inv * (gain.data[j] ?? 1)
    }
  }

  return tape.op(data, a.shape, [a, gain], (out) => {
    const da = new Array<number>(r * c).fill(0)
    const dgain = new Array<number>(c).fill(0)
    for (let i = 0; i < r; i++) {
      const inv = invRms[i]!
      // The gradient of the normalised value: du_j = dy_j · g_j.
      const dxhat = new Array<number>(c).fill(0)
      for (let j = 0; j < c; j++) {
        const g = gain.data[j] ?? 1
        const d = out.grad[i * c + j] ?? 0
        dxhat[j] = d * g
        dgain[j] = (dgain[j] ?? 0) + d * (a.data[i * c + j] ?? 0) * inv
      }
      // rms = sqrt(mean(x²) + eps), so d(rms)/dx_k = x_k / (c · rms) and
      // d(1/rms)/dx_k = −x_k · inv³ / c. The 1/c is the one the mean
      // contributes, and leaving it out makes every gradient wrong.
      let dot = 0
      for (let j = 0; j < c; j++) dot += dxhat[j]! * (a.data[i * c + j] ?? 0)
      for (let j = 0; j < c; j++) {
        const x = a.data[i * c + j] ?? 0
        da[i * c + j] = (da[i * c + j] ?? 0) + inv * (dxhat[j]! - (x * inv * inv * dot) / c)
      }
    }
    Tape.accumulate(a, da)
    Tape.accumulate(gain, dgain)
  })
}

/** The tanh approximation of GELU. */
export function gelu(tape: Tape, a: Tensor): Tensor {
  const c = Math.sqrt(2 / Math.PI)
  const data = a.data.map((v) => 0.5 * v * (1 + Math.tanh(c * (v + 0.044715 * v ** 3))))
  return tape.op(data, a.shape, [a], (out) => {
    const da = a.data.map((v, i) => {
      const inner = c * (v + 0.044715 * v ** 3)
      const th = Math.tanh(inner)
      const dInner = c * (1 + 3 * 0.044715 * v * v)
      const dGelu = 0.5 * (1 + th) + 0.5 * v * (1 - th * th) * dInner
      return (out.grad[i] ?? 0) * dGelu
    })
    Tape.accumulate(a, da)
  })
}

/** Gather rows of a matrix by index. */
export function gatherRows(tape: Tape, a: Tensor, indices: number[]): Tensor {
  const c = cols(a)
  const data = new Array<number>(indices.length * c).fill(0)
  for (let i = 0; i < indices.length; i++) {
    for (let j = 0; j < c; j++) {
      data[i * c + j] = a.data[indices[i]! * c + j]!
    }
  }
  return tape.op(data, [indices.length, c], [a], (out) => {
    const da = new Array<number>(a.data.length).fill(0)
    for (let i = 0; i < indices.length; i++) {
      for (let j = 0; j < c; j++) {
        da[indices[i]! * c + j] = (da[indices[i]! * c + j] ?? 0) + (out.grad[i * c + j] ?? 0)
      }
    }
    Tape.accumulate(a, da)
  })
}

/**
 * Apply a causal mask: a position may not attend to a later position.
 *
 * The matrix is (sequence · heads) × (sequence · heads), so the comparison
 * has to be made on the *positions*, not on the flattened indices: with more
 * than one head, the flattened comparison would also block a position from
 * attending to the other heads at its own position.
 */
export function causalMask(tape: Tape, a: Tensor, heads = 1): Tensor {
  const r = rows(a)
  const c = cols(a)
  const data = a.data.slice()
  for (let i = 0; i < r; i++) {
    const queryPosition = Math.floor(i / heads)
    for (let j = 0; j < c; j++) {
      const keyPosition = Math.floor(j / heads)
      if (keyPosition > queryPosition) data[i * c + j] = -1e30
    }
  }
  return tape.op(data, a.shape, [a], (out) => {
    const da = new Array<number>(a.data.length).fill(0)
    for (let i = 0; i < r; i++) {
      const queryPosition = Math.floor(i / heads)
      for (let j = 0; j < c; j++) {
        const keyPosition = Math.floor(j / heads)
        if (keyPosition > queryPosition) continue
        da[i * c + j] = (da[i * c + j] ?? 0) + (out.grad[i * c + j] ?? 0)
      }
    }
    Tape.accumulate(a, da)
  })
}

/** Scale a tensor by 1/√d, for the attention scores. */
export function scaleBy(tape: Tape, a: Tensor, factor: number): Tensor {
  return scale(tape, a, factor)
}

/**
 * The cross-entropy of a batch of logits against integer targets.
 *
 * The logits are (rows × vocabSize) and the targets are the correct class of
 * each row. The result is the *mean* loss.
 */
export function crossEntropy(tape: Tape, logits: Tensor, targets: number[]): Tensor {
  const r = rows(logits)
  const c = cols(logits)
  if (targets.length !== r) {
    throw new Error(`crossEntropy: ${targets.length} targets for ${r} rows`)
  }

  let loss = 0
  const probs: number[][] = []
  for (let i = 0; i < r; i++) {
    const row = logits.data.slice(i * c, i * c + c)
    const max = Math.max(...row)
    const exps = row.map((v) => Math.exp(v - max))
    const total = exps.reduce((a, b) => a + b, 0)
    const p = exps.map((v) => v / total)
    probs.push(p)
    loss -= Math.log(Math.max(p[targets[i]!] ?? 1e-300, 1e-300))
  }
  loss /= r

  const data = [loss]
  const out = tape.op(data, [1], [logits], () => {
    const dlogits = new Array<number>(r * c).fill(0)
    for (let i = 0; i < r; i++) {
      const p = probs[i]!
      for (let j = 0; j < c; j++) {
        const indicator = j === targets[i] ? 1 : 0
        dlogits[i * c + j] = ((p[j] ?? 0) - indicator) / r
      }
    }
    Tape.accumulate(logits, dlogits)
  })

  return out
}

/** Slice a matrix's rows. */
export function sliceRows(tape: Tape, a: Tensor, from: number, to: number): Tensor {
  const c = cols(a)
  const data: number[] = []
  for (let i = from; i < to; i++) {
    for (let j = 0; j < c; j++) data.push(a.data[i * c + j]!)
  }
  return tape.op(data, [to - from, c], [a], (out) => {
    const da = new Array<number>(a.data.length).fill(0)
    for (let i = from; i < to; i++) {
      for (let j = 0; j < c; j++) {
        da[i * c + j] = (da[i * c + j] ?? 0) + (out.grad[(i - from) * c + j] ?? 0)
      }
    }
    Tape.accumulate(a, da)
  })
}

/** A tensor's data, as a plain array. */
export function values(t: Tensor): number[] {
  return t.data
}

/**
 * The sum of every element of a tensor.
 *
 * This is how a scalar loss is built from a tensor output, and it is the
 * operation the test suite uses to differentiate an op in isolation.
 */
export function sumAll(tape: Tape, a: Tensor): Tensor {
  const total = a.data.reduce((sum, value) => sum + value, 0)
  return tape.op([total], [1], [a], (out) => {
    Tape.accumulate(a, a.data.map(() => out.grad[0] ?? 0))
  })
}

/** The rectified linear unit. */
export function relu(tape: Tape, a: Tensor): Tensor {
  const data = a.data.map((value) => (value > 0 ? value : 0))
  return tape.op(data, a.shape, [a], (out) => {
    const da = a.data.map((value, i) => (value > 0 ? (out.grad[i] ?? 0) : 0))
    Tape.accumulate(a, da)
  })
}

/**
 * An element-wise operation over two tensors of the same shape.
 *
 * The backward pass is supplied by the caller, which keeps the engine small
 * and makes the derivative of each element-wise operation explicit.
 */
export function elementwise(
  tape: Tape,
  a: Tensor,
  b: Tensor,
  forward: (x: number, y: number) => number,
  backward: (x: number, y: number, output: number) => [number, number],
): Tensor {
  if (a.data.length !== b.data.length) {
    throw new Error('elementwise: shapes must match')
  }
  const data = a.data.map((value, i) => forward(value, b.data[i] ?? 0))
  return tape.op(data, a.shape, [a, b], (out) => {
    const da = new Array<number>(a.data.length).fill(0)
    const db = new Array<number>(b.data.length).fill(0)
    for (let i = 0; i < a.data.length; i++) {
      const [ga, gb] = backward(a.data[i] ?? 0, b.data[i] ?? 0, out.grad[i] ?? 0)
      da[i] = (da[i] ?? 0) + ga
      db[i] = (db[i] ?? 0) + gb
    }
    Tape.accumulate(a, da)
    Tape.accumulate(b, db)
  })
}

/** The square of every element. */
export function square(tape: Tape, a: Tensor): Tensor {
  return elementwise(
    tape,
    a,
    a,
    (x) => x * x,
    (x, _y, g) => [2 * x * g, 0],
  )
}

/** The absolute value of every element. */
export function abs(tape: Tape, a: Tensor): Tensor {
  return elementwise(
    tape,
    a,
    a,
    (x) => Math.abs(x),
    (x, _y, g) => [x >= 0 ? g : -g, 0],
  )
}

/**
 * Add a vector to every row of a matrix.
 *
 * This is the bias operation, and it is separate from `add` because the shapes
 * differ: a bias is a vector and the thing it is added to is a matrix.
 */
export function addBias(tape: Tape, a: Tensor, bias: Tensor): Tensor {
  const rows = a.shape[0] ?? 1
  const cols = a.shape[1] ?? a.data.length
  const data = new Array<number>(a.data.length).fill(0)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      data[i * cols + j] = (a.data[i * cols + j] ?? 0) + (bias.data[j] ?? 0)
    }
  }
  return tape.op(data, a.shape, [a, bias], (out) => {
    const da = new Array<number>(a.data.length).fill(0)
    const db = new Array<number>(bias.data.length).fill(0)
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const g = out.grad[i * cols + j] ?? 0
        da[i * cols + j] = (da[i * cols + j] ?? 0) + g
        db[j] = (db[j] ?? 0) + g
      }
    }
    Tape.accumulate(a, da)
    Tape.accumulate(bias, db)
  })
}
