// La carpeta como ÚNICA clasificación de los mapas (17/10/2026): el filtro de /mapas, el color y la
// etiqueta de cada tarjeta salen de folder_subject_id / folder_topic_id, no del texto libre `subject`
// (que se conserva en la base, pero ya no se enseña ni se edita). Sin red ni React.
//
// Mismo criterio que la Biblioteca (carpetaVisible en el backend): un mapa cuya asignatura no está en el
// árbol visible (oculta o desaparecida) cuenta como «Sin clasificar»; un tema que ya no es de esa
// asignatura, como su «General».

import type { AsignaturaCatalogo, Carpeta } from '@/lib/carpetas/sugerir'

/** 'todas', 'sin' (Sin clasificar) o el id de una asignatura. */
export type FiltroCarpeta = 'todas' | 'sin' | number

type ConCarpeta = { folder: Carpeta | null }

/** La asignatura visible del mapa, o null si está «Sin clasificar». */
export function asignaturaDeMapa(m: ConCarpeta, arbol: AsignaturaCatalogo[] | null): AsignaturaCatalogo | null {
  const id = m.folder?.subjectId ?? null
  if (id === null || !arbol) return null
  return arbol.find((a) => a.id === id) ?? null
}

/** Etiqueta de la tarjeta: «Reumatología › Lupus eritematoso sistémico» (nombre corto) o «Reumatología › General». */
export function etiquetaCarpetaMapa(m: ConCarpeta, arbol: AsignaturaCatalogo[] | null): { asignatura: AsignaturaCatalogo; texto: string } | null {
  const a = asignaturaDeMapa(m, arbol)
  if (!a) return null
  const t = m.folder?.topicId != null ? a.temas.find((x) => x.id === m.folder!.topicId) : undefined
  return { asignatura: a, texto: `${a.nombreCorto} › ${t ? t.nombre : 'General'}` }
}

export function pasaFiltroCarpeta(m: ConCarpeta, filtro: FiltroCarpeta, arbol: AsignaturaCatalogo[] | null): boolean {
  if (filtro === 'todas') return true
  const a = asignaturaDeMapa(m, arbol)
  return filtro === 'sin' ? a === null : a?.id === filtro
}

export type OpcionFiltro = { valor: FiltroCarpeta; etiqueta: string; sigla: string | null; n: number }

/**
 * Los botones del filtro: «Todas», «Sin clasificar» (si hay alguno) y las asignaturas que tienen mapas, en
 * el orden del catálogo. El filtro elegido sigue saliendo aunque se haya quedado sin mapas (al mover el
 * último), para poder quitarlo.
 */
export function opcionesFiltroCarpeta(maps: ConCarpeta[], arbol: AsignaturaCatalogo[] | null, elegido: FiltroCarpeta = 'todas'): OpcionFiltro[] {
  if (!arbol) return []
  const porAsig = new Map<number, number>()
  let sin = 0
  for (const m of maps) {
    const a = asignaturaDeMapa(m, arbol)
    if (a) porAsig.set(a.id, (porAsig.get(a.id) ?? 0) + 1)
    else sin += 1
  }
  const out: OpcionFiltro[] = [{ valor: 'todas', etiqueta: 'Todas', sigla: null, n: maps.length }]
  if (sin > 0 || elegido === 'sin') out.push({ valor: 'sin', etiqueta: 'Sin clasificar', sigla: null, n: sin })
  for (const a of arbol) {
    const n = porAsig.get(a.id) ?? 0
    if (n > 0 || elegido === a.id) out.push({ valor: a.id, etiqueta: a.nombreCorto, sigla: a.sigla, n })
  }
  return out
}
