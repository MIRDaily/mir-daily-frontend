// Créditos de IA: tipos y textos (sin red, para poder probarlos con `npm test`).

import type { TarifaIA } from '@/lib/ia/precio'

export type Bolsa = {
  id: number
  tipo: 'periodo' | 'regalo' | 'prueba' | 'recarga' | 'ajuste'
  iniciales: number
  saldo: number
  caduca_at: string
  /** Hay saldo pero no se puede usar (recarga sin plan, la prueba tras pasar a un plan). */
  congelada: boolean
}

export type SaldoIA = {
  plan: 'prueba' | 'mensual' | 'anual' | 'admin' | null
  estado: 'activo' | 'impagado' | 'cancelado' | 'caducado' | null
  periodo_inicio: string | null
  periodo_fin: string | null
  creditos_periodo: number | null
  ilimitado: boolean
  puede_usar: boolean
  total: number
  bolsas: Bolsa[]
  cancelaciones_gratis_mes: number
  cancelaciones_gratis_restantes: number
  prueba_disponible: boolean
  puede_recargar: boolean
  tarifa_version?: number
}

export type Movimiento = {
  id: number
  tipo: 'alta' | 'cargo' | 'devolucion' | 'caducidad' | 'ajuste'
  creditos: number
  creado_at: string
  bolsa_tipo: string
  motivo: string | null
  usage_id: number | null
  clave: string | null
  kind: string | null
  titulo: string | null
}

export type Cobro = { creditosAnunciados: number; tarifaVersion: number; idempotencyKey: string }
export type Generacion = { cobro: Cobro | null; usageId: number | null; inicio: number; cobrados: number }

const fmt = (n: number) => n.toLocaleString('es-ES')

export const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''

/** La bolsa del mes en curso (la de periodo que caduca más tarde). */
export function bolsaDelMes(s: SaldoIA | null | undefined): Bolsa | null {
  const ps = (s?.bolsas ?? []).filter((b) => b.tipo === 'periodo')
  return ps.length ? ps.reduce((a, b) => (new Date(b.caduca_at) > new Date(a.caduca_at) ? b : a)) : null
}

/** Gastado del mes, para el aviso suave del 80 %. */
export function fraccionGastada(s: SaldoIA | null | undefined): number {
  const b = bolsaDelMes(s)
  return b && b.iniciales > 0 ? 1 - b.saldo / b.iniciales : 0
}

export function diasHasta(iso: string | null | undefined, ahora = Date.now()): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - ahora) / 86400000))
}

/** Aviso ANTES de cancelar cuando ya no quedan cancelaciones gratis (y ya salió texto). */
export function avisoAntesDeCancelar(
  g: Generacion,
  e: { saldo: SaldoIA | null; tarifa: TarifaIA | null },
  ahora = Date.now(),
): string | null {
  const restantes = e.saldo?.cancelaciones_gratis_restantes ?? 1
  const umbral = (e.tarifa?.cancelacionSinTextoSeg ?? 5) * 1000
  if (e.saldo?.ilimitado || restantes > 0 || ahora - g.inicio < umbral || g.cobrados <= 0) return null
  return `Ya has usado las ${fmt(e.saldo?.cancelaciones_gratis_mes ?? 0)} cancelaciones gratis de este mes. Si cancelas ahora se cobrará la parte ya generada (como mucho ${fmt(g.cobrados)} créditos). ¿Cancelar?`
}

/** Lo que se dice tras cancelar, con lo que respondió POST /api/ia/cancelar (o nada, si no llegó). */
export function mensajeCancelacion(
  p: { prevision: 'sin_texto' | 'gratis' | 'parcial'; creditos: number; cancelacionesGratisRestantes: number } | null,
  g: Generacion,
): string {
  const n = p?.creditos ?? g.cobrados
  if (!p) return n > 0 ? `Cancelado. Te hemos devuelto ${fmt(n)} créditos.` : 'Generación cancelada.'
  if (p.prevision === 'sin_texto') return `Cancelado antes de empezar: te hemos devuelto ${fmt(n)} créditos (no cuenta como cancelación).`
  if (p.prevision === 'gratis') {
    const r = p.cancelacionesGratisRestantes
    return `Cancelado. Te hemos devuelto ${fmt(n)} créditos · te ${r === 1 ? 'queda 1 cancelación gratis' : `quedan ${fmt(r)} cancelaciones gratis`} este mes.`
  }
  return `Cancelado. Se ha cobrado la parte ya generada (como mucho ${fmt(n)} créditos) y se devuelve el resto.`
}

/** Lo que se añade al mensaje de un error cuando el servidor devolvió los créditos. */
export function mensajeDevolucion(datos: Record<string, unknown> | null | undefined): string {
  const c = datos?.creditos as { cobrados?: number; devueltos?: number } | undefined
  if (!c || typeof c.devueltos !== 'number' || c.devueltos <= 0) return ''
  return (c.cobrados ?? 0) <= 0 ? ' No se ha cobrado nada.' : ` Te hemos devuelto ${fmt(c.devueltos)} créditos.`
}

/** Mensaje para los rechazos del cobro (402, 403, 409) o '' si no es uno de ellos. */
export function mensajeRechazo(codigo: string, datos: Record<string, unknown> | null | undefined): string {
  const d = datos ?? {}
  if (codigo === 'sin_creditos') {
    return `No te quedan créditos suficientes: hacen falta ${fmt(Number(d.necesarios) || 0)} y tienes ${fmt(Number(d.saldo) || 0)}.`
  }
  if (codigo === 'precio_cambiado') {
    return `El precio ha cambiado: ahora son ${fmt(Number(d.creditos) || 0)} créditos. Revísalo y vuelve a generar.`
  }
  if (codigo === 'sin_plan') return 'Necesitas un plan con IA para usar esta función.'
  if (codigo === 'repetida') return 'Esta generación ya se había pedido: espera a que termine.'
  return ''
}

/** Descripción de una línea del historial. */
export function describirMovimiento(m: Movimiento): string {
  const que = (k: string | null, clave: string | null) => {
    if (!k && !clave) return 'IA'
    if (clave?.startsWith('mapa')) return clave.includes('detalle') ? 'Mapa con más contenido' : 'Mapa'
    if (clave === 'rama' || k === 'rama') return 'Rama del mapa'
    if (clave === 'flashcards_mas') return 'Más flashcards'
    if (clave?.startsWith('flashcards')) return clave.endsWith(':mapa') ? 'Flashcards desde el mapa' : 'Flashcards'
    if (clave === 'resumenes_mas') return 'Más párrafos'
    if (clave === 'resumenes_rehacer') return 'Párrafo rehecho'
    if (clave?.startsWith('resumenes')) return 'Resumen activo'
    if (clave === 'indice') return 'Índice'
    return 'IA'
  }
  const titulo = m.titulo ? ` · ${m.titulo}` : ''
  if (m.tipo === 'cargo') return `${que(m.kind, m.clave)}${titulo}`
  if (m.tipo === 'devolucion') {
    const por: Record<string, string> = {
      error: 'error', conexion: 'conexión cortada', cancelacion_sin_texto: 'cancelado', cancelacion_gratis: 'cancelado',
      cancelacion_parcial: 'cancelado', temas_fallidos: 'temas que no salieron',
    }
    return `Devuelto (${por[m.motivo ?? ''] ?? 'devolución'})${titulo}`
  }
  if (m.tipo === 'caducidad') return 'Caducados'
  if (m.tipo === 'alta') {
    const tipos: Record<string, string> = { periodo: 'Renovación', regalo: 'Regalo del primer mes', prueba: 'Prueba', recarga: 'Recarga', ajuste: 'Regalo del equipo' }
    return m.bolsa_tipo === 'ajuste' && m.motivo ? `${tipos.ajuste} · ${m.motivo}` : (tipos[m.bolsa_tipo] ?? 'Alta')
  }
  return m.motivo ? `Ajuste · ${m.motivo}` : 'Ajuste'
}
