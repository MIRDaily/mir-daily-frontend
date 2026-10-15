import { supabase } from '@/lib/supabaseBrowser'
import { AdminError } from '@/lib/admin/reports'
import type { Movimiento, SaldoIA } from '@/lib/ia/creditosTexto'

// Panel mínimo de créditos de IA: llamadas a /api/admin/ia. El permiso (solo admins) lo valida el
// backend en cada petición; funciona también con los créditos apagados (para preparar los planes).

export type UsuarioIA = {
  user_id: string
  email: string
  display_name: string | null
  role: string | null
  plan: SaldoIA['plan']
  estado: SaldoIA['estado']
  periodo_fin: string | null
  ilimitado: boolean | null
  creditos_periodo: number | null
  saldo: number
  creditos_mes: number
  usd_mes: number | string
  generaciones_mes: number
  errores_mes: number
  cancelaciones_mes: number
}

export type UsoIA = {
  id: number
  created_at: string
  kind: string
  clave: string | null
  modo: string | null
  titulo: string | null
  status: 'reserved' | 'ok' | 'error'
  chars: number
  creditos: number | null
  creditos_devueltos: number
  cost_usd: number | string | null
  est_usd: number | string
  error_code: string | null
  cancelado_por: string | null
  ms: number | null
}

export type PlanManual = 'prueba' | 'mensual' | 'anual' | 'admin'

async function llamar<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new AdminError('Inicia sesión', 401)
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/ia${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminError(body?.error || 'Error del servidor', res.status)
  return body as T
}

const post = <T,>(path: string, cuerpo: unknown) => llamar<T>(path, { method: 'POST', body: JSON.stringify(cuerpo) })

export const creditosAdmin = {
  usuarios: (buscar = '') => llamar<{ usuarios: UsuarioIA[] }>(`/usuarios${buscar ? `?buscar=${encodeURIComponent(buscar)}` : ''}`).then((r) => r.usuarios),
  usuario: (id: string) => llamar<{ usuario: UsuarioIA; saldo: SaldoIA; uso: UsoIA[]; movimientos: Movimiento[] }>(`/usuarios/${id}`),
  movimientos: (id: string, antes: number) => llamar<{ movimientos: Movimiento[]; siguiente: number | null }>(`/usuarios/${id}/movimientos?antes=${antes}`),
  uso: (id: string, antes: number) => llamar<{ uso: UsoIA[]; siguiente: number | null }>(`/usuarios/${id}/uso?antes=${antes}`),
  conceder: (id: string, creditos: number, motivo: string, dias: number) => post<{ ok: true }>(`/usuarios/${id}/conceder`, { creditos, motivo, dias }),
  plan: (id: string, plan: PlanManual, creditosPeriodo?: number | null) =>
    post<{ ok: true }>(`/usuarios/${id}/plan`, { plan, ...(creditosPeriodo !== undefined && creditosPeriodo !== null ? { creditosPeriodo } : {}) }),
  estado: (id: string, estado: 'activo' | 'cancelado') => post<{ ok: true }>(`/usuarios/${id}/estado`, { estado }),
}
