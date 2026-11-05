/**
 * The catalogue schema.
 *
 * The manifest is the collection's single source of truth: which courses
 * exist, which sources they are built on, and what each source may be used
 * for. This module gives that file a type, a parser that checks it, and the
 * queries the rest of the collection needs.
 *
 * The parser is deliberately strict. A catalogue that can hold anything is a
 * catalogue nobody can rely on, and the failure of a field to validate should
 * break the build rather than the page.
 */

export type SourceKind = 'paper' | 'book' | 'web' | 'dataset' | 'code'

export interface CatalogueSource {
  id: string
  title: string
  authors: string[]
  year: number
  kind: SourceKind
  venue: string
  url: string
  license: string
  app: string
  role: 'primary' | 'supporting'
  gapClosed: string
  labs: string[]
  verification: { method: string; checkedAt: string }
}

export interface CatalogueApp {
  id: string
  title: string
  status: 'built' | 'planned'
  primarySource: string
  modules: string[]
}

export interface CatalogueManifest {
  version: number
  lastVerified: string
  verificationMethods: Record<string, string>
  apps: CatalogueApp[]
  sources: CatalogueSource[]
}

/** The error a malformed manifest raises. */
export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ManifestError(`${where}: expected a non-empty string`)
  }
  return value
}

function requireStringArray(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ManifestError(`${where}: expected an array of strings`)
  }
  return value as string[]
}

/**
 * Parse and check a manifest.
 *
 * Every field the rest of the collection relies on is checked, so a manifest
 * that parses is a manifest the site can render.
 */
export function parseManifest(raw: unknown): CatalogueManifest {
  if (typeof raw !== 'object' || raw === null) throw new ManifestError('the manifest is not an object')
  const record = raw as Record<string, unknown>

  const version = requireString(String(record.version ?? ''), 'version')
  const lastVerified = requireString(String(record.lastVerified ?? ''), 'lastVerified')
  const verificationMethods = record.verificationMethods
  if (typeof verificationMethods !== 'object' || verificationMethods === null) {
    throw new ManifestError('verificationMethods: expected an object')
  }

  if (!Array.isArray(record.apps)) throw new ManifestError('apps: expected an array')
  if (!Array.isArray(record.sources)) throw new ManifestError('sources: expected an array')

  const apps: CatalogueApp[] = record.apps.map((entry, index) => {
    const app = entry as Record<string, unknown>
    const status = requireString(String(app.status ?? ''), `apps[${index}].status`)
    if (status !== 'built' && status !== 'planned') {
      throw new ManifestError(`apps[${index}].status: expected "built" or "planned"`)
    }
    return {
      id: requireString(String(app.id ?? ''), `apps[${index}].id`),
      title: requireString(String(app.title ?? ''), `apps[${index}].title`),
      status,
      primarySource: requireString(String(app.primarySource ?? ''), `apps[${index}].primarySource`),
      modules: requireStringArray(app.modules, `apps[${index}].modules`),
    }
  })

  const sources: CatalogueSource[] = record.sources.map((entry, index) => {
    const source = entry as Record<string, unknown>
    const verification = source.verification as Record<string, unknown> | undefined
    if (typeof verification !== 'object' || verification === null) {
      throw new ManifestError(`sources[${index}].verification: expected an object`)
    }
    return {
      id: requireString(String(source.id ?? ''), `sources[${index}].id`),
      title: requireString(String(source.title ?? ''), `sources[${index}].title`),
      authors: requireStringArray(source.authors, `sources[${index}].authors`),
      year: Number(source.year),
      kind: requireString(String(source.kind ?? ''), `sources[${index}].kind`) as SourceKind,
      venue: requireString(String(source.venue ?? ''), `sources[${index}].venue`),
      url: requireString(String(source.url ?? ''), `sources[${index}].url`),
      license: requireString(String(source.license ?? ''), `sources[${index}].license`),
      app: requireString(String(source.app ?? ''), `sources[${index}].app`),
      role: requireString(String(source.role ?? ''), `sources[${index}].role`) as 'primary' | 'supporting',
      gapClosed: requireString(String(source.gapClosed ?? ''), `sources[${index}].gapClosed`),
      labs: requireStringArray(source.labs, `sources[${index}].labs`),
      verification: {
        method: requireString(String(verification.method ?? ''), `sources[${index}].verification.method`),
        checkedAt: requireString(String(verification.checkedAt ?? ''), `sources[${index}].verification.checkedAt`),
      },
    }
  })

  // The referential checks: every app's primary source must exist, and every
  // source must belong to an app.
  const sourceIds = new Set(sources.map((source) => source.id))
  const appIds = new Set(apps.map((app) => app.id))
  for (const app of apps) {
    if (!sourceIds.has(app.primarySource)) {
      throw new ManifestError(`apps: ${app.id} names the unknown primary source ${app.primarySource}`)
    }
  }
  for (const source of sources) {
    if (!appIds.has(source.app)) {
      throw new ManifestError(`sources: ${source.id} belongs to the unknown app ${source.app}`)
    }
  }

  return {
    version: Number(version),
    lastVerified,
    verificationMethods: verificationMethods as Record<string, string>,
    apps,
    sources,
  }
}

/** The courses of a manifest, built first and planned first after. */
export function orderedApps(manifest: CatalogueManifest): CatalogueApp[] {
  return [...manifest.apps].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'built' ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

/** The sources of one course. */
export function sourcesOfApp(manifest: CatalogueManifest, appId: string): CatalogueSource[] {
  return manifest.sources.filter((source) => source.app === appId)
}

/** The courses a source belongs to, in the order they were built. */
export function appsOfSource(manifest: CatalogueManifest, sourceId: string): CatalogueApp[] {
  return orderedApps(manifest).filter((app) => app.id === manifest.sources.find((s) => s.id === sourceId)?.app)
}

/** The courses that have been built, with their source counts. */
export function builtApps(manifest: CatalogueManifest): (CatalogueApp & { sources: number })[] {
  return orderedApps(manifest)
    .filter((app) => app.status === 'built')
    .map((app) => ({ ...app, sources: sourcesOfApp(manifest, app.id).length }))
}
