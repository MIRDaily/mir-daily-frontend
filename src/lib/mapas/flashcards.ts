import { plainText } from '@/lib/mapas/export/richtext'
import { splitFacet } from '@/lib/mapas/study'
import type { MapTable } from '@/lib/mapas/table'

// Flashcards a partir de una rama del mapa (informe 75). Funciones puras: el diálogo enseña el
// resultado como vista previa editable y luego lo manda con los endpoints de flashcards de siempre.
//
//  - Hoja «Faceta: dato» → delante «Ruta del padre · Faceta», detrás «dato».
//  - Hojas sin faceta que cuelgan del mismo nodo (un mapa hecho a mano: «ACG → Clínica → cefalea,
//    claudicación») → una tarjeta: delante «Ruta del abuelo · Clínica», detrás las hojas, una por
//    línea.
//  - Tabla → una tarjeta por fila: delante «Ruta · Título de la tabla · Fila», detrás
//    «Columna: celda», una por línea.
// El texto de los nodos es HTML con formato: las tarjetas llevan su texto plano.

export const MAX_CARD_CHARS = 5000 // el mismo tope que el backend
export const MAX_CARDS = 500 // el tope de tarjetas de un grupo

export type CardDraft = {
  key: string
  front: string
  back: string
  /** Tema de la tarjeta en /flashcards (agrupa dentro del grupo): el nodo del que cuelga. */
  topic: string
  kind: 'faceta' | 'grupo' | 'tabla'
  include: boolean
}

export type CardSourceNode = {
  id: string
  label: string
  parentId?: string
  table?: MapTable
  /** Posición vertical: los hermanos se leen de arriba abajo. */
  y: number
}

const SEP_RUTA = ' › '
const SEP_FACETA = ' · '
const clip = (s: string) => (s.length > MAX_CARD_CHARS ? `${s.slice(0, MAX_CARD_CHARS - 1)}…` : s)

/** Tarjetas de la rama que empieza en `rootId` (incluido). */
export function buildCards(nodes: CardSourceNode[], rootId: string): CardDraft[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  if (!byId.has(rootId)) return []
  const kids = new Map<string, CardSourceNode[]>()
  for (const n of nodes) {
    if (!n.parentId || !byId.has(n.parentId) || n.parentId === n.id) continue
    ;(kids.get(n.parentId) ?? kids.set(n.parentId, []).get(n.parentId)!).push(n)
  }
  for (const list of kids.values()) list.sort((a, b) => a.y - b.y)

  const text = (n: CardSourceNode) => (n.table ? n.table.title.trim() : plainText(n.label))
  // La raíz del mapa (el tema: «Tema 03 Vasculitis») no entra en una ruta larga: es el nombre del
  // grupo. En una ruta de un solo nivel sí, porque sin ella la tarjeta pierde el contexto (en un
  // mapa hecho a mano la raíz suele ser la enfermedad: «Etiología · Cardiopatía isquémica»).
  const ruta = (id: string | undefined): string[] => {
    const out: string[] = []
    const seen = new Set<string>()
    for (let cur = id ? byId.get(id) : undefined; cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      seen.add(cur.id)
      if (!cur.parentId || !byId.has(cur.parentId)) {
        if (out.length < 2) out.unshift(text(cur))
        break
      }
      out.unshift(text(cur))
    }
    return out.filter(Boolean)
  }
  const unir = (partes: string[], cola: string) => [partes.join(SEP_RUTA), cola].filter(Boolean).join(SEP_FACETA)

  const out: CardDraft[] = []
  const seen = new Set<string>()
  const push = (c: Omit<CardDraft, 'include'>) => {
    const front = clip(c.front.trim())
    const back = clip(c.back.trim())
    if (!front || !back) return
    const k = `${front}\u0000${back}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ ...c, front, back, include: true })
  }

  const visit = (n: CardSourceNode, guard: Set<string>) => {
    if (guard.has(n.id)) return
    guard.add(n.id)
    const children = kids.get(n.id) ?? []
    if (n.table) {
      const t = n.table
      const padre = ruta(n.parentId)
      t.rows.forEach((row, i) => {
        const nombre = (row[0] ?? '').trim()
        const lineas = row
          .slice(1)
          .map((c, j) => [t.columns[j + 1]?.trim(), c.trim()] as const)
          .filter(([, c]) => c)
          .map(([h, c]) => (h ? `${h}: ${c}` : c))
        if (!nombre || lineas.length === 0) return
        push({ key: `${n.id}:${i}`, front: unir(padre, [t.title.trim(), nombre].filter(Boolean).join(SEP_FACETA)), back: lineas.join('\n'), topic: text(byId.get(n.parentId ?? '') ?? n), kind: 'tabla' })
      })
      return
    }
    // Hijos que son hojas de texto sin faceta: van juntos en una tarjeta de este nodo.
    const sueltas: string[] = []
    for (const c of children) {
      const cc = kids.get(c.id) ?? []
      if (cc.length || c.table) continue
      const { faceta, dato } = splitFacet(text(c))
      if (faceta) push({ key: c.id, front: unir(ruta(n.id), faceta), back: dato, topic: text(n), kind: 'faceta' })
      else if (dato) sueltas.push(dato)
    }
    if (sueltas.length) {
      // Si además tiene hijos con rama propia («Etiología → HTA, Cardiopatía isquémica → …»), sus
      // nombres también son respuesta de esta tarjeta (y luego tienen la suya).
      sueltas.length = 0
      for (const c of children) {
        if (c.table) continue
        const t = (kids.get(c.id) ?? []).length ? text(c) : splitFacet(text(c)).faceta ? '' : text(c)
        if (t) sueltas.push(t)
      }
      push({ key: `${n.id}:hojas`, front: unir(ruta(n.parentId), text(n)), back: sueltas.join('\n'), topic: text(byId.get(n.parentId ?? '') ?? n), kind: 'grupo' })
    }
    for (const c of children) if ((kids.get(c.id) ?? []).length || c.table) visit(c, guard)
  }

  const root = byId.get(rootId)!
  if (!root.table && !(kids.get(rootId) ?? []).length) {
    // Una hoja suelta seleccionada: su propia tarjeta.
    const { faceta, dato } = splitFacet(text(root))
    if (faceta) push({ key: root.id, front: unir(ruta(root.parentId), faceta), back: dato, topic: text(byId.get(root.parentId ?? '') ?? root), kind: 'faceta' })
    return out
  }
  visit(root, new Set())
  return out.slice(0, MAX_CARDS)
}
