import { useMemo, useState } from 'react'
import { useArbolCarpetas } from '@/lib/carpetas/api'
import { SIN_CLASIFICAR, sugerirCarpeta, type Carpeta, type Sugerencia, type TextoPonderado } from '@/lib/carpetas/sugerir'

/** Una carpeta ya decidida en un paso anterior (los ajustes) y si era la sugerida o la eligió el usuario. */
export type CarpetaElegida = { valor: Carpeta; origen: 'usuario' | 'sugerencia' }

/**
 * La carpeta de algo que se va a guardar: la sugerida (de sus textos) hasta que el usuario elige otra.
 * `origen` dice si se guarda la propuesta tal cual ('sugerencia') o una elección suya ('usuario').
 * `inicial`: lo decidido en un paso anterior (de los ajustes a la revisión), que manda sobre la sugerencia.
 * `arbol` null = el catálogo no ha llegado (o no se pudo pedir): no se enseña selector y no se archiva.
 */
export function useCarpeta(textos: TextoPonderado[], activo = true, inicial?: CarpetaElegida | null) {
  const arbol = useArbolCarpetas(activo)
  const clave = JSON.stringify(textos)
  const sugerencia: Sugerencia | null = useMemo(
    () => (arbol ? sugerirCarpeta(arbol, JSON.parse(clave) as TextoPonderado[]) : null),
    [arbol, clave],
  )
  const [elegida, setElegida] = useState<Carpeta | null>(inicial?.valor ?? null)
  const [tocada, setTocada] = useState(inicial?.origen === 'usuario')
  const valor = elegida ?? sugerencia?.carpeta ?? SIN_CLASIFICAR
  return {
    arbol,
    sugerencia,
    /** La propuesta que se explica como «sugerida» (la de los ajustes, si vino de ahí sin tocar). */
    sugerida: inicial?.origen === 'sugerencia' ? inicial.valor : (sugerencia?.carpeta ?? null),
    valor,
    origen: (tocada ? 'usuario' : 'sugerencia') as 'usuario' | 'sugerencia',
    elegir: (c: Carpeta) => {
      setElegida(c)
      setTocada(true)
    },
  }
}
