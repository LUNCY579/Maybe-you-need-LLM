/**
 * Let Node run the collection's TypeScript cores.
 *
 * The course modules import each other without extensions (`./surface`), which
 * Vite and `tsc --moduleResolution bundler` accept and Node's ESM loader does not.
 * Node 24 strips types from `.ts` entry points, so the only missing piece is
 * resolution — and `module.registerHooks` is the one that does not need a build
 * step or a second copy of the code.
 *
 * Used by `tools/run-lab.mjs`: `node --import ./tools/ts-resolver.mjs …`.
 */

import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.(ts|tsx|js|mjs|cjs|json)$/.test(specifier)) {
      try {
        return nextResolve(specifier + '.ts', context)
      } catch {
        /* fall through to the normal resolution */
      }
    }
    return nextResolve(specifier, context)
  },
})
