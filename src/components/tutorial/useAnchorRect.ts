'use client'

import { useEffect, useState } from 'react'

export type Rect = { top: number; left: number; width: number; height: number }

/** Cuánto se sigue midiendo el ancla tras activarla, para no perderse su
    animación de entrada. Da de sobra para un scroll suave (~0,5 s) más el
    revelado de una tarjeta (0,75 s). */
const MS_ASENTAR = 1200

/**
 * Sigue a los elementos marcados con `data-tutorial="<ancla>"` y devuelve el
 * rectángulo que los engloba a TODOS, en coordenadas de viewport, o null si no
 * hay ninguno en la página.
 *
 * Que sean varios importa: el sobre del día y su botón "Abrir Sobre" son
 * hermanos en el DOM, no padre e hijo, y para iluminar los dos la alternativa
 * era envolverlos en un div nuevo dentro de un flex que ya funciona. Marcar
 * los dos con la misma ancla no toca el layout.
 *
 * Devolver null es un caso normal, no un error: estas páginas son enormes y se
 * refactorizan, y el tutorial tiene que degradar a cuadro centrado en vez de
 * romperse porque alguien movió un div.
 */
export function useAnchorRect(ancla: string | undefined, activo: boolean): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    const els =
      activo && ancla
        ? Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial="${ancla}"]`))
        : []

    if (els.length === 0) {
      const id = requestAnimationFrame(() => setRect(null))
      return () => cancelAnimationFrame(id)
    }

    /* Los ocultos NO entran en la unión.

       Hace falta en cuanto una misma ancla marca las dos versiones de algo
       responsive: la nav de escritorio es `hidden md:flex` y la de móvil
       `md:hidden`, así que una de las dos está siempre en `display:none`. Un
       elemento oculto devuelve un rect de ceros, y como la unión coge el
       mínimo de `top`/`left`, ese cero arrastraba el foco hasta la esquina
       superior izquierda de la pantalla. */
    const union = (): Rect | null => {
      const rs = els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
      if (rs.length === 0) return null

      const top = Math.min(...rs.map((r) => r.top))
      const left = Math.min(...rs.map((r) => r.left))
      const bottom = Math.max(...rs.map((r) => r.bottom))
      const right = Math.max(...rs.map((r) => r.right))
      return { top, left, width: right - left, height: bottom - top }
    }

    /* Solo se avisa a React cuando el rectángulo cambia de verdad.

       Este `medir` lo llaman el oyente de scroll y el bucle de asentamiento
       de abajo, o sea muchas veces por segundo. Devolviendo el objeto
       anterior cuando nada se ha movido, React descarta el render y el
       overlay no se repinta en balde. */
    const medir = () =>
      setRect((previo) => {
        const u = union()
        if (!u) return previo === null ? previo : null
        if (
          previo &&
          previo.top === u.top &&
          previo.left === u.left &&
          previo.width === u.width &&
          previo.height === u.height
        ) {
          return previo
        }
        return u
      })

    // Centrar la UNIÓN, no el primer elemento: con `scrollIntoView` sobre uno
    // solo, el otro puede quedarse fuera de pantalla, que es justo lo que se
    // quería evitar al agrupar.
    const u = union()
    if (u) {
      const centro = u.top + window.scrollY + u.height / 2
      window.scrollTo({ top: Math.max(centro - window.innerHeight / 2, 0), behavior: 'smooth' })
    }

    /* Medir durante un rato, no una sola vez.

       Empieza en el fotograma siguiente y no en este: el scroll acaba de
       arrancar y medir ahora daría la posición vieja; además, así no se
       encadena un render dentro del propio commit.

       Y sigue midiendo ~1,2 s porque las tarjetas tienen animación de entrada
       propia (las del Studio entran con `y: 34` y `scale: 0.98`) y
       `getBoundingClientRect` incluye el transform. El scroll suave dispara
       re-medidas mientras dura, pero termina ANTES que esa animación: con una
       sola medida, el foco se quedaba clavado donde estaba la tarjeta a medio
       entrar. La ventana está acotada y, gracias a la guarda de `medir`, los
       fotogramas en los que nada se mueve no cuestan ni un render. */
    let id = 0
    const desde = performance.now()
    const asentar = (ahora: number) => {
      medir()
      if (ahora - desde < MS_ASENTAR) id = requestAnimationFrame(asentar)
    }
    id = requestAnimationFrame(asentar)

    const ro = new ResizeObserver(medir)
    els.forEach((el) => ro.observe(el))
    // El scroll suave sigue moviendo los elementos después de la primera
    // medición; estos dos oyentes son los que mantienen el foco pegado.
    window.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)

    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
      window.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [ancla, activo])

  return rect
}
