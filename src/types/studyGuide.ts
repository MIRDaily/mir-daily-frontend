export type GuideTier = 'imprescindible' | 'alta' | 'media' | 'baja'

export type GuideHotspot = {
  name: string
  /** 1 = sale a veces, 2 = sale a menudo, 3 = cae casi todos los años */
  heat: 1 | 2 | 3
}

export type GuideTopic = {
  id: string
  /** Siglas propias del bloque (2-3 letras), sin relación con la numeración de ningún manual */
  code: string
  name: string
  shortName: string
  tier: GuideTier
  /** Preguntas por año, alineadas con StudyGuide.perYear (el último valor es el último MIR) */
  perYear: number[]
  /** Preguntas de reserva del último MIR asignadas al tema */
  lastExamReserve: number
  /** Extensión aproximada del tema en páginas de un manual de referencia */
  pages: number
  focus: string
  hotspots: GuideHotspot[]
  keys: string[]
  trap?: string
}

export type GuideQuestionKind = 'bloque' | 'reserva' | 'frontera'

export type GuideQuestion = {
  number: number
  kind: GuideQuestionKind
  topicId: string | null
  /** Etiqueta del tema (o de la asignatura, si es frontera) */
  tag: string
  stem: string
  options: [string, string, string, string]
  correct: 1 | 2 | 3 | 4
  explanation: string
  /** Imagen de la pregunta (cuadernillo de imágenes), si la tiene */
  imageUrl?: string
}

export type GuideInsight = {
  icon: string
  title: string
  body: string
}

export type GuidePlanStep = {
  title: string
  subtitle: string
  topicIds: string[]
  days: number
}

export type StudyGuide = {
  subjectId: string
  title: string
  subtitle: string
  targetExam: string
  lastExam: string
  historyRange: string
  /** Preguntas por año en el periodo histórico + último MIR */
  perYear: Array<{ year: number; count: number }>
  lastExamTotal: number
  lastExamReserveTotal: number
  topics: GuideTopic[]
  insights: GuideInsight[]
  plan: GuidePlanStep[]
  questions: GuideQuestion[]
  sourcesNote: string
}
