'use client'

// Lista de mazos del selector de «guardar en un mazo», compartida por todos
// los selectores de la pestaña: el popup del daily, cada SaveToDeckButton
// (simulacro, resultados, revisión del daily) y «Guardar falladas».
//
// Antes cada selector la pedía por su cuenta y en cada pregunta nueva. Ahora
// se pide UNA vez (GET /api/studio/decks/selector), se reutiliza en todas las
// preguntas y, si varios la piden a la vez, comparten la misma petición. Lo
// que cambia de una pregunta a otra (en qué mazos está) va aparte, por
// fetchQuestionMembership y savedQuestionsStore.
//
// Cuándo se vuelve a pedir:
//   · a los 10 minutos (otro dispositivo pudo crear o borrar mazos);
//   · al entrar o salir de /decks, donde se crean, borran y renombran
//     (src/app/decks/layout.tsx);
//   · si un guardado responde 404 (el mazo ya no existe);
//   · al cambiar de cuenta, que además la vacía.
// Un mazo creado desde un selector se añade sin pedir nada (onStudioDeckCreated).

import { useSyncExternalStore } from 'react'
import {
  type StudioDeck,
  fetchDeckSelector,
  isAutoFailedDeck,
  markDeckUsed,
  onStudioDeckCreated,
  sortDecksByLastUse,
} from '@/lib/studioDecks'

export const PICKER_DECKS_TTL_MS = 10 * 60 * 1000

let decks: StudioDeck[] | null = null
let loadedAt = 0
let inFlight: Promise<StudioDeck[]> | null = null
// Sube con cada invalidación: una respuesta que llega después ya no vale.
let generation = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** La lista en memoria (null hasta la primera carga). Puede estar caducada: ver hasFreshPickerDecks. */
export function usePickerDecks(): StudioDeck[] | null {
  return useSyncExternalStore(
    subscribe,
    () => decks,
    () => null,
  )
}

export function hasFreshPickerDecks(): boolean {
  return decks != null && Date.now() - loadedAt < PICKER_DECKS_TTL_MS
}

/** Devuelve la lista si está al día; si no, la pide (una sola vez aunque la pidan varios). */
export function loadPickerDecks(token: string): Promise<StudioDeck[]> {
  if (decks && hasFreshPickerDecks()) return Promise.resolve(decks)
  if (inFlight) return inFlight

  const gen = generation
  const request = fetchDeckSelector(token)
    .then((list) => {
      const clean = list.filter((deck) => deck.deleted_at == null && !isAutoFailedDeck(deck))
      if (gen === generation) {
        decks = clean
        loadedAt = Date.now()
        emit()
      }
      return clean
    })
    .finally(() => {
      if (inFlight === request) inFlight = null
    })
  inFlight = request
  return request
}

/** La siguiente apertura vuelve a pedir la lista. Se sigue enseñando la que hay mientras tanto. */
export function markPickerDecksStale() {
  generation += 1
  inFlight = null
  loadedAt = 0
}

/** Reordena por último uso. Se llama al ABRIR un selector, nunca con uno abierto. */
export function sortPickerDecks() {
  if (!decks) return
  const sorted = sortDecksByLastUse(decks)
  if (sorted.every((deck, i) => deck === decks![i])) return
  decks = sorted
  emit()
}

/** Apunta que se acaba de guardar en el mazo, sin moverlo (sube en la próxima apertura). */
export function markPickerDeckUsed(deckId: string) {
  if (!decks) return
  decks = markDeckUsed(decks, deckId)
  emit()
}

type CreatedDeck = StudioDeck & { kind?: string | null; created_at?: string | null }

// Creado desde un selector: arriba, que es donde se va a usar. Solo si es un
// mazo de preguntas y la lista ya estaba cargada (si no, ya vendrá al pedirla).
onStudioDeckCreated((created) => {
  const deck = created as CreatedDeck
  if (!decks || (deck.kind && deck.kind !== 'questions') || isAutoFailedDeck(deck)) return
  if (decks.some((d) => String(d.id) === String(deck.id))) return
  decks = [{ ...deck, last_used_at: deck.created_at ?? new Date().toISOString() }, ...decks]
  emit()
})

/** Vacía la lista (cambio de cuenta). */
export function resetPickerDecks() {
  markPickerDecksStale()
  if (decks) {
    decks = null
    emit()
  }
}

if (typeof window !== 'undefined') {
  // Al cambiar de cuenta (o cerrar sesión) la lista era de otro usuario. Se mira
  // el id y no el evento: supabase repite SIGNED_IN al volver a la pestaña. El
  // cliente se importa aquí dentro para que el módulo se pueda probar en Node
  // sin variables de Supabase.
  void import('@/lib/supabaseBrowser').then(({ supabase }) => {
    let currentUserId: string | null | undefined
    supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null
      if (currentUserId !== undefined && userId !== currentUserId) resetPickerDecks()
      currentUserId = userId
    })
  })
}
