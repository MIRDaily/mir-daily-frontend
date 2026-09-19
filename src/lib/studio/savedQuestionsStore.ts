'use client'

// En qué mazos está guardada cada pregunta, compartido por todos los
// `SaveToDeckButton` de la sesión (el equivalente web del
// `SavedQuestionsProvider` de la app).
//
// Antes cada botón lo guardaba en su propio estado y lo borraba al cambiar de
// pregunta: guardabas la 3, avanzabas, volvías, y el marcador salía vacío
// hasta abrir el popup. Tampoco pasaba del simulacro a la rejilla de
// resultados. Esto es solo una memoria de lo ya sabido: al abrir el popup se
// sigue pidiendo el estado real al servidor, que corrige lo que haya aquí.

import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

/** deckId -> itemId de la pregunta dentro de ese mazo. */
export type DeckItemIds = Record<string, string>

const EMPTY: DeckItemIds = {}
const byQuestion = new Map<string, DeckItemIds>()
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

/** Sustituye todo lo sabido de una pregunta (tras leerlo del servidor). */
export function setQuestionDecks(questionId: string, itemIds: DeckItemIds) {
  byQuestion.set(questionId, itemIds)
  emit()
}

/** Apunta que la pregunta está en un mazo (itemId puede faltar si el POST no lo devolvió). */
export function markQuestionInDeck(questionId: string, deckId: string, itemId: string | null) {
  const prev = byQuestion.get(questionId) ?? EMPTY
  byQuestion.set(questionId, { ...prev, [deckId]: itemId ?? '' })
  emit()
}

export function unmarkQuestionInDeck(questionId: string, deckId: string) {
  const prev = byQuestion.get(questionId)
  if (!prev || !(deckId in prev)) return
  const next = { ...prev }
  delete next[deckId]
  byQuestion.set(questionId, next)
  emit()
}

/** Mazos (y su itemId) en los que se sabe que está la pregunta. */
export function useQuestionDecks(questionId: string): DeckItemIds {
  return useSyncExternalStore(
    subscribe,
    () => byQuestion.get(questionId) ?? EMPTY,
    () => EMPTY,
  )
}

// Al cambiar de cuenta (o cerrar sesión) lo apuntado era de otro usuario. Se
// mira el id y no el evento: supabase repite SIGNED_IN al volver a la pestaña,
// y eso no debe borrar nada.
if (typeof window !== 'undefined') {
  let currentUserId: string | null | undefined
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id ?? null
    if (currentUserId !== undefined && userId !== currentUserId && byQuestion.size > 0) {
      byQuestion.clear()
      emit()
    }
    currentUserId = userId
  })
}
