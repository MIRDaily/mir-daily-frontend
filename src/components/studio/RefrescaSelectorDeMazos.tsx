'use client'

import { useEffect } from 'react'
import { markPickerDecksStale } from '@/lib/studio/deckPickerStore'
import { forgetConfirmedMemberships } from '@/lib/studio/savedQuestionsStore'

// En /decks se crean, renombran y borran mazos y se quitan preguntas de ellos,
// con peticiones propias que no pasan por los selectores. Al entrar y al salir
// se da por caducado lo que los selectores tienen en memoria (la lista de
// mazos y en qué mazos está cada pregunta), así que la siguiente apertura lo
// vuelve a pedir. No pinta nada.
export default function RefrescaSelectorDeMazos() {
  useEffect(() => {
    const caducar = () => {
      markPickerDecksStale()
      forgetConfirmedMemberships()
    }
    caducar()
    return caducar
  }, [])
  return null
}
