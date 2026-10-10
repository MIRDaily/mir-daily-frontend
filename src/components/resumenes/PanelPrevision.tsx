'use client'

// Previsión y estadísticas de los resúmenes activos (como el panel de las flashcards): cuántos párrafos
// vencen hoy, mañana y en 7 y 30 días (y por día), cómo están (nuevos, fallados, aprendiendo,
// dominados), la retención, el acierto por hueco y los huecos que más se resisten. De todos los grupos
// (en /resumenes, sin `grupoId`) o de uno. Las cifras las cuenta la base de datos: aquí solo se pintan.
//
// Las barras van a mano (como las flashcards): una librería de gráficos por esto sería otro lenguaje
// visual al lado del «sticker».

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { cargarPrevision } from '@/lib/resumenes/previsionApi'
import { diaCorto, porcentaje, tramosPrevision, type Prevision } from '@/lib/resumenes/prevision'
import { estiloNivel, GRIS_AA } from '@/lib/resumenes/accesible'
import { INK } from './ui'

const ESTADOS = [
  { k: 'new', nombre: 'Nuevos', color: '#7D8A96' },
  { k: 'failed', nombre: 'Fallados', color: '#B04A5E' },
  { k: 'learning', nombre: 'Aprendiendo', color: '#B07A1E' },
  { k: 'mastered', nombre: 'Dominados', color: '#5E8C5A' },
] as const

const caja = { border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }

export function PanelPrevision({
  grupoId,
  recarga = 0,
  onDatos,
}: {
  /** Sin grupo: todos los del usuario (y cada hueco fallado lleva a su grupo). */
  grupoId?: string
  /** Cambiarlo vuelve a pedir las cifras (tras estudiar o editar). */
  recarga?: number
  /** Para quien quiera las cifras (p. ej. el aviso de la cabecera). */
  onDatos?: (p: Prevision) => void
}) {
  const [p, setP] = useState<Prevision | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    cargarPrevision(grupoId)
      .then((x) => {
        if (!vivo || !x) return
        setP(x)
        setError(null)
        onDatos?.(x)
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se pudo cargar la previsión'))
    return () => {
      vivo = false
    }
    // onDatos es un aviso, no una dependencia: no se vuelve a pedir por él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, recarga])

  const maxDia = useMemo(() => Math.max(1, ...(p?.prevision.dias ?? []).map((d) => d.n)), [p])

  if (error) return <p className="text-xs font-bold text-[#8E3346]">{error}</p>
  if (!p) return <div className="h-40 animate-pulse rounded-3xl bg-white/60" aria-hidden />
  if (p.parrafos === 0) return null

  const tramos = tramosPrevision(p)
  const dias = p.prevision.dias
  const totalEstados = ESTADOS.reduce((n, e) => n + p.estados[e.k], 0)

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Previsión y estadísticas" data-prevision={grupoId ?? 'todos'}>
      {/* ── Lo que te espera ─────────────────────────────────────────── */}
      <div className="min-w-0 rounded-3xl bg-white p-4" style={caja}>
        <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: GRIS_AA }}>
          Lo que te espera
        </h2>
        <dl className="mt-3 grid grid-cols-4 gap-2" data-tramos>
          {tramos.map((t, i) => (
            <div
              key={t.clave}
              className="flex flex-col items-center rounded-2xl px-1 py-2 text-center"
              style={{ background: i === 0 ? '#FBEDEA' : '#FAF7F4', border: `2px solid ${i === 0 ? INK : 'rgba(44,62,80,0.12)'}` }}
              data-tramo={t.clave}
            >
              <dt className="order-2 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: GRIS_AA }}>
                {t.etiqueta}
              </dt>
              <dd className="order-1 text-[clamp(1.25rem,4.5vw,1.75rem)] font-black leading-none tabular-nums text-[#2C3E50]">{t.n}</dd>
              {t.nota ? <dd className="order-3 mt-0.5 text-[10px] font-bold text-[#8E3346]">{t.nota}</dd> : null}
            </div>
          ))}
        </dl>

        {dias.some((d) => d.n > 0) ? (
          <>
            <div
              className="mt-4 flex h-20 items-end gap-[2px]"
              role="img"
              aria-label={`Párrafos que vencen cada día durante 30 días: hoy ${dias[0]?.n ?? 0}, en total ${p.prevision.mes}.`}
            >
              {dias.map((d, i) => (
                <div
                  key={d.fecha}
                  className="flex-1 rounded-t-[3px]"
                  style={{
                    height: `${Math.max(d.n > 0 ? 8 : 3, (d.n / maxDia) * 100)}%`,
                    background: d.n > 0 ? (i === 0 ? '#E8A598' : '#3F7EA6') : '#EFEAE7',
                    border: d.n > 0 ? `1.5px solid ${INK}` : undefined,
                    borderBottom: 'none',
                  }}
                  title={`${i === 0 ? 'Hoy' : diaCorto(d.fecha)}: ${d.n} ${d.n === 1 ? 'párrafo' : 'párrafos'}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between border-t-2 pt-1 text-[10px] font-bold uppercase tracking-wide" style={{ borderColor: INK, color: GRIS_AA }}>
              <span>hoy</span>
              <span>+15 d</span>
              <span>+30 d</span>
            </div>
          </>
        ) : (
          <p className="mt-4 text-center text-xs font-semibold" style={{ color: GRIS_AA }}>
            Nada programado aún: estudia un párrafo y aquí verás cuándo vuelve.
          </p>
        )}
        {p.nuevos > 0 && (
          <p className="mt-2 text-[11px] font-semibold" style={{ color: GRIS_AA }}>
            Además, {p.nuevos === 1 ? '1 párrafo nuevo' : `${p.nuevos} párrafos nuevos`} sin estudiar todavía.
          </p>
        )}
      </div>

      {/* ── Cómo lo llevas ───────────────────────────────────────────── */}
      <div className="min-w-0 rounded-3xl bg-white p-4" style={caja}>
        <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: GRIS_AA }}>
          Cómo lo llevas
        </h2>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full" style={{ border: `1.5px solid ${INK}` }} aria-hidden>
          {ESTADOS.map((e) => (p.estados[e.k] ? <span key={e.k} style={{ width: `${(p.estados[e.k] / Math.max(1, totalEstados)) * 100}%`, background: e.color }} /> : null))}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4" data-estados>
          {ESTADOS.map((e) => (
            <li key={e.k} className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden />
              <b className="tabular-nums text-[#2C3E50]">{p.estados[e.k]}</b>
              <span style={{ color: GRIS_AA }}>{e.nombre.toLowerCase()}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[#FAF7F4] px-3 py-2" data-retencion>
            <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: GRIS_AA }}>
              Retención
            </p>
            <p className="text-2xl font-black tabular-nums text-[#2C3E50]">{porcentaje(p.retencion.tasa)}</p>
            <p className="text-[11px] leading-snug" style={{ color: GRIS_AA }}>
              {p.retencion.programados
                ? `${p.retencion.recordados} de ${p.retencion.programados} repasos sin «Otra vez»${p.retencion.tasa30 !== null && p.retencion.programados30 !== p.retencion.programados ? ` · 30 días: ${porcentaje(p.retencion.tasa30)}` : ''}`
                : 'Cuando repases un párrafo por segunda vez'}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF7F4] px-3 py-2" data-aciertos>
            <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: GRIS_AA }}>
              Huecos sabidos
            </p>
            <p className="text-2xl font-black tabular-nums text-[#2C3E50]">{porcentaje(p.huecos.tasa)}</p>
            <p className="text-[11px] leading-snug" style={{ color: GRIS_AA }}>
              {p.huecos.repasados ? `${p.huecos.sabidos} de ${p.huecos.repasados} destapados` : 'Aún no has destapado ninguno'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Los huecos que más se resisten ───────────────────────────── */}
      {p.masFallados.length > 0 && (
        <div className="min-w-0 rounded-3xl bg-white p-4 lg:col-span-2" style={caja} data-mas-fallados>
          <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: GRIS_AA }}>
            Los huecos que más se te resisten
          </h2>
          <ol className="mt-2 flex flex-col gap-1.5">
            {p.masFallados.map((m) => {
              const e = estiloNivel(m.nivel)
              const fila = (
                <>
                  <span className="rounded-md px-1.5 py-0.5 text-sm font-bold" style={{ background: e.suave, color: e.tinta, boxShadow: `inset 0 -2px 0 ${e.borde}` }}>
                    {m.texto}
                  </span>
                  <span className="rounded px-1 text-[10px] font-black uppercase" style={{ color: e.tinta, border: `1.5px solid ${e.borde}` }} title={`Nivel ${e.nombre}`}>
                    {e.corto}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs" style={{ color: GRIS_AA }}>
                    {[grupoId ? null : m.grupo, m.tema].filter(Boolean).join(' · ')}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[#2C3E50]">
                    {m.fallos} de {m.intentos}
                  </span>
                  {m.falladoAhora ? (
                    <span className="shrink-0 rounded-md bg-[#8E3346] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">sigue fallado</span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-[#3B6537] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">recuperado</span>
                  )}
                </>
              )
              return (
                <li key={`${m.itemId}-${m.hueco}`}>
                  {!grupoId && m.grupoId ? (
                    <Link href={`/resumenes/${m.grupoId}`} className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl px-2 py-1 hover:bg-[#FAF7F4]">
                      {fila}
                    </Link>
                  ) : (
                    <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-2 py-1">{fila}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
