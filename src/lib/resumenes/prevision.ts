// Resúmenes activos: previsión y estadísticas (puro, se prueba con `npm test`). Lo que devuelve
// GET /api/resumenes/prevision (todos los grupos) y GET /api/resumenes/:id/prevision (uno), saneado, y
// los textos que se enseñan. Las cifras las cuenta la base de datos (get_resumenes_prevision): aquí no
// se suma nada que pudiera quedarse corto.

import { esNivel, type Nivel } from '@/lib/resumenes/huecos'

export type DiaPrevision = { fecha: string; n: number }
export type HuecoFallado = {
  itemId: number
  grupoId: string | null
  grupo: string | null
  tema: string | null
  hueco: number
  texto: string
  nivel: Nivel
  fallos: number
  intentos: number
  falladoAhora: boolean
}
export type Prevision = {
  grupos: number
  parrafos: number
  nuevos: number
  /** Lo que la lista de grupos llama «por repasar»: nuevos + los que tocan ya. */
  pendientes: number
  repasoAhora: number
  prevision: { atrasados: number; hoy: number; manana: number; semana: number; mes: number; dias: DiaPrevision[] }
  estados: { new: number; failed: number; learning: number; mastered: number }
  retencion: { repasos: number; repasos30: number; programados: number; recordados: number; tasa: number | null; programados30: number; recordados30: number; tasa30: number | null }
  huecos: { repasados: number; sabidos: number; tasa: number | null; repasados30: number; sabidos30: number; tasa30: number | null }
  masFallados: HuecoFallado[]
  hoyFecha: string | null
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0)
const t = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null)
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
const o = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** La respuesta del servidor → Prevision (ceros y nulos si falta algo; nunca revienta). */
export function sanearPrevision(raw: unknown): Prevision {
  const x = o(raw)
  const p = o(x.prevision)
  const e = o(x.estados)
  const r = o(x.retencion)
  const h = o(x.huecos)
  return {
    grupos: n(x.grupos),
    parrafos: n(x.parrafos),
    nuevos: n(x.nuevos),
    pendientes: n(x.pendientes),
    repasoAhora: n(x.repasoAhora),
    prevision: {
      atrasados: n(p.atrasados),
      hoy: n(p.hoy),
      manana: n(p.manana),
      semana: n(p.semana),
      mes: n(p.mes),
      dias: (Array.isArray(p.dias) ? p.dias : [])
        .map(o)
        .filter((d) => typeof d.fecha === 'string' && FECHA.test(d.fecha))
        .slice(0, 30)
        .map((d) => ({ fecha: String(d.fecha), n: n(d.n) })),
    },
    estados: { new: n(e.new), failed: n(e.failed), learning: n(e.learning), mastered: n(e.mastered) },
    retencion: {
      repasos: n(r.repasos),
      repasos30: n(r.repasos30),
      programados: n(r.programados),
      recordados: n(r.recordados),
      tasa: t(r.tasa),
      programados30: n(r.programados30),
      recordados30: n(r.recordados30),
      tasa30: t(r.tasa30),
    },
    huecos: { repasados: n(h.repasados), sabidos: n(h.sabidos), tasa: t(h.tasa), repasados30: n(h.repasados30), sabidos30: n(h.sabidos30), tasa30: t(h.tasa30) },
    masFallados: (Array.isArray(x.masFallados) ? x.masFallados : [])
      .map(o)
      .filter((m) => typeof m.texto === 'string' && m.texto.trim())
      .slice(0, 5)
      .map((m) => ({
        itemId: n(m.itemId),
        grupoId: s(m.grupoId, 36),
        grupo: s(m.grupo, 80),
        tema: s(m.tema, 120),
        hueco: n(m.hueco),
        texto: String(m.texto).slice(0, 120),
        nivel: esNivel(m.nivel) ? m.nivel : 2,
        fallos: n(m.fallos),
        intentos: n(m.intentos),
        falladoAhora: m.falladoAhora === true,
      })),
    hoyFecha: typeof x.hoyFecha === 'string' && FECHA.test(x.hoyFecha) ? x.hoyFecha : null,
  }
}

const parrafos = (k: number) => (k === 1 ? '1 párrafo' : `${k.toLocaleString('es-ES')} párrafos`)

/** El aviso de Studio y del Panel: null si no hay nada que repasar (no se enseña). */
export function textoAviso(p: Prevision): { titulo: string; detalle: string } | null {
  if (p.pendientes <= 0) return null
  const partes: string[] = []
  // Los atrasados (de días anteriores) son parte de los de repaso: se dicen entre paréntesis.
  const atr = Math.min(p.prevision.atrasados, p.repasoAhora)
  const deAntes = atr === 0 ? '' : atr === p.repasoAhora ? (atr === 1 ? ' (de un día anterior)' : ' (todos de días anteriores)') : ` (${atr.toLocaleString('es-ES')} de días anteriores)`
  if (p.repasoAhora > 0) partes.push(`${p.repasoAhora.toLocaleString('es-ES')} de repaso${deAntes}`)
  if (p.nuevos > 0) partes.push(p.nuevos === 1 ? '1 nuevo' : `${p.nuevos.toLocaleString('es-ES')} nuevos`)
  return { titulo: `Tienes ${parrafos(p.pendientes)} para repasar`, detalle: `En tus resúmenes activos: ${partes.join(' · ')}.` }
}

/** Porcentaje entero («80 %») o «—». */
export function porcentaje(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)} %`
}

/** Las cuatro cifras de la previsión, con sus etiquetas (hoy incluye lo atrasado; 7 y 30 días, acumulado). */
export function tramosPrevision(p: Prevision): { clave: 'hoy' | 'manana' | 'semana' | 'mes'; etiqueta: string; n: number; nota?: string }[] {
  return [
    { clave: 'hoy', etiqueta: 'Hoy', n: p.prevision.hoy, ...(p.prevision.atrasados ? { nota: `${p.prevision.atrasados} atrasados` } : {}) },
    { clave: 'manana', etiqueta: 'Mañana', n: p.prevision.manana },
    { clave: 'semana', etiqueta: '7 días', n: p.prevision.semana },
    { clave: 'mes', etiqueta: '30 días', n: p.prevision.mes },
  ]
}

/** «12 oct.» de una fecha YYYY-MM-DD (sin zona: es el día de Madrid que manda el servidor). */
export function diaCorto(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
