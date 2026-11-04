'use client'

import { useEffect, useRef } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

/* «Cose la nefrona» (Nefrología): transportadores, iones y fármacos sobre la nefrona,
   en forma estirada o anatómica.

   El juego es un HTML autocontenido (public/minijuegos/cose-la-nefrona.html, nacido
   como prototipo en LAB/nefrona) y aquí se sirve dentro de un iframe: así su CSS y su
   JS no se mezclan con los de la web. Guarda la partida en localStorage (mismo origen)
   y tiene su propia pantalla completa (por eso el iframe permite fullscreen).

   El iframe ocupa lo que queda de pantalla bajo la cabecera del sitio, que es sticky:
   se mide dónde empieza el <main> y se ajusta el alto, sin estado de React. */
export default function NefronaPage() {
  const { setBackAction } = useHeaderUI()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setBackAction({ label: 'Minijuegos', href: '/studio/minijuegos', current: 'Cose la nefrona' })
    return () => setBackAction(null)
  }, [setBackAction])

  useEffect(() => {
    const fit = () => {
      const main = mainRef.current
      if (!main) return
      const top = main.getBoundingClientRect().top + window.scrollY
      const h = Math.max(420, window.innerHeight - top)
      main.style.height = `${h}px`
      // lo que el layout pone debajo (márgenes, pie) también resta: que la página no se desplace
      const extra = document.documentElement.scrollHeight - window.innerHeight
      if (extra > 0) main.style.height = `${Math.max(420, h - extra)}px`
    }
    fit()
    const raf = requestAnimationFrame(fit)
    // Las migas de la cabecera llegan después y bajan el <main>. Se reajusta con cualquier
    // cambio del DOM de la página (el iframe tiene su propio documento: no cuenta) y al
    // cambiar el tamaño de la ventana.
    const mo = new MutationObserver(fit)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [])

  return (
    <main ref={mainRef} className="w-full bg-[#FAF7F4]" style={{ height: '100dvh' }}>
      <iframe
        src="/minijuegos/cose-la-nefrona.html"
        title="Cose la nefrona"
        className="block h-full w-full border-0"
        allow="fullscreen"
        allowFullScreen
      />
    </main>
  )
}
