import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App'

// The theme is applied before the first paint by the bootstrap script in
// index.html, so there is nothing to decide here.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
  The course, offline.

  The service worker is registered only in a published build. In development
  it would cache the source files that are about to change, which is a
  well-known way to spend an afternoon confused.

  The registration is deliberately not awaited: the course has to work
  whether or not the browser supports service workers, and a failure to
  register is not worth an error in the console.

  The `load` event has usually already fired by the time a module script
  runs, so the ready state is checked rather than the event waited for.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // The course works without it; it simply will not be available offline.
    })
  }
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
