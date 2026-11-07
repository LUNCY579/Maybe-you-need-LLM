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

const STORAGE_KEY = 'lm-from-scratch:progress'
const THEME_KEY = 'lm-from-scratch:theme'

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

/** The search corpus. The course knows what it contains; the ranking is shared. */
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
          textbookHref="../textbooks/lm-from-scratch.html"
          title="Language Model from Scratch"
          subtitle="from the tokeniser to the bill"
          nav={NAV}
          searchDocuments={() => [...searchDocuments(), ...collectionDocuments(CATALOGUE, 'lm-from-scratch')]}
          searchKindWeights={{ Module: 1.2, Lesson: 1.3, Glossary: 1.1, Equation: 1, Practice: 0.9 }}
          storageKey={THEME_KEY}
          footer={
            <>
              Language Model from Scratch is an original teaching application built on{' '}
              <a href="https://cs336.stanford.edu/">CS336: Language Modeling from Scratch</a> at Stanford. No figure,
              dataset, checkpoint or third-party code from the source is reproduced: every number on this site is
              computed in your browser.
            </>
          }
          footerMeta={
            <>
              The tokeniser and the transformer are trained in your browser, from scratch, every time you press the
              button. See <a href="#/sources">Sources and licensing</a>.
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
