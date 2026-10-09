// Guardar la vista previa de los resúmenes con IA (lo puro; se prueba con `npm test`):
//   - qué párrafos se guardan de verdad (los marcados, salvo los casi iguales a uno del grupo que el
//     usuario no ha pedido incluir);
//   - si lo literal de cada documento cabe en el grupo (30 % de sus caracteres, lo comprueba también
//     el servidor), para avisar ANTES de empezar y no guardar a medias;
//   - las tandas para el servidor: por documento (cada una con su fuente firmada) y de 40 en 40 (el
//     JSON de la API tiene 100 kB).

import type { FuenteFirmada, ModoResumen, ParrafoBorrador } from '@/lib/resumenes/borrador'
import type { Parecido, ParrafoNuevo, TandaIA, UsoLiteral } from '@/lib/resumenes/api'

export const TANDA = 40

/** ¿Se guarda? Marcado y, si se parece a uno del grupo, con «Incluir igual». */
export const seGuarda = (p: ParrafoBorrador, parecido: Parecido | null | undefined) => p.incluir && (!parecido || p.incluirParecido === true)

/** Caracteres de «texto original» por documento entre los que se guardan. */
export function literalPorDocumento(lista: ParrafoBorrador[], modo: ModoResumen, parecidos: Map<string, Parecido | null>): Map<string, number> {
  const out = new Map<string, number>()
  if (modo !== 'literal') return out
  for (const p of lista) if (p.doc && seGuarda(p, parecidos.get(p.key))) out.set(p.doc, (out.get(p.doc) ?? 0) + p.texto.length)
  return out
}

/** Los documentos que se pasarían del tope en el grupo: { hash, usado, tope, nuevos, sobran }. */
export function excesosLiteral(nuevos: Map<string, number>, usos: UsoLiteral[]): { hash: string; usado: number; tope: number; nuevos: number; sobran: number }[] {
  const out = []
  for (const u of usos) {
    const n = nuevos.get(u.hash) ?? 0
    if (n > 0 && u.usado + n > u.tope) out.push({ ...u, nuevos: n, sobran: u.usado + n - u.tope })
  }
  return out
}

/**
 * Los que se guardan → tandas por documento (en el orden de la lista), de TANDA en TANDA, con su
 * fuente y los índices (dentro de la tanda) de los que van aunque se parezcan a uno del grupo.
 */
export function tandasDeGuardado(
  lista: ParrafoBorrador[],
  aNuevo: (p: ParrafoBorrador) => ParrafoNuevo,
  fuentes: FuenteFirmada[],
  parecidos: Map<string, Parecido | null>,
): TandaIA[] {
  const porDoc = new Map<string, ParrafoBorrador[]>()
  for (const p of lista) {
    if (!seGuarda(p, parecidos.get(p.key))) continue
    const k = p.doc && fuentes.some((f) => f.hash === p.doc) ? p.doc : ''
    const g = porDoc.get(k)
    if (g) g.push(p)
    else porDoc.set(k, [p])
  }
  const tandas: TandaIA[] = []
  for (const [hash, ps] of porDoc) {
    const fuente = fuentes.find((f) => f.hash === hash) ?? null
    for (let k = 0; k < ps.length; k += TANDA) {
      const trozo = ps.slice(k, k + TANDA)
      tandas.push({
        fuente,
        parrafos: trozo.map(aNuevo),
        incluirParecidos: trozo.flatMap((p, j) => (p.incluirParecido && parecidos.get(p.key) ? [j] : [])),
      })
    }
  }
  return tandas
}
