import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ScrollTrigger, lockScroll, scrollToId, smoothScroll } from './lib/motion'
import Loader, { useLoader } from './components/Loader'
import Cursor from './components/Cursor'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Tapes from './components/Tapes'
import About from './components/About'
import Services from './components/Services'
import { Contact, Footer, WhatsAppFab } from './components/Contact'

export default function App() {
  const { loading, progress, onSceneReady, done } = useLoader()

  useEffect(() => {
    history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  useEffect(smoothScroll, [])

  useEffect(() => {
    lockScroll(loading)
    if (loading) return
    ScrollTrigger.refresh()
    // arriving from a service page's menu (/#services etc.): jump straight to that section once the loader is gone
    if (location.hash) scrollToId(decodeURIComponent(location.hash.slice(1)), true)
  }, [loading])

  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" progress={progress} onDone={done} />}</AnimatePresence>
      <Cursor />
      <Nav />
      <main>
        <Hero ready={!loading} onSceneReady={onSceneReady} />
        <Tapes />
        <About />
        <Services />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
