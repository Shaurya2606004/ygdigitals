import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/unbounded/700.css'
import '@fontsource/unbounded/800.css'
import '@fontsource/unbounded/900.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import './styles.css'
import App from './App.jsx'
import { PAGES, pagePath } from './data'

// every URL is a real page (own HTML file in the build); /services/<slug> renders that service, anything else the home page
const path = location.pathname.replace(/(\.html)?\/*$/, '')
const page = PAGES.find((p) => pagePath(p) === path)
const ServicePage = lazy(() => import('./pages/ServicePage'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {page ? (
      <Suspense>
        <ServicePage page={page} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
