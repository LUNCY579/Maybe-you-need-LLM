/**
 * Tests for the standalone-course gate runner.
 *
 * The runner exists because `npm run verify` fans out with `--workspaces`, which
 * means it silently skips any course that is not in the root `workspaces` array.
 * Three courses are outside it, they carry their own lockfiles, and between them
 * they hold 44 of the 200 laboratory units the collection declares. So the
 * invariant asserted here is the one that keeps the aggregate green honest: the
 * runner's course list is derived from the real directory, not from a list
 * someone remembered to update, and the aggregate script really calls it.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STAGES, coursesOutsideWorkspaces, isWorkspaceMember } from './verify-standalone.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function manifestsAtRoot() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(ROOT, name, 'package.json')))
}

describe('the workspace fan-out', () => {
  it('accepts a member listed outright and one matched by a glob', () => {
    expect(isWorkspaceMember('data-lab')).toBe(true)
    expect(isWorkspaceMember('course-core')).toBe(false)
    expect(isWorkspaceMember('@llm-materials/course-core')).toBe(false)
  })

  it('resolves the packages glob against the directory, not the package name', () => {
    expect(isWorkspaceMember('packages')).toBe(false)
    const shared = JSON.parse(readFileSync(join(ROOT, 'packages/course-catalogue/package.json'), 'utf8'))
    expect(shared.name).toBe('@llm-materials/course-catalogue')
  })
})

describe('courses outside the workspace fan-out', () => {
  const found = coursesOutsideWorkspaces()

  it('names the three courses the aggregate verify used to miss', () => {
    expect(found.map((course) => course.directory).sort()).toEqual([
      'agentic-ai-academy',
      'deep-learning-theory-explorer',
      'llm-foundations-lab',
    ])
  })

  it('is derived from the directory, so nothing with a manifest is left out', () => {
    const withManifest = manifestsAtRoot()
      .filter((name) => name !== 'packages' && name !== 'scripts' && name !== 'references')
      .filter((name) => !isWorkspaceMember(name))
    expect(withManifest.sort()).toEqual(found.map((course) => course.directory).sort())
  })

  it('gives every course it finds at least one gate, and a unit test to run', () => {
    for (const course of found) {
      expect(course.stages.length, course.directory).toBeGreaterThan(0)
      expect(course.hasTests, `${course.directory} has no test script`).toBe(true)
      expect(course.stages.every((stage) => STAGES.includes(stage)), course.directory).toBe(true)
    }
  })

  it('reports the laboratory units hidden behind the skipped gates', () => {
    const audit = JSON.parse(readFileSync(join(ROOT, 'references/manifest.json'), 'utf8'))
    const declaredPerApp = new Map()
    for (const source of audit.sources) {
      declaredPerApp.set(source.app, (declaredPerApp.get(source.app) ?? 0) + (source.labs?.length ?? 0))
    }
    // The whole collection is 200 ideas, so the three skipped courses are a fifth of it.
    expect([...declaredPerApp.values()].reduce((total, n) => total + n, 0)).toBe(200)
    const skipped = found.reduce((total, course) => total + (declaredPerApp.get(course.directory) ?? 0), 0)
    expect(skipped).toBe(44)
    expect(declaredPerApp.get('agentic-ai-academy')).toBe(21)
    expect(declaredPerApp.get('llm-foundations-lab')).toBe(16)
    expect(declaredPerApp.get('deep-learning-theory-explorer')).toBe(7)
  })
})

describe('the aggregate gate', () => {
  it('runs the standalone courses, so a red suite outside the workspaces cannot pass verify', () => {
    const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(root.scripts['verify:standalone']).toBe('node scripts/verify-standalone.mjs')
    expect(root.scripts.verify).toContain('npm run verify:standalone')
  })
})
