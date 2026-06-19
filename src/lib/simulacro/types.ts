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
}

/** Corrección de una pregunta, devuelta por el backend tras responder. */
export interface SimulacroResult {
  questionId: number
  /** Índice 0-based de la opción correcta dentro de `options`. */
  correctIndex: number
  explanation: string | null
  isCorrect: boolean
}

/** Respuesta del usuario por posición de pregunta. */
export interface SimulacroAnswer {
  selectedIndex: number | null
}
