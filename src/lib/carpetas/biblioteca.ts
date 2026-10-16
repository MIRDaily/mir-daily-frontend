// Biblioteca sobre las carpetas (fase 2): la parte pura, sin red ni React. Los datos vienen de
// GET /api/carpetas/{recuento,sin-clasificar,asignatura/:id} (lib/carpetas/api.ts) y del árbol del catálogo.
// Especificación: «ESPECIFICACION - Carpetas del material de IA (2026-10-16).md», §3.3, §6 y §7.1.

import { sugerirCarpeta, textosDocumento, type AsignaturaCatalogo, type Carpeta } from '@/lib/carpetas/sugerir'

export type TipoElemento = 'mapa' | 'flashcards' | 'resumenes'
export type Cuenta = { total: number; mapas: number; flashcards: number; resumenes: number }
export type RecuentoAsignatura = Cuenta & { id: number; general: Cuenta; temas: (Cuenta & { id: number })[] }
export type Recuento = { total: number; sinClasificar: Cuenta; asignaturas: RecuentoAsignatura[] }

export type ElementoMaterial = {
  tipo: TipoElemento
  id: string
  titulo: string
  actualizado: string | null
  carpeta: Carpeta
  /** Tarjetas o párrafos del grupo; null en un mapa. */
  elementos: number | null
  /** Solo en «Sin clasificar»: con qué textos se sugiere la carpeta. */
  textos?: { descripcion: string | null; etiquetas: string[]; fuentes: string[] }
}

export const CUENTA_VACIA: Cuenta = { total: 0, mapas: 0, flashcards: 0, resumenes: 0 }

const CLAVE: Record<TipoElemento, keyof Omit<Cuenta, 'total'>> = { mapa: 'mapas', flashcards: 'flashcards', resumenes: 'resumenes' }

export function cuentaDe(elementos: ElementoMaterial[]): Cuenta {
  const c = { ...CUENTA_VACIA }
  for (const e of elementos) {
    c.total += 1
    c[CLAVE[e.tipo]] += 1
  }
  return c
}

/** «2 mapas · 1 grupo de flashcards · 3 grupos de resúmenes». Vacío si no hay nada. */
export function textoCuenta(c: Cuenta): string {
  const partes: string[] = []
  if (c.mapas) partes.push(`${c.mapas} ${c.mapas === 1 ? 'mapa' : 'mapas'}`)
  const grupos = (n: number, de: string) => `${n} ${n === 1 ? 'grupo' : 'grupos'} de ${de}`
  if (c.flashcards) partes.push(grupos(c.flashcards, 'flashcards'))
  if (c.resumenes) partes.push(grupos(c.resumenes, 'resúmenes'))
  return partes.join(' · ')
}

export type TarjetaAsignatura = {
  asignatura: AsignaturaCatalogo
  cuenta: Cuenta
  /** Temas con material (sin contar «General»). */
  temasConMaterial: number
  tieneGeneral: boolean
}

/** La portada: TODAS las asignaturas visibles, en el orden del catálogo, con lo que el usuario tiene en cada una. */
export function tarjetasAsignaturas(arbol: AsignaturaCatalogo[], recuento: Recuento | null): TarjetaAsignatura[] {
  const porId = new Map((recuento?.asignaturas ?? []).map((a) => [a.id, a]))
  return arbol.map((asignatura) => {
    const r = porId.get(asignatura.id)
    return {
      asignatura,
      cuenta: r ? { total: r.total, mapas: r.mapas, flashcards: r.flashcards, resumenes: r.resumenes } : { ...CUENTA_VACIA },
      temasConMaterial: r?.temas.filter((t) => t.total > 0).length ?? 0,
      tieneGeneral: (r?.general.total ?? 0) > 0,
    }
  })
}

export type CarpetaBiblioteca = {
  /** null = «General» de la asignatura. */
  topicId: number | null
  nombre: string
  elementos: ElementoMaterial[]
  cuenta: Cuenta
}

/**
 * Las carpetas que se enseñan de una asignatura (§3.3): «General» primero y después los temas, en el
 * orden del catálogo, pero SOLO los que tienen material. Un tema que ya no está en el catálogo cuenta
 * como «General» (el servidor ya lo manda así; aquí se repite por si el árbol del navegador es más viejo).
 */
export function carpetasDeAsignatura(asig: AsignaturaCatalogo, elementos: ElementoMaterial[]): CarpetaBiblioteca[] {
  const temas = new Set(asig.temas.map((t) => t.id))
  const porTema = new Map<number | null, ElementoMaterial[]>()
  for (const e of elementos) {
    if (e.carpeta.subjectId !== asig.id) continue
    const t = e.carpeta.topicId !== null && temas.has(e.carpeta.topicId) ? e.carpeta.topicId : null
    if (!porTema.has(t)) porTema.set(t, [])
    porTema.get(t)!.push(e)
  }
  const out: CarpetaBiblioteca[] = []
  const general = porTema.get(null)
  if (general) out.push({ topicId: null, nombre: 'General', elementos: general, cuenta: cuentaDe(general) })
  for (const t of asig.temas) {
    const lista = porTema.get(t.id)
    if (lista) out.push({ topicId: t.id, nombre: t.nombre, elementos: lista, cuenta: cuentaDe(lista) })
  }
  return out
}

/** El segmento de la URL de una carpeta: el id del tema o «general». */
export const segmentoCarpeta = (topicId: number | null) => (topicId === null ? 'general' : String(topicId))
export const rutaCarpeta = (subjectId: number, topicId: number | null) => `/library/${subjectId}/${segmentoCarpeta(topicId)}`

/** Del segmento de la URL a la carpeta: `undefined` si no es un tema de esa asignatura. */
export function carpetaDeSegmento(asig: AsignaturaCatalogo, segmento: string): { topicId: number | null; nombre: string } | undefined {
  if (segmento === 'general') return { topicId: null, nombre: 'General' }
  if (!/^\d+$/.test(segmento)) return undefined
  const t = asig.temas.find((x) => x.id === Number(segmento))
  return t ? { topicId: t.id, nombre: t.nombre } : undefined
}

/** Dónde se abre y dónde se estudia cada cosa (las mismas URL que usan sus pantallas). */
export function rutasElemento(e: Pick<ElementoMaterial, 'tipo' | 'id' | 'elementos'>): { abrir: string; estudiar: string | null } {
  if (e.tipo === 'mapa') return { abrir: `/mapas/${e.id}`, estudiar: null }
  const vacio = !e.elementos
  if (e.tipo === 'flashcards') return { abrir: `/flashcards/${e.id}`, estudiar: vacio ? null : `/flashcards/${e.id}?study=1` }
  return { abrir: `/resumenes/${e.id}`, estudiar: vacio ? null : `/resumenes/${e.id}?estudiar=1` }
}

/**
 * La carpeta que se propone para algo sin clasificar (§6), con el mismo emparejador que al crear: su
 * título, su descripción, los temas de sus tarjetas o párrafos y el documento del que salieron.
 * null si no hay nada claro. Nunca se aplica sola: es el atajo «¿A …?».
 */
export function sugerenciaDe(arbol: AsignaturaCatalogo[], e: ElementoMaterial): Carpeta | null {
  const t = e.textos
  const textos = textosDocumento(e.titulo, [t?.descripcion ?? null], t?.etiquetas ?? [], t?.fuentes ?? [])
  const s = sugerirCarpeta(arbol, textos)
  return s.carpeta.subjectId === null ? null : s.carpeta
}

/** Para mover una selección mezclada: el servidor mueve un tipo cada vez (todo o nada en cada uno). */
export function agruparPorTipo(seleccion: Pick<ElementoMaterial, 'tipo' | 'id'>[]): [TipoElemento, string[]][] {
  const m = new Map<TipoElemento, string[]>()
  for (const e of seleccion) {
    if (!m.has(e.tipo)) m.set(e.tipo, [])
    m.get(e.tipo)!.push(e.id)
  }
  return [...m.entries()]
}

/**
 * Las URL de la maqueta usaban ids de texto (/library/cardiologia). Se redirigen a la asignatura del
 * catálogo en la que quedaron (tabla de §3.1 de la especificación); «Repasos MIR» no existe: a /library.
 */
export const ASIGNATURA_DE_SLUG: Readonly<Record<string, number | null>> = {
  'repasos-mir': null,
  bioestadistica: 816,
  bioetica: 1224,
  cardiologia: 2,
  'cirugia-general': 3,
  trauma: 4,
  'cirugia-plastica': 3,
  dermatologia: 1425,
  endocrino: 6,
  farmacologia: 1224,
  ginecologia: 4342,
  hematologia: 591,
  inmunologia: 4344,
  nefrologia: 670,
  neurologia: 1478,
  pediatria: 5,
  reumatologia: 3080,
}

/** Id numérico de la URL (/library/207) o null si no lo es. */
export function idDeSegmento(segmento: string): number | null {
  return /^[1-9]\d{0,9}$/.test(segmento) ? Number(segmento) : null
}
