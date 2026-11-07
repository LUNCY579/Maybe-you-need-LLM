import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, ErrorBoundary, ProgressProvider } from '@llm-materials/course-ui'
import { moduleLessonIds } from '@llm-materials/course-core'
import { CATALOGUE, collectionDocuments } from '@llm-materials/course-catalogue'
import { LESSONS, MODULES } from './content/curriculum'
import { GLOSSARY } from './content/glossary'
import { QUIZ } from './content/quiz'
import { FORMULAS } from './content/formulas'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { ModulePage } from './pages/ModulePage'
import { LessonPage } from './pages/LessonPage'
import { LessonsPage } from './pages/LessonsPage'
import { LabsPage } from './pages/LabsPage'
import { PracticePage } from './pages/PracticePage'
import { GlossaryPage } from './pages/GlossaryPage'
import { EquationsPage } from './pages/EquationsPage'
import { SourcesPage } from './pages/SourcesPage'
import { NotFoundPage } from './pages/NotFoundPage'

const STORAGE_KEY = 'data-lab:progress'
const THEME_KEY = 'data-lab:theme'

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/lessons', label: 'Lessons' },
  { to: '/labs', label: 'Laboratories' },
  { to: '/practice', label: 'Practice' },
  { to: '/glossary', label: 'Glossary' },
  { to: '/equations', label: 'Equations' },
  { to: '/sources', label: 'Sources' },
  { to: '/dashboard', label: 'Dashboard' },
]

function searchDocuments() {
  return [
    ...MODULES.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.tagline,
      body: `${module.summary} ${module.outcomes.join(' ')}`,
      kind: 'Module',
      href: `#/modules/${module.id}`,
    })),
    ...LESSONS.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      summary: lesson.subtitle,
      body: `${lesson.objectives.join(' ')} ${lesson.keyIdeas.join(' ')}`,
      kind: 'Lesson',
      href: `#/lessons/${lesson.id}`,
    })),
    ...GLOSSARY.map((term) => ({
      id: term.id,
      title: term.term,
      summary: term.short,
      body: term.long,
      kind: 'Glossary',
      href: `#/glossary?term=${term.id}`,
    })),
    ...FORMULAS.map((formula) => ({
      id: formula.id,
      title: formula.title,
      summary: formula.meaning,
      body: `${formula.derivation.join(' ')} ${formula.assumptions.join(' ')}`,
      kind: 'Equation',
      href: `#/equations?entry=${formula.id}`,
    })),
    ...QUIZ.map((question) => ({
      id: question.id,
      title: question.topic,
      summary: question.prompt,
      body: question.explanation,
      kind: 'Practice',
      href: '#/practice',
    })),
  ]
}

export default function App() {
  return (
    <ProgressProvider storageKey={STORAGE_KEY} moduleLessonIds={moduleLessonIds(MODULES, LESSONS)}>
      <HashRouter>
        <AppShell
          textbookHref="../textbooks/data-lab.html"
          title="Data Lab"
          subtitle="the data, and what it does"
          nav={NAV}
          searchDocuments={() => [...searchDocuments(), ...collectionDocuments(CATALOGUE, 'data-lab')]}
          searchKindWeights={{ Module: 1.2, Lesson: 1.3, Glossary: 1.1, Equation: 1, Practice: 0.9 }}
          storageKey={THEME_KEY}
          footer={
            <>
              Data Lab is an original teaching application built on DataComp, RefinedWeb, DoReMi and the recursion
              result of Gerstgrasser et al. No dataset, corpus, figure or trained model from the sources is
              redistributed: every number on this site is computed in your browser, from a corpus this site generates.
            </>
          }
          footerMeta={
            <>
              The corpus is synthetic: a Markov chain over a small vocabulary, with boilerplate, foreign text and
              near-duplicates mixed in at known rates. See <a href="#/sources">Sources and licensing</a>.
            </>
          }
        >
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/lessons" element={<LessonsPage />} />
              <Route path="/modules/:moduleId" element={<ModulePage />} />
              <Route path="/lessons/:lessonId" element={<LessonPage />} />
              <Route path="/labs" element={<LabsPage />} />
              <Route path="/labs/:labId" element={<LabsPage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/glossary" element={<GlossaryPage />} />
              <Route path="/equations" element={<EquationsPage />} />
              <Route path="/sources" element={<SourcesPage />} />
              <Route path="/index.html" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </AppShell>
      </HashRouter>
    </ProgressProvider>
  )
}
