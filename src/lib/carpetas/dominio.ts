// Señal de dominio del material propio (carpetas, fase 3, §7.2 de la especificación): la parte pura.
// Los datos vienen de GET /api/carpetas/asignatura/:id/dominio (material_dominio en la base de datos,
// con la curva de olvido de ts-fsrs). Es SOLO del material propio: nunca se mezcla con las preguntas MIR.

export type DominioGrupo = {
  deckId: string
  tipo: 'flashcards' | 'resumenes'
  elementos: number
  estudiados: number
  /** Probabilidad media de recordar hoy, 0-1 (lo no estudiado cuenta 0); null sin elementos. */
  dominio: number | null
  /** Estudiados / elementos, 0-1; null sin elementos. */
  cobertura: number | null
  ultimoRepaso: string | null
}

export type HuecoDebil = {
  itemId: number
  grupoId: string | null
  hueco: number
  texto: string
  fallos: number
  intentos: number
  falladoAhora: boolean
}

export type DominioCarpeta = {
  /** null = «General» de la asignatura. */
  topicId: number | null
  elementos: number
  estudiados: number
  dominio: number | null
  cobertura: number | null
  ultimoRepaso: string | null
  grupos: DominioGrupo[]
  huecosDebiles: HuecoDebil[]
}

export type RespuestaDominio = { disponible: boolean; carpetas: DominioCarpeta[] }

/**
 * Cuándo un tema está «bien llevado» (§10.5 de la especificación): dominio ≥ 80 % Y cobertura ≥ 70 %.
 * Cambiar aquí si se decide otro umbral; todo lo demás lo lee de esta constante.
 */
export const UMBRAL_BIEN_LLEVADO = { dominio: 0.8, cobertura: 0.7 } as const

export type EstadoDominio = 'bien' | 'en-marcha' | 'sin-estudiar' | 'vacio'

/** Cómo va una carpeta o un grupo: sin tarjetas, nada estudiado, en marcha o bien llevado. */
export function estadoDominio(d: Pick<DominioCarpeta, 'elementos' | 'estudiados' | 'dominio' | 'cobertura'> | null | undefined): EstadoDominio {
  if (!d || d.elementos === 0 || d.dominio === null || d.cobertura === null) return 'vacio'
  if (d.estudiados === 0) return 'sin-estudiar'
  return d.dominio >= UMBRAL_BIEN_LLEVADO.dominio && d.cobertura >= UMBRAL_BIEN_LLEVADO.cobertura ? 'bien' : 'en-marcha'
}

/** Un porcentaje entero (0,7234 → 72). */
export const porcentaje = (f: number) => Math.round(Math.min(1, Math.max(0, f)) * 100)

/** «recordarías hoy ~72 %». */
export const textoRecordarias = (dominio: number) => `recordarías hoy ~${porcentaje(dominio)} %`

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas» o la fecha («12 sept»), en días de calendario. */
export function haceCuanto(iso: string | null, ahora: Date = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const dia = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const dias = Math.round((dia(ahora) - dia(d)) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(d.getFullYear() !== ahora.getFullYear() ? { year: 'numeric' } : {}) })
}

/** La señal de cada carpeta por su clave (id del tema o 'general'). */
export function dominioPorCarpeta(r: RespuestaDominio | null): Map<number | 'general', DominioCarpeta> {
  return new Map((r?.carpetas ?? []).map((c) => [c.topicId ?? 'general', c]))
}
