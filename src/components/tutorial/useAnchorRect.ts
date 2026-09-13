'use client'

import { useEffect, useState } from 'react'

export type Rect = { top: number; left: number; width: number; height: number }

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

    const union = (): Rect => {
      const rs = els.map((el) => el.getBoundingClientRect())
      const top = Math.min(...rs.map((r) => r.top))
      const left = Math.min(...rs.map((r) => r.left))
      const bottom = Math.max(...rs.map((r) => r.bottom))
      const right = Math.max(...rs.map((r) => r.right))
      return { top, left, width: right - left, height: bottom - top }
    }

    const medir = () => setRect(union())

    // Centrar la UNIÓN, no el primer elemento: con `scrollIntoView` sobre uno
    // solo, el otro puede quedarse fuera de pantalla, que es justo lo que se
    // quería evitar al agrupar.
    const u = union()
    const centro = u.top + window.scrollY + u.height / 2
    window.scrollTo({ top: Math.max(centro - window.innerHeight / 2, 0), behavior: 'smooth' })

    // Medir en el siguiente fotograma, no en este: el scroll acaba de empezar
    // y medir ahora daría la posición vieja. Además, así no se encadena un
    // render dentro del propio commit.
    const id = requestAnimationFrame(medir)

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
