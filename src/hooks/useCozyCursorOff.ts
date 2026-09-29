import { useEffect } from 'react'

/**
 * Apaga el cursor "cozy" (la piedrecita que sigue al ratón) mientras el componente esté
 * montado y lo deja como estaba al desmontarse.
 *
 * Solo toca el atributo `data-cozy-cursor` de <html>, que es lo que leen el CSS y el
 * script del cursor: no escribe la preferencia guardada del usuario (Configuración), así
 * que en el resto de la web el cursor sigue como él lo tenga.
 */
export function useCozyCursorOff() {
  useEffect(() => {
    const html = document.documentElement
    const previous = html.getAttribute('data-cozy-cursor')
    html.setAttribute('data-cozy-cursor', 'off')
    return () => {
      if (previous === null) html.removeAttribute('data-cozy-cursor')
      else html.setAttribute('data-cozy-cursor', previous)
    }
  }, [])
}
