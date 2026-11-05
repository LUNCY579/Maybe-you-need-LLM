import { Mlp } from './src/core/mlp.ts'

const network = new Mlp({ inputSize: 3, hiddenSizes: [5, 4], outputSize: 2, seed: 1 })
const input = [0.3, -0.7, 1.1]
const target = [0.2, -0.4]

const { output, cache } = network.forward(input)
console.log('preActivations', JSON.stringify(cache.preActivations))
console.log('activations  ', JSON.stringify(cache.activations))

const dOutput = output.map((value, i) => 2 * (value - target[i]))
const gradients = network.backward(cache, dOutput)
console.log('layer0 bias grad', JSON.stringify(gradients[0].bias))
console.log('layer0 weight grad row0', JSON.stringify(gradients[0].weights.slice(0, 3)))
console.log('layer0 weight grad row3', JSON.stringify(gradients[0].weights.slice(9, 12)))

// Check the tanh derivative by hand for row 3.
const a3 = cache.activations[0][3]
console.log('a0[3] =', a3, '1-a^2 =', 1 - a3 * a3)
const pre3 = cache.preActivations[0][3]
console.log('pre0[3] =', pre3, 'tanh(pre) =', Math.tanh(pre3), '1 - tanh^2 =', 1 - Math.tanh(pre3) ** 2)
