// Tipos de error que el usuario puede reportar. Tienen que coincidir con
// src/utils/reportes.js del backend y con el CHECK de content_reports.

export type ReportCategory =
  | 'respuesta_erronea'
  | 'explicacion'
  | 'errata'
  | 'imagen'
  | 'desactualizada'
  | 'duplicada'
  | 'dato_incorrecto'
  | 'otro'

export type ReportCategoryDef = {
  key: ReportCategory
  label: string
  icon: string
  /** Pregunta del campo opcional (en "otro" es obligatorio). */
  prompt: string
  /** Solo tiene sentido después de responder: antes destriparía o sería a ciegas. */
  needsAnswer?: boolean
}

const DEFS: Record<ReportCategory, ReportCategoryDef> = {
  respuesta_erronea: {
    key: 'respuesta_erronea',
    label: 'Respuesta correcta errónea',
    icon: 'rule',
    prompt: '¿Por qué? Si tienes una fuente, mejor.',
    needsAnswer: true,
  },
  explicacion: {
    key: 'explicacion',
    label: 'Explicación incorrecta o incompleta',
    icon: 'menu_book',
    prompt: '¿Qué falla o qué falta?',
    needsAnswer: true,
  },
  errata: {
    key: 'errata',
    label: 'Errata en enunciado u opciones',
    icon: 'spellcheck',
    prompt: '¿Qué pone y qué debería poner?',
  },
  imagen: {
    key: 'imagen',
    label: 'Problema con la imagen',
    icon: 'hide_image',
    prompt: '¿Algo más que debamos saber?',
  },
  desactualizada: {
    key: 'desactualizada',
    label: 'Desactualizada',
    icon: 'update',
    prompt: '¿Qué ha cambiado? (guía, año…)',
  },
  duplicada: {
    key: 'duplicada',
    label: 'Duplicada',
    icon: 'content_copy',
    prompt: '¿Con cuál? (año y número si lo sabes)',
  },
  dato_incorrecto: {
    key: 'dato_incorrecto',
    label: 'Dato incorrecto',
    icon: 'error',
    prompt: '¿Qué dato y dónde?',
  },
  otro: {
    key: 'otro',
    label: 'Otro',
    icon: 'more_horiz',
    prompt: 'Cuéntanos qué pasa',
  },
}

export const QUESTION_CATEGORIES: ReportCategoryDef[] = [
  DEFS.respuesta_erronea,
  DEFS.explicacion,
  DEFS.errata,
  DEFS.imagen,
  DEFS.desactualizada,
  DEFS.duplicada,
  DEFS.otro,
]

export const GUIDE_CATEGORIES: ReportCategoryDef[] = [
  DEFS.dato_incorrecto,
  DEFS.respuesta_erronea,
  DEFS.errata,
  DEFS.desactualizada,
  DEFS.otro,
]

export const IMAGE_SUBCATEGORIES = [
  { key: 'no_carga', label: 'No carga' },
  { key: 'no_corresponde', label: 'No corresponde' },
  { key: 'no_se_ve', label: 'No se ve bien' },
] as const

export type ImageSubcategory = (typeof IMAGE_SUBCATEGORIES)[number]['key']

export function categoryLabel(key: string): string {
  return DEFS[key as ReportCategory]?.label ?? key
}
