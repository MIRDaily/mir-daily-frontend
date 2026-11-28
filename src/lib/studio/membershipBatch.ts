// Pertenencia en lote para los simulacros (fase 4 del selector de «guardar en
// un mazo»): la primera vez que se abre el selector en un simulacro se pregunta
// de una vez en qué mazos está cada una de sus preguntas (hasta 210 en un MIR),
// en vez de una petición por pregunta. Lo que llega queda en savedQuestionsStore
// como confirmado (10 min), así que el resto de aperturas no piden nada.
//
// Tres cuidados:
//   · no pedir dos veces lo mismo: las preguntas ya confirmadas no se piden, y
//     las que ya van en un lote en vuelo esperan a ese lote;
//   · no pisar lo que cambió mientras tanto: si guardas o quitas una pregunta
//     (o pulsas «Guardar falladas») con el lote en vuelo, lo que trae el lote
//     para esa pregunta ya es viejo y se descarta (getMembershipVersion). Esa
//     pregunta queda sin confirmar y, al abrirla, se pregunta sola;
//   · un MIR (210) es una sola petición: el backend admite 250 y
//     fetchQuestionsMembership trocea por encima.

import { fetchQuestionsMembership } from '@/lib/studioDecks'
import {
  getMembershipVersion,
  isQuestionMembershipKnown,
  setManyQuestionDecks,
} from '@/lib/studio/savedQuestionsStore'

// Pregunta -> el lote en vuelo que la trae.
const inFlight = new Map<string, Promise<void>>()

/**
 * Se asegura de que se sabe en qué mazos está cada pregunta de la lista: pide
 * en un solo lote las que no se saben y espera a los lotes en vuelo que ya
 * traen otras. Si falla, rechaza (quien llama puede preguntar por una sola).
 */
export async function loadMembershipBatch(token: string, questionIds: readonly string[]): Promise<void> {
  const pending = [...new Set(questionIds)].filter((id) => !isQuestionMembershipKnown(id))
  if (pending.length === 0) return

  const waiting = new Set<Promise<void>>()
  const toFetch: string[] = []
  for (const id of pending) {
    const flight = inFlight.get(id)
    if (flight) waiting.add(flight)
    else toFetch.push(id)
  }

  if (toFetch.length > 0) {
    const versions = new Map(toFetch.map((id) => [id, getMembershipVersion(id)]))
    const batch: Promise<void> = fetchQuestionsMembership(token, toFetch)
      .then((result) => {
        const fresh = toFetch.filter((id) => getMembershipVersion(id) === versions.get(id))
        // Las que no están en ningún mazo no vienen: se saben vacías.
        setManyQuestionDecks(fresh.map((id) => [id, result[id] ?? {}]))
      })
      .finally(() => {
        for (const id of toFetch) {
          if (inFlight.get(id) === batch) inFlight.delete(id)
        }
      })
    for (const id of toFetch) inFlight.set(id, batch)
    waiting.add(batch)
  }

  await Promise.all(waiting)
}
