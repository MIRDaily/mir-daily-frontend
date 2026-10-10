// Resúmenes activos: GET /api/resumenes/prevision (todos los grupos) y /:id/prevision (uno). Aparte de
// api.ts para no tocar lo que comparte con la vista previa y la gestión de grupos; lo puro, en prevision.ts.

import { supabase } from '@/lib/supabaseBrowser'
import { sanearPrevision, type Prevision } from '@/lib/resumenes/prevision'

/** La previsión de todos los grupos (sin `grupoId`) o de uno. null si no hay sesión. */
export async function cargarPrevision(grupoId?: string): Promise<Prevision | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  const ruta = grupoId ? `/${encodeURIComponent(grupoId)}/prevision` : '/prevision'
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/resumenes${ruta}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) throw new Error(typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo cargar la previsión')
  return sanearPrevision(cuerpo?.prevision)
}
