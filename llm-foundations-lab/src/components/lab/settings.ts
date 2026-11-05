/**
 * Reading a saved laboratory configuration.
 *
 * A saved configuration is a flat record of primitives, because it has to
 * survive a round trip through JSON in the progress file. These helpers turn
 * that record back into typed state, falling back to the laboratory's default
 * when a key is missing or has the wrong type — so an old or hand-edited
 * configuration can never leave a laboratory in an impossible state.
 */
export type LabSettings = Record<string, number | string | boolean>

export function readNumber(settings: LabSettings | undefined, key: string, fallback: number): number {
  const value = settings?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readString(settings: LabSettings | undefined, key: string, fallback: string): string {
  const value = settings?.[key]
  return typeof value === 'string' ? value : fallback
}

export function readBoolean(settings: LabSettings | undefined, key: string, fallback: boolean): boolean {
  const value = settings?.[key]
  return typeof value === 'boolean' ? value : fallback
}

/** Read a list that was stored as a comma-separated string. */
export function readNumberList(
  settings: LabSettings | undefined,
  key: string,
  fallback: number[],
): number[] {
  const value = settings?.[key]
  if (typeof value !== 'string') return fallback
  const parts = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part))
  return parts.length > 0 ? parts : fallback
}

/** Read a value that must be one of a fixed set of options. */
export function readOneOf<T extends string>(
  settings: LabSettings | undefined,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = settings?.[key]
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}
