'use client'

import { useMemo } from 'react'
import { cargarArbol, cargarSinClasificar } from '@/lib/carpetas/api'
import { sugerenciaDe, type ElementoMaterial } from '@/lib/carpetas/biblioteca'
import type { Carpeta } from '@/lib/carpetas/sugerir'
import { useCargaRecordada } from '@/hooks/useMemoriaDePestana'

/** Clave de un elemento en listas y selecciones. */
export const claveElemento = (e: Pick<ElementoMaterial, 'tipo' | 'id'>) => `${e.tipo}:${e.id}`

/**
 * Lo que no tiene carpeta y adónde parece ir cada cosa (§6). Lo comparten «Sin clasificar», la portada
 * de la Biblioteca y cada asignatura, con la misma memoria de pestaña: al pasar de una a otra no se vuelve
 * a esperar. La sugerencia se calcula en el navegador y sin coste (lib/carpetas/sugerir.ts); NUNCA mueve
 * nada sola.
 */
export function useSinClasificar() {
  const carga = useCargaRecordada('biblioteca:sin-clasificar', () => Promise.all([cargarArbol(), cargarSinClasificar()]))
  const arbol = carga.datos?.[0] ?? null
  const elementos = carga.datos?.[1] ?? null

  const { sugerencias, porAsignatura } = useMemo(() => {
    const sugerencias = new Map<string, Carpeta>()
    const porAsignatura = new Map<number, number>()
    if (arbol && elementos) {
      for (const e of elementos) {
        const s = sugerenciaDe(arbol, e)
        if (!s || s.subjectId === null) continue
        sugerencias.set(claveElemento(e), s)
        porAsignatura.set(s.subjectId, (porAsignatura.get(s.subjectId) ?? 0) + 1)
      }
    }
    return { sugerencias, porAsignatura }
  }, [arbol, elementos])

  return {
    carga,
    arbol,
    /** null mientras llega. */
    elementos,
    /** Elemento (por `claveElemento`) → carpeta sugerida. */
    sugerencias,
    /** Asignatura → cuántos elementos sin carpeta parecen suyos. */
    porAsignatura,
  }
}
