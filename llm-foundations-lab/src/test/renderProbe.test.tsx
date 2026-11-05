import { renderToString } from 'react-dom/server'
import { it } from 'vitest'
import { LessonPage } from '../pages/LessonPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProgressProvider } from '../state/ProgressContext'

it('renders lesson', () => {
  const html = renderToString(
    <MemoryRouter initialEntries={['/lessons/generative-transformer']}>
      <ProgressProvider>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonPage />} />
        </Routes>
      </ProgressProvider>
    </MemoryRouter>,
  )
  console.log(html.slice(0, 200))
})
