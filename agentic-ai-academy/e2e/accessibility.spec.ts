import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Automated accessibility audit.
 *
 * axe-core checks the rules that can be checked automatically: contrast,
 * names on controls, landmark structure, form labelling, heading order and
 * ARIA validity. It cannot check whether the alternative text is *meaningful*,
 * whether the reading order makes sense, or whether focus is always visible —
 * those are covered by the manual and browser checks elsewhere.
 *
 * The audit runs against the production build so that what is audited is what
 * a student would be served.
 *
 * The rules axe checks are engine-independent, so the audit runs on Chromium
 * only. Running it on all three engines would triple the runtime without
 * finding anything new.
 */
test.describe('accessibility audit (axe-core)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Accessibility audit runs on Chromium only')

  const PAGES = [
    { name: 'landing', hash: '#/' },
    { name: 'curriculum', hash: '#/curriculum' },
    { name: 'source map', hash: '#/curriculum', tab: 'Source map' },
    { name: 'study plan', hash: '#/curriculum', tab: 'Study plan' },
    { name: 'lesson', hash: '#/lesson/what-agentic-llms-are' },
    { name: 'assessment', hash: '#/lesson/what-agentic-llms-are', tab: 'Assessment' },
    { name: 'workflow builder', hash: '#/builder' },
    { name: 'builder trace', hash: '#/builder', tab: 'Trace' },
    { name: 'lab: planning', hash: '#/labs/planning' },
    { name: 'lab: memory', hash: '#/labs/memory' },
    { name: 'lab: world model', hash: '#/labs/world-model' },
    { name: 'lab: multi-agent', hash: '#/labs/multi-agent' },
    { name: 'lab: policy priors', hash: '#/labs/policy-priors' },
    { name: 'lab: policy priors loop', hash: '#/labs/policy-priors', tab: "Training on the policy's own data" },
    { name: 'lab: memory longevity', hash: '#/labs/memory-longevity' },
    { name: 'lab: memory longevity writing', hash: '#/labs/memory-longevity', tab: 'A policy that decides what to write' },
    { name: 'lab: reasoning depth', hash: '#/labs/reasoning' },
    { name: 'lab: agentic retrieval', hash: '#/labs/retrieval' },
    { name: 'lab: agentic retrieval hops', hash: '#/labs/retrieval', tab: '2 · One query per sub-question' },
    { name: 'lab: agentic retrieval shapes', hash: '#/labs/retrieval', tab: '3 · Four shapes, one case set' },
    { name: 'labs index', hash: '#/labs' },
    { name: 'quiz centre', hash: '#/assessments' },
    { name: 'project', hash: '#/project' },
    { name: 'glossary', hash: '#/glossary' },
    { name: 'references', hash: '#/references' },
    { name: 'dashboard', hash: '#/dashboard' },
    // The demonstrations are the most interactive content in the course: they
    // carry sliders, radio groups, selects and live regions, so they are the
    // pages most worth auditing.
    { name: 'demo: attention', hash: '#/lesson/foundations-of-language-modeling' },
    { name: 'demo: curation', hash: '#/lesson/training-pipeline' },
    { name: 'demo: context window', hash: '#/lesson/interaction-styles-and-memory' },
    { name: 'demo: tools and escalation', hash: '#/lesson/tools-and-context' },
    { name: 'demo: retrieval', hash: '#/lesson/search-and-retrieval' },
    { name: 'demo: behaviour and valence', hash: '#/lesson/behavior-strategy-multi-agent' },
    { name: 'demo: patching', hash: '#/lesson/advanced-architectures-and-interpretability' },
  ]

  for (const entry of PAGES) {
    test(`${entry.name} has no automatically detectable accessibility violations`, async ({ page }) => {
      await page.goto(`/${entry.hash}`)
      await page.waitForTimeout(500)
      if (entry.tab) {
        const tab = page.getByRole('tab', { name: entry.tab })
        if (await tab.count()) {
          await tab.first().click()
          await page.waitForTimeout(400)
        }
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      }))

      expect(
        violations,
        `Accessibility violations on "${entry.name}":\n${JSON.stringify(violations, null, 2)}`,
      ).toEqual([])
    })
  }
})
