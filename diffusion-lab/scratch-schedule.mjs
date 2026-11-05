import { buildSchedule } from './src/core/schedules.js'
for (const T of [100, 1000]) {
  const lin = buildSchedule('linear', T)
  const cos = buildSchedule('cosine', T)
  const idx = [10, Math.floor(T/2), T-1]
  console.log('T =', T)
  for (const t of idx) {
    console.log('  t=' + t, 'linear abar=' + lin.alphaBars[t].toExponential(4), 'cosine abar=' + cos.alphaBars[t].toExponential(4))
  }
  console.log('  linear snr mid =', lin.snrs[Math.floor(T/2)].toExponential(3), ' cosine snr mid =', cos.snrs[Math.floor(T/2)].toExponential(3))
}
