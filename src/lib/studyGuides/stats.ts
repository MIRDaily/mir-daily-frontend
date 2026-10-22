import type { GuideTopic, StudyGuide } from '@/types/studyGuide'

/** Número de convocatorias (incluido el último MIR) que cuentan como "recientes". */
export const RECENT_WINDOW = 5

export type GuideTrend = 'sube' | 'estable' | 'baja'

export type TopicStats = {
  /** Preguntas del periodo histórico (todos los años salvo el último MIR) */
  historyCount: number
  lastExamCount: number
  /** Preguntas de todo el periodo, último MIR incluido: lo que cuentan los totales y el orden «Histórico» */
  totalCount: number
  recentCount: number
  recentAvg: number
  earlierAvg: number
  /** En cuántas de las convocatorias recientes cayó al menos una pregunta */
  recentHits: number
  trend: GuideTrend
  /** Media ponderada (70 % reciente, 30 % anterior): previsión orientativa por año */
  forecast: number
}

export type GuideTopicWithStats = GuideTopic & { stats: TopicStats }

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0)
}

export function computeTopicStats(topic: GuideTopic): TopicStats {
  const values = topic.perYear
  const recent = values.slice(-RECENT_WINDOW)
  const earlier = values.slice(0, -RECENT_WINDOW)
  const recentAvg = sum(recent) / recent.length
  const earlierAvg = earlier.length > 0 ? sum(earlier) / earlier.length : recentAvg
  const diff = recentAvg - earlierAvg

  // Umbral doble (absoluto y relativo) para no llamar tendencia al ruido de temas con 0-1 preguntas.
  let trend: GuideTrend = 'estable'
  if (diff >= 0.4 && recentAvg >= earlierAvg * 1.3) trend = 'sube'
  else if (diff <= -0.4 && recentAvg <= earlierAvg * 0.7) trend = 'baja'

  return {
    historyCount: sum(values.slice(0, -1)),
    lastExamCount: values.at(-1) ?? 0,
    totalCount: sum(values),
    recentCount: sum(recent),
    recentAvg,
    earlierAvg,
    recentHits: recent.filter((value) => value > 0).length,
    trend,
    forecast: recentAvg * 0.7 + earlierAvg * 0.3,
  }
}

// Las reservas del último MIR cuentan como preguntas normales, igual que en los años anteriores (el manual y el banco
// de preguntas las incluyen): se suman al último año de la serie, y de ahí salen totales, previsión, tendencia y tablas.
// `lastExamReserve` se queda solo para decir cuántas de esas preguntas fueron de reserva.
function withLastExamReserve(topic: GuideTopic): GuideTopic {
  if (topic.lastExamReserve === 0) return topic
  const perYear = [...topic.perYear]
  perYear[perYear.length - 1] += topic.lastExamReserve
  return { ...topic, perYear }
}

export function withStats(topics: GuideTopic[]): GuideTopicWithStats[] {
  return topics.map(withLastExamReserve).map((topic) => ({ ...topic, stats: computeTopicStats(topic) }))
}

/** Preguntas por año de la asignatura con las reservas del último MIR sumadas, como en el resto de años. */
export function subjectPerYear(guide: StudyGuide) {
  return guide.perYear.map((item, index) =>
    index === guide.perYear.length - 1 ? { ...item, count: item.count + guide.lastExamReserveTotal } : item,
  )
}

// Por debajo de 1 se muestra con un decimal: «<1» igualaba un tema de 0,6 preguntas al año con uno que no sale nunca.
export function formatForecast(forecast: number) {
  if (forecast < 0.05) return '0'
  if (forecast < 0.95) return `≈${formatAvg(Math.round(forecast * 10) / 10)}`
  return `≈${Math.round(forecast)}`
}

export function formatAvg(value: number) {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 })
}
