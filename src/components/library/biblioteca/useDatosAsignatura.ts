'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cargarAsignatura, cargarDominio, type DatosAsignatura } from '@/lib/carpetas/api'
import { dominioPorCarpeta, type DominioCarpeta, type RespuestaDominio } from '@/lib/carpetas/dominio'
import { fetchSubjectHeatmap, fetchTopicHeatmap, type SubjectHeatmapCell, type TopicHeatmapCell } from '@/services/analyticsService'

export type AciertoPreguntas = { acierto: number | null; respondidas: number }
const SIN_RESPUESTAS: AciertoPreguntas = { acierto: null, respondidas: 0 }

/**
 * Lo que enseñan la asignatura y sus carpetas: el material del usuario y las preguntas MIR por tema
 * (GET /api/carpetas/asignatura/:id) y, aparte, su acierto en esas preguntas de siempre (/api/analytics,
 * ventana «todo»). Si las analíticas fallan, se enseña lo demás sin acierto.
 * La señal de dominio del material (fase 3) llega en su propia petición: si falla o la base de datos aún
 * no la tiene, `dominio.disponible` es false y la Biblioteca enseña el hueco «muy pronto».
 */
export function useDatosAsignatura(subjectId: number) {
  const [datos, setDatos] = useState<DatosAsignatura | null>(null)
  const [error, setError] = useState<{ mensaje: string; noExiste: boolean } | null>(null)
  const [temas, setTemas] = useState<Map<number, TopicHeatmapCell>>(new Map())
  const [asig, setAsig] = useState<SubjectHeatmapCell | null>(null)
  const [vuelta, setVuelta] = useState(0)
  const [dominio, setDominio] = useState<RespuestaDominio | null>(null)

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
    cargarDominio(subjectId)
      .then((d) => vivo && setDominio(d))
      .catch(() => vivo && setDominio({ disponible: false, carpetas: [] }))
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

  const porCarpeta = useMemo(() => dominioPorCarpeta(dominio), [dominio])
  /** La señal de una carpeta (null = «General»); undefined mientras llega o si no la hay. */
  const dominioDe = useCallback((topicId: number | null): DominioCarpeta | undefined => porCarpeta.get(topicId ?? 'general'), [porCarpeta])

  return {
    datos,
    error,
    aciertoDe,
    preguntasDe,
    detalleDe,
    dominioDe,
    /** null mientras llega; false si la base de datos todavía no calcula la señal. */
    dominioDisponible: dominio === null ? null : dominio.disponible,
    recargar: () => setVuelta((v) => v + 1),
  }
}
