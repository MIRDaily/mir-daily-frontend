import { supabase } from '@/lib/supabaseBrowser'
import { docNodeCount, newGraphDoc, type StoredDoc } from '@/lib/mapas/graph'

// Acceso a `public.mind_maps` (sql/2026-09-mapas-mentales.sql). Directo con el
// cliente de Supabase: RLS deja a cada usuario solo lo suyo.
//
// `doc` se devuelve SIN interpretar: puede ser un grafo (versión 2, lo que guarda
// el editor) o un árbol (versión 1, lo que se importa o generará la IA). El
// editor lo normaliza al abrirlo con `toGraphDoc`.

export type MapSummary = {
  id: string
  title: string
  subject: string | null
  updated_at: string
  nodeCount: number
}

export type MapRecord = {
  id: string
  title: string
  subject: string | null
  updated_at: string
  doc: unknown
}

export async function listMaps(): Promise<MapSummary[]> {
  const { data, error } = await supabase
    .from('mind_maps')
    .select('id,title,subject,updated_at,doc')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    subject: (row.subject as string | null) ?? null,
    updated_at: row.updated_at as string,
    nodeCount: docNodeCount(row.doc),
  }))
}

export async function getMap(id: string): Promise<MapRecord | null> {
  const { data, error } = await supabase
    .from('mind_maps')
    .select('id,title,subject,updated_at,doc')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    title: data.title as string,
    subject: (data.subject as string | null) ?? null,
    updated_at: data.updated_at as string,
    doc: data.doc as unknown,
  }
}

export async function createMap(title = 'Mapa sin título', doc?: StoredDoc): Promise<string> {
  const { data, error } = await supabase
    .from('mind_maps')
    .insert({ title, doc: doc ?? newGraphDoc(title === 'Mapa sin título' ? 'Tema principal' : title) })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function saveMap(id: string, patch: { title?: string; subject?: string | null; doc?: StoredDoc }) {
  const { error } = await supabase.from('mind_maps').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Papelera ─────────────────────────────────────────────────────────────────
// Borrar es lógico (`deleted_at`). Un mapa borrado se puede recuperar durante 24 horas; pasado ese
// plazo desaparece del todo (se purga al abrir la lista o la papelera: no hay tarea programada).

export const TRASH_HOURS = 24
const TRASH_MS = TRASH_HOURS * 60 * 60 * 1000

export type TrashedMap = {
  id: string
  title: string
  deleted_at: string
  /** Cuándo se pierde para siempre. */
  purge_at: string
  nodeCount: number
}

export async function deleteMap(id: string) {
  const { error } = await supabase
    .from('mind_maps')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Deshace un borrado (o recupera desde la papelera). */
export async function restoreMap(id: string) {
  const { error } = await supabase.from('mind_maps').update({ deleted_at: null }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Elimina del todo los mapas que llevan más de 24 h en la papelera. Silencioso: no es crítico. */
export async function purgeExpiredMaps() {
  const cutoff = new Date(Date.now() - TRASH_MS).toISOString()
  await supabase.from('mind_maps').delete().not('deleted_at', 'is', null).lt('deleted_at', cutoff)
}

export async function listTrashedMaps(): Promise<TrashedMap[]> {
  const cutoff = new Date(Date.now() - TRASH_MS).toISOString()
  const { data, error } = await supabase
    .from('mind_maps')
    .select('id,title,deleted_at,doc')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const deleted = row.deleted_at as string
    return {
      id: row.id as string,
      title: row.title as string,
      deleted_at: deleted,
      purge_at: new Date(Date.parse(deleted) + TRASH_MS).toISOString(),
      nodeCount: docNodeCount(row.doc),
    }
  })
}
