import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import type { AsignaturaCatalogo, Carpeta } from '@/lib/carpetas/sugerir'
import type { ElementoMaterial, Recuento } from '@/lib/carpetas/biblioteca'

// Carpetas del material: el árbol del catálogo (GET /api/carpetas/arbol) y mover mapas o grupos
// (PATCH /api/carpetas). El servidor valida dueño, asignatura y tema; aquí solo se pide y se pinta.

export type TipoMaterial = 'mapa' | 'flashcards' | 'resumenes'

async function pedir(init: RequestInit & { ruta?: string } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Inicia sesión')
  const { ruta = '', ...resto } = init
  let res: Response
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/carpetas${ruta}`, {
      ...resto,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor')
  }
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) throw new Error(typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo completar la operación')
  return cuerpo
}

// El catálogo es igual para todos y cambia muy poco: un pedido por pestaña, compartido.
let arbol: AsignaturaCatalogo[] | null = null
let enCurso: Promise<AsignaturaCatalogo[]> | null = null

export function cargarArbol(): Promise<AsignaturaCatalogo[]> {
  if (arbol) return Promise.resolve(arbol)
  enCurso ??= pedir({ ruta: '/arbol' })
    .then((r) => {
      arbol = Array.isArray(r?.asignaturas) ? (r.asignaturas as AsignaturaCatalogo[]) : []
      return arbol
    })
    .finally(() => {
      enCurso = null
    })
  return enCurso
}

/** El árbol para pintar: null mientras llega (o si no se pudo pedir: entonces no se ofrece carpeta). */
export function useArbolCarpetas(activo = true): AsignaturaCatalogo[] | null {
  const [valor, setValor] = useState<AsignaturaCatalogo[] | null>(arbol)
  useEffect(() => {
    if (!activo || valor) return
    let vivo = true
    cargarArbol()
      .then((a) => vivo && setValor(a))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [activo, valor])
  return valor
}

/** Mueve mapas o grupos a una carpeta. `origen` 'sugerencia' si se aceptó la propuesta sin cambiarla. */
export async function moverACarpeta(tipo: TipoMaterial, ids: string[], carpeta: Carpeta, origen: 'usuario' | 'sugerencia' = 'usuario'): Promise<number> {
  if (ids.length === 0) return 0
  const r = await pedir({ method: 'PATCH', body: JSON.stringify({ tipo, ids, subjectId: carpeta.subjectId, topicId: carpeta.topicId, origen }) })
  return typeof r?.movidos === 'number' ? r.movidos : 0
}

/** La carpeta de una fila de la base (folder_subject_id / folder_topic_id). */
export const carpetaDeFila = (f: { folder_subject_id?: number | null; folder_topic_id?: number | null }): Carpeta => ({
  subjectId: f.folder_subject_id ?? null,
  topicId: f.folder_subject_id == null ? null : (f.folder_topic_id ?? null),
})

// ---- Biblioteca (fase 2): lo del usuario, sin caché (cambia al mover) -------------------------------

/** Cuánto material hay en cada carpeta y en «Sin clasificar». */
export async function cargarRecuento(): Promise<Recuento> {
  return (await pedir({ ruta: '/recuento' })) as Recuento
}

/** Lo que no tiene carpeta, con los textos para sugerirla. */
export async function cargarSinClasificar(): Promise<ElementoMaterial[]> {
  const r = await pedir({ ruta: '/sin-clasificar' })
  return Array.isArray(r?.elementos) ? (r.elementos as ElementoMaterial[]) : []
}

export type DatosAsignatura = {
  asignatura: AsignaturaCatalogo
  /** Preguntas MIR del catálogo: en total y por tema (id → cuántas). */
  preguntas: { total: number; porTema: Record<string, number> }
  elementos: ElementoMaterial[]
}

/** El material del usuario en una asignatura y sus preguntas MIR por tema. */
export async function cargarAsignatura(id: number): Promise<DatosAsignatura> {
  return (await pedir({ ruta: `/asignatura/${id}` })) as DatosAsignatura
}
