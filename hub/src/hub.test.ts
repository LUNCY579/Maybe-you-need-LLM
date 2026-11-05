import { describe, expect, it } from 'vitest'
import { CATALOGUE, buildCatalogueIndex, findPathCycle, parseManifest } from '@llm-materials/course-catalogue'
import manifestData from './manifest.json'

describe('the hub', () => {
  it('parses the catalogue it ships with', () => {
    const manifest = parseManifest(manifestData)
    expect(manifest.apps.length).toBeGreaterThan(0)
    expect(manifest.sources.length).toBeGreaterThan(0)
  })

  it('has a built course for every course it links to', () => {
    const built = CATALOGUE.apps.filter((app) => app.status === 'built').map((app) => app.id)
    expect(built.length).toBeGreaterThan(0)
    for (const app of CATALOGUE.apps) {
      if (app.status !== 'built') continue
      expect(built).toContain(app.id)
    }
  })

  it('indexes every course and every source', () => {
    const documents = buildCatalogueIndex(CATALOGUE)
    const courses = documents.filter((document) => document.kind === 'Course')
    const sources = documents.filter((document) => document.kind === 'Source')
    expect(courses.length).toBe(CATALOGUE.apps.length)
    expect(sources.length).toBe(CATALOGUE.sources.length)
  })

  it('has a path with no cycle in it', () => {
    expect(findPathCycle(CATALOGUE_PATH_FOR_TEST)).toEqual([])
  })
})

import { LEARNING_PATH as CATALOGUE_PATH_FOR_TEST } from '@llm-materials/course-catalogue'
