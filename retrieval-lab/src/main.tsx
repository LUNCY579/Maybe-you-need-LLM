import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import 'katex/dist/katex.min.css'
import '@llm-materials/course-ui/styles.css'
import '@llm-materials/course-catalogue/styles.css'
import '@llm-materials/course-catalogue/styles.css'
import App from './App'

// The theme is applied before the first paint by the bootstrap script in
// index.html, so there is nothing to decide here.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
