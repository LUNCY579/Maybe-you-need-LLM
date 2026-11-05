/**
 * The catalogue, parsed.
 *
 * The manifest is the collection's single source of truth, and it is bundled
 * with this package so that every course application and the hub read the
 * same copy. The copy is written by `scripts/sync-catalogue.mjs`, and the
 * script refuses to leave a stale one behind.
 */

import manifestData from './manifest.data.json'
import { parseManifest, type CatalogueManifest } from './manifest'

/** The whole collection, as the manifest describes it. */
export const CATALOGUE: CatalogueManifest = parseManifest(manifestData)

export default CATALOGUE
