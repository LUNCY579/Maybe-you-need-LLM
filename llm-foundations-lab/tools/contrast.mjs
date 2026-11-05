/**
 * Contrast checker for the design tokens.
 *
 * Computes the WCAG 2.1 contrast ratio for every foreground/background pair
 * the interface actually produces, including the translucent accent tints
 * (text-teal on bg-teal/10 and friends).
 *
 *   node tools/contrast.mjs
 *
 * Thresholds follow the guideline:
 *   4.5:1  text (WCAG 1.4.3)
 *   3.0:1  non-text: control boundaries, progress fills, focus indicators
 *           (WCAG 1.4.11)
 *
 * The script exits non-zero when a pair fails, so it can be used as a check.
 */

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function relativeLuminance([r, g, b]) {
  const channel = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(fg, bg) {
  const a = relativeLuminance(hexToRgb(fg))
  const b = relativeLuminance(hexToRgb(bg))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Blend `overlay` at `alpha` over `base`, as Tailwind's colour-mix does. */
function mix(base, overlay, alpha) {
  const b = hexToRgb(base)
  const o = hexToRgb(overlay)
  return (
    '#' +
    b.map((v, i) => Math.round(v * (1 - alpha) + o[i] * alpha).toString(16).padStart(2, '0')).join('')
  )
}

const THEMES = {
  dark: {
    surface: '#070b14',
    panel: '#111a2b',
    panel2: '#16223a',
    line: '#253252',
    lineSoft: '#1b2540',
    control: '#6b7ba2',
    fg: '#eef2ff',
    muted: '#9aa8c7',
    faint: '#828fb6',
    indigo: '#818cf8',
    indigoStrong: '#6265ef',
    teal: '#2dd4bf',
    tealStrong: '#0c857a',
    amber: '#fbbf24',
    amberStrong: '#b45309',
    rose: '#fb7185',
    positive: '#34d399',
  },
  light: {
    surface: '#f7f8fc',
    panel: '#ffffff',
    panel2: '#f1f3fa',
    line: '#d8ddec',
    lineSoft: '#e6e9f4',
    control: '#7a8399',
    fg: '#131a2c',
    muted: '#4d5875',
    faint: '#4b5266',
    indigo: '#4338ca',
    indigoStrong: '#3730a3',
    teal: '#086158',
    tealStrong: '#064e47',
    amber: '#8a4409',
    amberStrong: '#78350f',
    rose: '#b81c44',
    positive: '#046c4e',
  },
}

let failures = 0
let checks = 0

function check(label, ratio, threshold) {
  checks++
  const pass = ratio >= threshold
  if (!pass) failures++
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}: ${ratio.toFixed(2)} (needs ${threshold}:1)`)
  return pass
}

for (const [name, t] of Object.entries(THEMES)) {
  console.log(`\n=== ${name} ===`)

  const surfaces = {
    surface: t.surface,
    panel: t.panel,
    'panel-2': t.panel2,
    'line-soft': t.lineSoft,
  }

  // 1. Text on every surface it can appear on.
  for (const [fgName, fg] of [
    ['fg', t.fg],
    ['muted', t.muted],
    ['faint', t.faint],
    ['indigo', t.indigo],
    ['teal', t.teal],
    ['amber', t.amber],
    ['rose', t.rose],
    ['positive', t.positive],
  ]) {
    for (const [bgName, bg] of Object.entries(surfaces)) {
      check(`${fgName} on ${bgName}`, contrast(fg, bg), 4.5)
    }
  }

  // 2. Accent text on its own 10% tint.
  for (const accent of ['indigo', 'teal', 'amber', 'rose', 'positive']) {
    for (const base of ['panel', 'surface', 'panel2']) {
      const tinted = mix(t[base], t[accent], 0.1)
      check(`${accent} on ${accent}/10 over ${base} (${tinted})`, contrast(t[accent], tinted), 4.5)
    }
  }

  // 3. White text on the strong accents, which are used as button fills.
  for (const [fgName, fg] of [
    ['indigo-strong', t.indigoStrong],
    ['teal-strong', t.tealStrong],
    ['amber-strong', t.amberStrong],
  ]) {
    check(`white on ${fgName}`, contrast('#ffffff', fg), 4.5)
  }

  // 4. Progress fills against their track (non-text contrast). Every progress
  //    bar in the application uses `line-soft` as its track; the native range
  //    input's track and thumb are drawn by the browser and are not ours.
  for (const [fillName, fill] of [
    ['indigo-strong', t.indigoStrong],
    ['teal-strong', t.tealStrong],
    ['amber-strong', t.amberStrong],
  ]) {
    check(`${fillName} fill on line-soft track`, contrast(fill, t.lineSoft), 3)
  }

  // 5. Interactive control boundaries against the panel they sit on.
  for (const [bgName, bg] of [
    ['panel', t.panel],
    ['surface', t.surface],
    ['panel-2', t.panel2],
  ]) {
    check(`control border on ${bgName}`, contrast(t.control, bg), 3)
  }
}

console.log(`\n${checks} checks, ${failures} failures`)
process.exit(failures === 0 ? 0 : 1)
