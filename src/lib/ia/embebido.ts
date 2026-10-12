import type { Ref } from 'react'
import type { Extraido } from '@/lib/mapas/ia/types'

// Los tres diálogos de IA (mapas, flashcards, resúmenes activos) pueden vivir como PESTAÑAS de un
// popup único («Crear desde un documento», en Studio). El archivo se lee UNA vez y lo comparten; cada
// diálogo conserva sus propios ajustes, su generación y su revisión. El servidor solo deja una
// generación a la vez por usuario (reserva común a los tres), así que «Generar todo» las lanza EN COLA.

/** El documento ya leído en el navegador: los diálogos empiezan directamente en sus ajustes. */
export type DocumentoCompartido = { archivo: File; extraido: Extraido }

/** Cómo terminó una generación pedida desde fuera (para seguir o parar la cola). */
export type ResultadoGenerar = 'ok' | 'fallo' | 'cancelado' | 'no'

export type ControlEmbebido = { generar: () => Promise<ResultadoGenerar> }

/** Lo que el popup necesita saber de cada pestaña (la etiqueta de estado y si se puede lanzar). */
export type EstadoEmbebido = {
  fase: 'elegir' | 'leyendo' | 'ajustes' | 'generando' | 'vista' | 'hecho'
  /** En «ajustes» y con todo en regla para generar. */
  listo: boolean
  /** Qué falta, si no está listo (para decírselo al usuario). */
  falta?: string
}

export type PropsEmbebido = {
  /** El documento compartido: con él, el diálogo se pinta como pestaña (sin marco ni cabecera). */
  compartido?: DocumentoCompartido
  /** La pestaña a la vista. Las demás siguen montadas (no pierden nada) pero ocultas y sin teclado. */
  visible?: boolean
  controlRef?: Ref<ControlEmbebido>
  onEstado?: (e: EstadoEmbebido) => void
}

/** Qué se marca de entrada: todo si cabe en lo que admite el servidor; si no, nada y el índice abierto. */
export function seleccionInicial(x: Extraido, lim: { maxChars: number; maxPaginas: number }) {
  const cabe = x.caracteres <= lim.maxChars && x.paginas <= lim.maxPaginas
  return { sel: cabe ? new Set(x.secciones.map((_, i) => i)) : new Set<number>(), abierto: !cabe }
}
