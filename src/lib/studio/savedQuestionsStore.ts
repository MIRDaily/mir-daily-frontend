'use client'

// En qué mazos está guardada cada pregunta, compartido por todos los
// `SaveToDeckButton` de la sesión (el equivalente web del
// `SavedQuestionsProvider` de la app).
//
// Antes cada botón lo guardaba en su propio estado y lo borraba al cambiar de
// pregunta: guardabas la 3, avanzabas, volvías, y el marcador salía vacío
// hasta abrir el popup. Tampoco pasaba del simulacro a la rejilla de
// resultados.
//
// Lo que viene del servidor entero (setQuestionDecks) queda «confirmado»
// durante 10 minutos: al volver a abrir el popup de esa pregunta no se vuelve a
// pedir. Lo apuntado solo en local (p. ej. «Guardar falladas», que sabe que la
// pregunta está en ESE mazo pero no en qué otros) no confirma nada, y al abrir
// el popup se pregunta al servidor. Entrar o salir de /decks, donde se quitan
// preguntas de los mazos, olvida las confirmaciones (src/app/decks/layout.tsx).

import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

/** deckId -> itemId de la pregunta dentro de ese mazo. */
export type DeckItemIds = Record<string, string>

const MEMBERSHIP_TTL_MS = 10 * 60 * 1000

const EMPTY: DeckItemIds = {}
const byQuestion = new Map<string, DeckItemIds>()
// Pregunta -> cuándo llegó del servidor la respuesta completa.
const confirmedAt = new Map<string, number>()
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

/** Sustituye todo lo sabido de una pregunta (tras leerlo del servidor) y lo da por confirmado. */
export function setQuestionDecks(questionId: string, itemIds: DeckItemIds) {
  byQuestion.set(questionId, itemIds)
  confirmedAt.set(questionId, Date.now())
  emit()
}

/**
 * ¿Se sabe, por el servidor y hace menos de 10 minutos, en qué mazos está? Lo
 * guardado o quitado después desde la web ya está apuntado encima, así que
 * sigue siendo cierto.
 */
export function isQuestionMembershipKnown(questionId: string): boolean {
  const at = confirmedAt.get(questionId)
  return at != null && Date.now() - at < MEMBERSHIP_TTL_MS
}

/** Lo sabido de una pregunta, fuera de React (vacío si no se sabe nada). */
export function getQuestionDecks(questionId: string): DeckItemIds {
  return byQuestion.get(questionId) ?? EMPTY
}

/** Lo sabido se sigue enseñando, pero la próxima apertura vuelve a preguntar. */
export function forgetConfirmedMemberships() {
  confirmedAt.clear()
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
    if (currentUserId !== undefined && userId !== currentUserId) {
      confirmedAt.clear()
      if (byQuestion.size > 0) {
        byQuestion.clear()
        emit()
      }
    }
    currentUserId = userId
  })
}
