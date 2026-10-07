// Cuándo aparece cada nodo en la entrada de un mapa (ver proto/utils/entryAnimation.ts): en
// oleadas por profundidad (raíz, bloques, enfermedades, hojas…) y, dentro de cada nivel, de arriba
// abajo con un pequeño escalonado. Acotado para que un mapa de 1.000 nodos no tarde más que uno de
// 50: el total ronda 1,2 s. Puro: se prueba con `npm test`.

/** Separación entre una oleada (un nivel) y la siguiente. */
export const NIVEL_MS = 120
/** Niveles que esperan: los más hondos salen con el último. */
export const MAX_NIVEL = 5
/** Escalonado máximo dentro de un nivel (de arriba abajo). */
export const REPARTO_MS = 180

/** id → retardo en ms. `padre` null = raíz (o nodo suelto). */
export function delaysEntrada(nodos: { id: string; padre: string | null; y: number }[]): Map<string, number> {
  const ids = new Set(nodos.map((n) => n.id))
  const padre = new Map(nodos.map((n) => [n.id, n.padre && ids.has(n.padre) ? n.padre : null]))
  const nivel = new Map<string, number>()
  const nivelDe = (id: string): number => {
    const ya = nivel.get(id)
    if (ya !== undefined) return ya
    nivel.set(id, 0) // contra ciclos
    const p = padre.get(id)
    const v = p ? nivelDe(p) + 1 : 0
    nivel.set(id, v)
    return v
  }
  const porNivel = new Map<number, { id: string; y: number }[]>()
  for (const n of nodos) {
    const v = Math.min(nivelDe(n.id), MAX_NIVEL)
    ;(porNivel.get(v) ?? porNivel.set(v, []).get(v)!).push({ id: n.id, y: n.y })
  }
  const out = new Map<string, number>()
  for (const [v, lista] of porNivel) {
    lista.sort((a, b) => a.y - b.y)
    // Pocos nodos, poco escalonado (6 ms por nodo); muchos, como mucho REPARTO_MS en total.
    const reparto = Math.min(REPARTO_MS, lista.length * 6)
    lista.forEach((n, k) => {
      out.set(n.id, Math.round(v * NIVEL_MS + (lista.length > 1 ? (k / (lista.length - 1)) * reparto : 0)))
    })
  }
  return out
}
