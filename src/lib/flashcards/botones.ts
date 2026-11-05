// Botones para responder una flashcard (plan de flashcards, etapa B2). Por defecto, un SEMÁFORO de tres:
// «No me la sabía» (grado 1), «Me costó» (2) y «Me la sabía» (3). Quien venga de Anki puede elegir los cuatro
// de siempre (con «Fácil», el 4) en los ajustes; la preferencia se guarda en el servidor
// (/api/studio/flashcard-preferencias) para que la web y la app digan lo mismo.
//
// Los textos describen lo que pasó, no lo difícil que es la tarjeta: «Me costó» deja claro que es un acierto
// (para FSRS lo es, y ya no vuelve en la misma sesión). El color nunca va solo: siempre texto e icono.
// Puro: se prueba con `npm test`.

import { GRADE, type Grade } from '@/lib/studioFlashcards'

export type NumBotones = 3 | 4

export type BotonNota = { grade: Grade; label: string; corto: string; icon: string; fg: string; bg: string }

export const BOTONES_SEMAFORO: BotonNota[] = [
  { grade: GRADE.again, label: 'No me la sabía', corto: 'No', icon: 'close', fg: '#C4655A', bg: '#FFF1EE' },
  { grade: GRADE.hard, label: 'Me costó', corto: 'Me costó', icon: 'pending', fg: '#B4831F', bg: '#FBF3E1' },
  { grade: GRADE.good, label: 'Me la sabía', corto: 'Sí', icon: 'check', fg: '#5C7A59', bg: '#EAF2E8' },
]

export const BOTONES_ANKI: BotonNota[] = [
  { grade: GRADE.again, label: 'Otra vez', corto: 'Otra vez', icon: 'replay', fg: '#C4655A', bg: '#FFF1EE' },
  { grade: GRADE.hard, label: 'Difícil', corto: 'Difícil', icon: 'trending_down', fg: '#B4831F', bg: '#FBF3E1' },
  { grade: GRADE.good, label: 'Bien', corto: 'Bien', icon: 'check', fg: '#5C7A59', bg: '#EAF2E8' },
  { grade: GRADE.easy, label: 'Fácil', corto: 'Fácil', icon: 'bolt', fg: '#4E7C9B', bg: '#E7F0F6' },
]

export const POR_DEFECTO: NumBotones = 3

export const esNumBotones = (v: unknown): v is NumBotones => v === 3 || v === 4

export function botonesDe(n: NumBotones): BotonNota[] {
  return n === 4 ? BOTONES_ANKI : BOTONES_SEMAFORO
}

/** Tecla pulsada → grado, o null si esa tecla no responde con estos botones ('4' no vale en el semáforo). */
export function teclaAGrado(tecla: string, n: NumBotones): Grade | null {
  const k = Number(tecla)
  return Number.isInteger(k) && k >= 1 && k <= n && String(k) === tecla ? (k as Grade) : null
}

/**
 * Reparto de la sesión para el resumen: un recuadro por botón. Si la sesión tuvo alguna nota que estos botones
 * no tienen (un «Fácil» respondido antes de cambiar a semáforo), se añade su recuadro para que cuadre el total.
 */
export function repartoDe(porNota: Record<number, number>, n: NumBotones): { boton: BotonNota; total: number }[] {
  const lista = botonesDe(n).map((boton) => ({ boton, total: porNota[boton.grade] ?? 0 }))
  if (n === 3 && (porNota[GRADE.easy] ?? 0) > 0) lista.push({ boton: BOTONES_ANKI[3], total: porNota[GRADE.easy] })
  return lista
}
