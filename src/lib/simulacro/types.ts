// Sistema de simulacros (placeholder). Toda la lógica vive bajo `simulacro/`
// para poder eliminarla o reemplazarla sin tocar el resto de la app.

export type SimulacroMode = 'immediate' | 'deferred'

export type SimulacroPhase = 'builder' | 'running' | 'results'

export interface Subject {
  id: number
  name: string
}

export interface Topic {
  id: number
  name: string
  subject_id: number
}

export interface SimulacroConfig {
  subjectIds: number[]
  topicIds: number[]
  count: number
  mode: SimulacroMode
}

// La pregunta tal y como la entrega el backend: SIN la respuesta correcta ni la
// explicación. Esos datos solo se revelan tras corregir en el servidor (/check).
export interface SimulacroQuestion {
  id: number
  statement: string
  subject: string | null
  topic: string | null
  options: string[]
  has_image?: boolean
  image_url?: string | null
}

/** Resultado ternario de una pregunta: en el MIR el blanco no penaliza. */
export type SimulacroOutcome = 'correct' | 'wrong' | 'blank'

/** Corrección de una pregunta, devuelta por el backend tras responder. */
export interface SimulacroResult {
  questionId: number
  /** Índice 0-based de la opción correcta dentro de `options`. */
  correctIndex: number
  explanation: string | null
  isCorrect: boolean
  result: SimulacroOutcome
}

/** Respuesta del usuario por posición de pregunta. */
export interface SimulacroAnswer {
  selectedIndex: number | null
  /** true = el usuario dejó la pregunta en blanco a propósito. */
  blank?: boolean
  /** Segundos dedicados a la pregunta (para analítica). */
  timeSpent?: number
}

// Historial: solo se guardan simulacros COMPLETADOS con >=50 preguntas
// (ver POST /api/simulacro/finish). Una fila resumen por simulacro pasado.
export interface SimulacroHistorySession {
  id: string
  mode: SimulacroMode | null
  total_questions: number
  correct_count: number
  wrong_count: number
  blank_count: number
  time_spent_seconds: number
  started_at: string | null
  finished_at: string
  subjects: string[]
}

/** Repaso completo de un simulacro guardado: misma forma que consume SimulacroResultsGrid. */
export interface SimulacroHistoryDetail {
  questions: SimulacroQuestion[]
  answers: SimulacroAnswer[]
  results: SimulacroResult[]
}

/** Un día agregado del heatmap-calendario (puede mezclar varias sesiones del mismo día). */
export interface SimulacroCalendarDay {
  day: string
  session_count: number
  total_questions: number
  correct_count: number
  accuracy: number
  session_ids: string[]
}
