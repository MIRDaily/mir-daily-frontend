import { supabase } from '@/lib/supabaseBrowser'
import { IAError } from '@/lib/mapas/ia/types'
import type { TarifaIA } from '@/lib/ia/precio'
import {
  avisoAntesDeCancelar,
  mensajeCancelacion,
  mensajeDevolucion,
  mensajeRechazo,
  type Cobro,
  type Generacion,
  type Movimiento,
  type SaldoIA,
} from '@/lib/ia/creditosTexto'

export type { Bolsa, Cobro, Generacion, Movimiento, SaldoIA } from '@/lib/ia/creditosTexto'

// Créditos de IA del usuario (GET /api/ia/saldo, /tarifa, /movimientos y POST /cancelar). Con el
// interruptor del servidor apagado, /api/ia responde 503 `apagado`: entonces `activo` es false y los
// diálogos siguen enseñando el cupo de hoy, como siempre. Nada de esto es la protección: el servidor
// calcula el precio y valida plan y saldo en cada generación.

async function pedir(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new IAError('Inicia sesión para usar la IA', 401)
  let res: Response
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ia${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new IAError('No se pudo conectar con el servidor')
  }
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) {
    throw new IAError(typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo completar la operación', res.status, typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : '', cuerpo)
  }
  return cuerpo
}

export const iaSaldo = async (): Promise<SaldoIA> => (await pedir('/saldo')) as SaldoIA
export const iaTarifa = async (): Promise<TarifaIA> => (await pedir('/tarifa')) as TarifaIA
export async function iaMovimientos(antes?: number | null): Promise<{ movimientos: Movimiento[]; siguiente: number | null }> {
  const r = await pedir(`/movimientos?limite=30${antes ? `&antes=${antes}` : ''}`)
  return { movimientos: Array.isArray(r?.movimientos) ? r.movimientos : [], siguiente: typeof r?.siguiente === 'number' ? r.siguiente : null }
}
export async function iaCancelar(usageId: number): Promise<{ prevision: 'sin_texto' | 'gratis' | 'parcial'; creditos: number; cancelacionesGratisRestantes: number }> {
  return pedir(`/cancelar/${usageId}`, { method: 'POST', body: '{}' })
}

// --- Almacén compartido (saldo + tarifa), un solo pedido para todos los diálogos ---------------------

export type EstadoCreditos = {
  /** Ya se sabe si los créditos están encendidos. */
  cargado: boolean
  /** Encendidos en el servidor: se cobra en créditos (si no, cupos diarios). */
  activo: boolean
  saldo: SaldoIA | null
  tarifa: TarifaIA | null
}

let estado: EstadoCreditos = { cargado: false, activo: false, saldo: null, tarifa: null }
const oyentes = new Set<() => void>()
let enCurso: Promise<void> | null = null

const avisar = () => oyentes.forEach((f) => f())
export const suscribirCreditos = (f: () => void) => {
  oyentes.add(f)
  return () => oyentes.delete(f)
}
export const estadoCreditos = () => estado
const INICIAL: EstadoCreditos = { cargado: false, activo: false, saldo: null, tarifa: null }
export const estadoCreditosServidor = () => INICIAL

/** Vuelve a pedir saldo y tarifa (tras cada generación, cancelación o error). */
export function refrescarCreditos(): Promise<void> {
  if (enCurso) return enCurso
  enCurso = (async () => {
    try {
      const [tarifa, saldo] = await Promise.all([iaTarifa(), iaSaldo()])
      estado = { cargado: true, activo: true, saldo, tarifa }
    } catch (e) {
      // 503 `apagado` (o sin sesión): sin créditos, los diálogos enseñan el cupo de siempre.
      if (e instanceof IAError && (e.codigo === 'apagado' || e.status === 401 || e.status === 404)) estado = { ...INICIAL, cargado: true }
      else estado = { ...estado, cargado: true }
    } finally {
      enCurso = null
      avisar()
    }
  })()
  return enCurso
}

/** Primera carga, si nadie la ha pedido todavía. */
export function asegurarCreditos() {
  if (!estado.cargado && !enCurso) void refrescarCreditos()
}

// --- Una generación: cobro anunciado, id de la reserva y cancelación ----------------------------------

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })

/** Lo que viaja en el cuerpo de cada generación (nada, si los créditos están apagados). */
export function nuevoCobro(precio: number | null, e: EstadoCreditos = estado): Cobro | null {
  if (!e.activo || !e.tarifa || precio === null) return null
  return { creditosAnunciados: precio, tarifaVersion: e.tarifa.version, idempotencyKey: uuid() }
}

/** Un clic en «Generar»: su cobro y, cuando llega el evento «reserva», el id para cancelar. */
export function nuevaGeneracion(precio: number | null): Generacion {
  const cobro = nuevoCobro(precio)
  return { cobro, usageId: null, inicio: Date.now(), cobrados: cobro?.creditosAnunciados ?? 0 }
}

/** Para el `onEvento` del streaming: guarda el id de la reserva. */
export function anotarReserva(g: Generacion | null, e: { tipo: string; usageId?: number; creditos?: { cobrados?: number } }) {
  if (!g || e.tipo !== 'reserva' || typeof e.usageId !== 'number') return
  g.usageId = e.usageId
  if (typeof e.creditos?.cobrados === 'number') g.cobrados = e.creditos.cobrados
}

/**
 * «Cancelar»: avisa al servidor ANTES de cortar (así cuenta como cancelación del usuario y no como
 * corte de conexión), corta y devuelve el mensaje para el diálogo. `cancelado: false` si el usuario se
 * arrepiente en el aviso (ya no le quedan cancelaciones gratis y se cobraría la parte generada).
 * Sin créditos, solo corta (`mensaje: null`: el diálogo dice lo de siempre).
 */
export async function cancelarGeneracion(g: Generacion | null, cortar: () => void): Promise<{ cancelado: boolean; mensaje: string | null }> {
  if (!g?.cobro || !estado.activo) {
    cortar()
    return { cancelado: true, mensaje: null }
  }
  const aviso = avisoAntesDeCancelar(g, estado)
  if (aviso && typeof window !== 'undefined' && !window.confirm(aviso)) return { cancelado: false, mensaje: null }
  let prevision: Awaited<ReturnType<typeof iaCancelar>> | null = null
  if (g.usageId !== null) prevision = await iaCancelar(g.usageId).catch(() => null)
  cortar()
  // La liquidación llega al servidor un instante después del corte.
  setTimeout(() => void refrescarCreditos(), 1500)
  return { cancelado: true, mensaje: mensajeCancelacion(prevision, g) }
}

/** Mensaje de un error de generación: el del servidor, más lo devuelto o el motivo del rechazo. */
export function mensajeErrorIA(e: unknown, porDefecto: string): string {
  if (!(e instanceof IAError)) return e instanceof Error ? e.message : porDefecto
  const rechazo = mensajeRechazo(e.codigo, e.datos)
  if (rechazo) return rechazo
  return `${e.message}${mensajeDevolucion(e.datos)}`
}
