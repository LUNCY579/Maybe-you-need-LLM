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

const STORAGE_KEY = 'safety-lab:progress'
const THEME_KEY = 'safety-lab:theme'

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
          textbookHref="../hub/textbooks/safety-lab.html"
          title="Safety and Alignment Lab"
          subtitle="what a claim is worth"
          nav={NAV}
          searchDocuments={() => [...searchDocuments(), ...collectionDocuments(CATALOGUE, 'safety-lab')]}
          searchKindWeights={{ Module: 1.2, Lesson: 1.3, Glossary: 1.1, Equation: 1, Practice: 0.9 }}
          storageKey={THEME_KEY}
          footer={
            <>
              Safety and Alignment Lab is an original teaching application built on Constitutional AI, the helpful and
              harmless dataset, the model-driven red team, the cued backdoor, the sycophancy measurements and the
              extraction attack. No model, dataset or example from the sources is used or redistributed: every number
              on this site is computed in your browser.
            </>
          }
          footerMeta={
            <>
              The exchanges, the attacks and the training records are synthetic, and the "model" here is a rule over them.
              What the course teaches is the measurement — the agreement, the coverage, the gap between the harm a
              classifier was told about and the harm that is there, the flip rate and the exposure. See{' '}
              <a href="#/sources">Sources and licensing</a>.
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
