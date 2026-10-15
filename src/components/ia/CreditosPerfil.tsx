'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { SectionLabel, StickerCard, INK } from '@/components/ui/sticker'
import { MonedaIA } from '@/components/ia/MonedaIA'
import { CifraIA } from '@/components/ia/PrecioIA'
import { useCreditosIA } from '@/hooks/useCreditosIA'
import { iaMovimientos, type Movimiento } from '@/lib/ia/creditos'
import { bolsaDelMes, describirMovimiento, diasHasta, fechaCorta, type Bolsa } from '@/lib/ia/creditosTexto'
import { claveFlashcards, claveMapa, claveResumenes, precioIA } from '@/lib/ia/precio'

// «Créditos de IA» (perfil): la barra del mes, las demás bolsas con su caducidad, las cancelaciones
// gratis, qué gasta y qué no, y el historial (paginado por id: nunca se piden más de 30 de golpe).
// La textura es la de un talonario de vales: renglones finos y una línea troquelada.

const ACCENT = '#E8A598'
const fmt = (n: number) => n.toLocaleString('es-ES')

const talonario: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage: [
    // Troquel: una columna de puntos a la izquierda.
    'radial-gradient(circle at 0.9rem 50%, #FAF7F4 0.22rem, transparent 0.24rem)',
    // Renglones del vale.
    'repeating-linear-gradient(0deg, rgba(232,165,152,0.10) 0 1px, transparent 1px 1.4rem)',
    'linear-gradient(135deg, #ffffff 0%, #FFFBF8 60%, #FFF3EE 100%)',
  ].join(','),
  backgroundSize: '1.8rem 0.9rem, auto, auto',
  backgroundRepeat: 'repeat-y, repeat, no-repeat',
}

const NOMBRE_PLAN: Record<string, string> = { prueba: 'Prueba', mensual: 'Mensual', anual: 'Anual', admin: 'Equipo (sin límite)' }
const NOMBRE_BOLSA: Record<Bolsa['tipo'], string> = { periodo: 'Del mes', regalo: 'Regalo del primer mes', prueba: 'Prueba', recarga: 'Recarga', ajuste: 'Regalo del equipo' }

function Icono({ nombre, color = ACCENT, tam = '1.15rem' }: { nombre: string; color?: string; tam?: string }) {
  return (
    <span aria-hidden className="inline-block shrink-0 leading-none" style={{ color }}>
      <span className="material-symbols-outlined leading-none" style={{ fontSize: tam }}>
        {nombre}
      </span>
    </span>
  )
}

export default function CreditosPerfil() {
  const { cargado, activo, saldo, tarifa, refrescar } = useCreditosIA()
  const [movs, setMovs] = useState<Movimiento[] | null>(null)
  const [siguiente, setSiguiente] = useState<number | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (antes: number | null) => {
    setCargando(true)
    try {
      const r = await iaMovimientos(antes)
      setMovs((m) => (antes && m ? [...m, ...r.movimientos] : r.movimientos))
      setSiguiente(r.siguiente)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void refrescar()
  }, [refrescar])
  useEffect(() => {
    if (activo) void cargar(null)
  }, [activo, cargar])

  if (!cargado) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-48 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
        <div className="h-64 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
      </div>
    )
  }

  if (!activo || !saldo) {
    return (
      <StickerCard className="p-6" style={talonario}>
        <h1 className="text-[1.6rem] font-black text-[#2C3E50]">Créditos de IA</h1>
        <p className="mt-2 text-[0.95rem] text-[#7D8A96]">
          Los créditos todavía no están activados. Mientras tanto, las funciones de IA tienen un límite diario, que ves en cada diálogo.
        </p>
      </StickerCard>
    )
  }

  const mes = bolsaDelMes(saldo)
  const otras = saldo.bolsas.filter((b) => b.tipo !== 'periodo' && b.saldo > 0)
  const llenado = mes && mes.iniciales > 0 ? Math.min(1, mes.saldo / mes.iniciales) : 0
  const ejemplo = (clave: string, caracteres: number, densidad?: string) => precioIA(tarifa, { clave, caracteres, ...(densidad ? { densidad } : {}) })
  const fijo = (clave: string) => precioIA(tarifa, { clave })

  return (
    <div className="space-y-7">
      <StickerCard className="relative overflow-hidden p-6 sm:p-8" depth={7} style={talonario}>
        <div className="flex flex-wrap items-start justify-between gap-4 pl-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[#C4655A]">
              <MonedaIA tam="1rem" />
              Créditos de IA
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-[2rem] font-black leading-tight text-[#2C3E50] sm:text-[2.4rem]">
              <MonedaIA tam="3rem" titulo="Créditos de IA" />
              {saldo.ilimitado ? 'Sin límite' : (
                <span>
                  <CifraIA valor={saldo.total} /> créditos
                </span>
              )}
            </h1>
            <p className="mt-1 text-[0.95rem] text-[#7D8A96]">
              {saldo.plan ? `Plan ${NOMBRE_PLAN[saldo.plan] ?? saldo.plan}` : 'Sin plan'}
              {saldo.estado && saldo.estado !== 'activo' ? ` · ${saldo.estado}` : ''}
              {saldo.plan === 'prueba' && saldo.puede_usar ? ` · quedan ${diasHasta(saldo.periodo_fin)} días` : ''}
            </p>
          </div>
          <span
            className="rounded-2xl px-3 py-1.5 text-[0.8rem] font-black"
            style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}`, background: saldo.puede_usar ? '#EAF3E8' : '#FAEAED', color: saldo.puede_usar ? '#3F6E3C' : '#B04A5E' }}
          >
            {saldo.puede_usar ? 'Activo' : 'Sin plan activo'}
          </span>
        </div>

        {mes && !saldo.ilimitado && (
          <div className="mt-6 pl-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-[0.9rem]">
              <span className="font-extrabold text-[#2C3E50]">
                {fmt(mes.saldo)} de {fmt(mes.iniciales)}
              </span>
              <span className="text-[#7D8A96]">se renuevan el {fechaCorta(mes.caduca_at)} (no se acumulan)</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#F3ECE8]" style={{ border: `2px solid ${INK}` }} role="meter" aria-valuemin={0} aria-valuemax={mes.iniciales} aria-valuenow={mes.saldo} aria-label="Créditos del mes">
              <div className="h-full rounded-full" style={{ width: `${Math.round(llenado * 100)}%`, background: llenado < 0.2 ? '#D4667A' : ACCENT }} />
            </div>
          </div>
        )}

        {otras.length > 0 && (
          <ul className="mt-4 space-y-1.5 pl-4">
            {otras.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-2 text-[0.88rem]">
                <Icono nombre={b.tipo === 'recarga' ? 'savings' : b.tipo === 'prueba' ? 'hourglass_top' : 'redeem'} />
                <span className="font-extrabold text-[#2C3E50]">
                  {fmt(b.saldo)} · {NOMBRE_BOLSA[b.tipo]}
                </span>
                <span className="text-[#7D8A96]">
                  caducan el {fechaCorta(b.caduca_at)}
                  {b.congelada ? ' · congelados: necesitas un plan activo para usarlos' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 pl-4 text-[0.85rem] text-[#7D8A96]">
          {saldo.ilimitado
            ? 'Tu cuenta no descuenta créditos: cada generación se apunta para medir el consumo.'
            : `Cancelaciones gratis este mes: te quedan ${fmt(saldo.cancelaciones_gratis_restantes)} de ${fmt(saldo.cancelaciones_gratis_mes)}. Si cancelas en los primeros segundos, o se corta la conexión, no cuenta.`}
        </p>
      </StickerCard>

      <section>
        <SectionLabel>Qué gasta y qué no</SectionLabel>
        <StickerCard className="p-5 sm:p-6" depth={4}>
          <p className="text-[0.92rem] font-bold text-[#2C3E50]">Estudiar, repasar y editar es gratis. Solo gasta generar con la IA, y siempre ves el precio antes.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ['Mapa esquemático de un tema mediano', ejemplo(claveMapa('esquema', false), 25000)],
              ['Mapa con tablas de un tema grande', ejemplo(claveMapa('esquema', true), 84000)],
              ['Flashcards de un tema mediano', ejemplo(claveFlashcards('documento'), 25000, 'normal')],
              ['Resumen activo de un tema mediano', ejemplo(claveResumenes('resumen'), 25000, 'normal')],
              ['Rehacer o ampliar una rama del mapa', fijo('rama')],
              ['«Más» flashcards de un tema', fijo('flashcards_mas')],
              ['«Más» párrafos de un tema', fijo('resumenes_mas')],
              ['Rehacer un párrafo', fijo('resumenes_rehacer')],
              ['Sacar el índice de un libro', fijo('indice')],
            ].map(([texto, n]) => (
              <div key={String(texto)} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF7F4] px-3 py-2 text-[0.85rem]">
                <span className="text-[#2C3E50]">{texto}</span>
                <span className="shrink-0 font-black text-[#C4655A]">{n === null ? '—' : n === 0 ? 'gratis' : `${fmt(Number(n))}`}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.78rem] text-[#7D8A96]">
            Precios orientativos (25.000 caracteres son unas 8 páginas de apuntes). Si la IA falla, se devuelve todo automáticamente.
          </p>
        </StickerCard>
      </section>

      <section>
        <SectionLabel>Historial</SectionLabel>
        <StickerCard className="p-2 sm:p-3" depth={4}>
          {error && <p className="px-3 py-2 text-[0.85rem] font-bold text-[#B04A5E]">{error}</p>}
          {movs === null ? (
            <p className="px-3 py-4 text-[0.88rem] text-[#7D8A96]">Cargando…</p>
          ) : movs.length === 0 ? (
            <p className="px-3 py-4 text-[0.88rem] text-[#7D8A96]">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-[#F0E9E5]">
              {movs.map((m) => (
                <li key={`${m.id}-${m.tipo}`} className="flex items-center gap-3 px-3 py-2.5" data-movimiento={m.tipo}>
                  <Icono
                    nombre={m.tipo === 'cargo' ? 'auto_awesome' : m.tipo === 'devolucion' ? 'undo' : m.tipo === 'caducidad' ? 'event_busy' : 'add_circle'}
                    color={m.creditos < 0 ? '#C4655A' : '#5E8C5A'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.88rem] font-bold text-[#2C3E50]">{describirMovimiento(m)}</span>
                    <span className="block text-[0.75rem] text-[#7D8A96]">
                      {new Date(m.creado_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[0.95rem] font-black tabular-nums" style={{ color: m.creditos < 0 ? '#C4655A' : '#5E8C5A' }}>
                    {m.creditos > 0 ? '+' : '−'}
                    {fmt(Math.abs(m.creditos))}
                    <MonedaIA tam="1rem" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {siguiente !== null && (
            <div className="flex justify-center p-2">
              <button
                type="button"
                disabled={cargando}
                onClick={() => void cargar(siguiente)}
                className="rounded-2xl bg-white px-4 py-2 text-[0.85rem] font-bold text-[#2C3E50] disabled:opacity-60"
                style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
              >
                {cargando ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}
        </StickerCard>
      </section>

      <p className="text-center text-[0.8rem] text-[#7D8A96]">
        <Link href="/profile" className="font-bold underline">Volver al perfil</Link>
      </p>
    </div>
  )
}
