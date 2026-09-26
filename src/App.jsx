import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ScrollTrigger, lockScroll, scrollToId, smoothScroll } from './lib/motion'
import Loader from './components/Loader'
import Cursor from './components/Cursor'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Tapes from './components/Tapes'
import About from './components/About'
import Services from './components/Services'
import Work from './components/Work'
import Process from './components/Process'
import { Contact, Footer, WhatsAppFab } from './components/Contact'

export default function App() {
  const [fontsReady, setFontsReady] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    Promise.all([document.fonts.load('800 1em Unbounded'), document.fonts.load('400 1em Manrope')]).finally(() => setFontsReady(true))
    // never trap a visitor behind the loader if WebGL stalls
    const t = setTimeout(() => setSceneReady(true), 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(smoothScroll, [])

  useEffect(() => {
    lockScroll(loading)
    if (loading) return
    ScrollTrigger.refresh()
    // arriving from a service page's menu (/#work etc.): jump straight to that section once the loader is gone
    if (location.hash) scrollToId(decodeURIComponent(location.hash.slice(1)), true)
  }, [loading])

  const onSceneReady = useCallback(() => setSceneReady(true), [])
  const progress = 0.15 + (fontsReady ? 0.35 : 0) + (sceneReady ? 0.5 : 0)

  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" progress={progress} onDone={() => setLoading(false)} />}</AnimatePresence>
      <Cursor />
      <Nav />
      <main>
        <Hero ready={!loading} onSceneReady={onSceneReady} />
        <Tapes />
        <About />
        <Services />
        <Work />
        <Process />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
