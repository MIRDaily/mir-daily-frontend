'use client'

import { useCallback, useMemo } from 'react'
import { cargarAsignatura, cargarDominio } from '@/lib/carpetas/api'
import type { ElementoMaterial } from '@/lib/carpetas/biblioteca'
import type { Carpeta } from '@/lib/carpetas/sugerir'
import { dominioPorCarpeta, type DominioCarpeta, type RespuestaDominio } from '@/lib/carpetas/dominio'
import { fetchSubjectHeatmap, fetchTopicHeatmap } from '@/services/analyticsService'
import { useCargaRecordada } from '@/hooks/useMemoriaDePestana'

export type AciertoPreguntas = { acierto: number | null; respondidas: number }
const SIN_RESPUESTAS: AciertoPreguntas = { acierto: null, respondidas: 0 }
const SIN_DOMINIO: RespuestaDominio = { disponible: false, carpetas: [] }

/** El acierto por asignatura (ventana «todo»): lo comparten la portada de la Biblioteca y cada asignatura. */
export const useAciertoAsignaturas = () => useCargaRecordada('analytics:asignaturas:todo', () => fetchSubjectHeatmap('all'))

/**
 * Lo que enseñan la asignatura y sus carpetas: el material del usuario y las preguntas MIR por tema
 * (GET /api/carpetas/asignatura/:id) y, aparte, su acierto en esas preguntas de siempre (/api/analytics,
 * ventana «todo»). Si las analíticas fallan, se enseña lo demás sin acierto.
 * La señal de dominio del material (fase 3) llega en su propia petición: si falla o la base de datos aún
 * no la tiene, `dominio.disponible` es false y la Biblioteca enseña el hueco «muy pronto».
 * Todo con memoria de pestaña: al volver a la asignatura (o de una carpeta a otra) se pinta al instante con
 * lo último que se tuvo y se refresca por detrás; `deMemoria` dice si fue así.
 */
export function useDatosAsignatura(subjectId: number) {
  const asignatura = useCargaRecordada(`biblioteca:asignatura:${subjectId}`, () => cargarAsignatura(subjectId))
  const dominioCarga = useCargaRecordada(`biblioteca:dominio:${subjectId}`, () => cargarDominio(subjectId).catch(() => SIN_DOMINIO))
  const temasCarga = useCargaRecordada(`analytics:temas:${subjectId}:todo`, () => fetchTopicHeatmap(subjectId, 'all'))
  const asignaturasCarga = useAciertoAsignaturas()

  const datos = asignatura.datos ?? null
  const dominio = dominioCarga.datos ?? null
  // Un fallo al refrescar no tapa lo que ya se tenía: solo se enseña si no hay nada que pintar.
  const error = useMemo(() => {
    if (datos || !asignatura.error) return null
    const mensaje = asignatura.error instanceof Error ? asignatura.error.message : 'No se pudo cargar la asignatura'
    return { mensaje, noExiste: /no existe|no válida/i.test(mensaje) }
  }, [datos, asignatura.error])

  const temas = useMemo(() => new Map((temasCarga.datos?.topics ?? []).map((t) => [t.topicId, t])), [temasCarga.datos])
  const asig = useMemo(
    () => asignaturasCarga.datos?.subjects.find((s) => s.subjectId === subjectId) ?? null,
    [asignaturasCarga.datos, subjectId],
  )

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

  const recargarAsignatura = asignatura.recargar
  const recargarDominio = dominioCarga.recargar
  const recargar = useCallback(() => {
    recargarAsignatura()
    recargarDominio()
  }, [recargarAsignatura, recargarDominio])

  // Tras «Mover a…»: la fila sale ya (animada) sin esperar a la red, y luego se recarga lo de verdad.
  const mutarAsignatura = asignatura.mutar
  const movido = useCallback(
    (e: Pick<ElementoMaterial, 'tipo' | 'id'>, c: Carpeta) => {
      const esEste = (x: ElementoMaterial) => x.tipo === e.tipo && x.id === e.id
      mutarAsignatura((d) => ({
        ...d,
        elementos:
          c.subjectId === subjectId ? d.elementos.map((x) => (esEste(x) ? { ...x, carpeta: c } : x)) : d.elementos.filter((x) => !esEste(x)),
      }))
      recargar()
    },
    [mutarAsignatura, recargar, subjectId],
  )

  return {
    datos,
    error,
    /** Los datos de la asignatura ya estaban en memoria al montar (se vuelve a ella): sin entrada animada. */
    deMemoria: asignatura.deMemoria,
    aciertoDe,
    preguntasDe,
    detalleDe,
    dominioDe,
    /** null mientras llega; false si la base de datos todavía no calcula la señal. */
    dominioDisponible: dominio === null ? null : dominio.disponible,
    recargar,
    /** Un elemento se ha movido a `c`: actualiza la pantalla al momento y recarga. */
    movido,
  }
}
