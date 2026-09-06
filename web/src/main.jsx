import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import './index.css'
import './patterns.css'
import App from './App.jsx'

// Capacitor's WKWebView renders edge to edge, under the status bar and over the
// home indicator. iOS only reports real values for env(safe-area-inset-*) when the
// viewport opts in with viewport-fit=cover — without it every inset is 0, so the
// header's `calc(12px + env(safe-area-inset-top))` collapsed to 12px and sat under
// the clock and battery. Opt in on native only: on the web the webview is already
// inset by the browser, and changing the viewport there would shift the layout of
// the live site for no gain.
if (Capacitor.isNativePlatform()) {
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport && !viewport.content.includes('viewport-fit')) {
    viewport.content = `${viewport.content}, viewport-fit=cover`
  }
  document.documentElement.classList.add('native-app')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
