'use client'

import { useCallback, useEffect, useState } from 'react'
import { cargarAsignatura, type DatosAsignatura } from '@/lib/carpetas/api'
import { fetchSubjectHeatmap, fetchTopicHeatmap, type SubjectHeatmapCell, type TopicHeatmapCell } from '@/services/analyticsService'

export type AciertoPreguntas = { acierto: number | null; respondidas: number }
const SIN_RESPUESTAS: AciertoPreguntas = { acierto: null, respondidas: 0 }

/**
 * Lo que enseñan la asignatura y sus carpetas: el material del usuario y las preguntas MIR por tema
 * (GET /api/carpetas/asignatura/:id) y, aparte, su acierto en esas preguntas de siempre (/api/analytics,
 * ventana «todo»). Si las analíticas fallan, se enseña lo demás sin acierto.
 */
export function useDatosAsignatura(subjectId: number) {
  const [datos, setDatos] = useState<DatosAsignatura | null>(null)
  const [error, setError] = useState<{ mensaje: string; noExiste: boolean } | null>(null)
  const [temas, setTemas] = useState<Map<number, TopicHeatmapCell>>(new Map())
  const [asig, setAsig] = useState<SubjectHeatmapCell | null>(null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let vivo = true
    cargarAsignatura(subjectId)
      .then((d) => {
        if (!vivo) return
        setDatos(d)
        setError(null)
      })
      .catch((e) => {
        if (!vivo) return
        const mensaje = e instanceof Error ? e.message : 'No se pudo cargar la asignatura'
        setError({ mensaje, noExiste: /no existe|no válida/i.test(mensaje) })
      })
    return () => {
      vivo = false
    }
  }, [subjectId, vuelta])

  useEffect(() => {
    let vivo = true
    fetchTopicHeatmap(subjectId, 'all')
      .then((r) => vivo && setTemas(new Map(r.topics.map((t) => [t.topicId, t]))))
      .catch(() => {})
    fetchSubjectHeatmap('all')
      .then((r) => vivo && setAsig(r.subjects.find((s) => s.subjectId === subjectId) ?? null))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [subjectId])

  /** Acierto en las preguntas de un tema, o de toda la asignatura si `topicId` es null («General»). */
  const aciertoDe = useCallback(
    (topicId: number | null): AciertoPreguntas => {
      const c = topicId === null ? asig : temas.get(topicId)
      return c ? { acierto: c.accuracy, respondidas: c.total } : SIN_RESPUESTAS
    },
    [asig, temas],
  )
  /** Preguntas MIR de un tema, o de toda la asignatura si `topicId` es null. */
  const preguntasDe = useCallback(
    (topicId: number | null): number | null => {
      if (!datos) return null
      return topicId === null ? datos.preguntas.total : (datos.preguntas.porTema[String(topicId)] ?? 0)
    },
    [datos],
  )
  const detalleDe = useCallback((topicId: number | null) => (topicId === null ? asig : temas.get(topicId)) ?? null, [asig, temas])

  return { datos, error, aciertoDe, preguntasDe, detalleDe, recargar: () => setVuelta((v) => v + 1) }
}
