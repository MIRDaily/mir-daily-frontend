'use client'

import { useCallback, useEffect, useState } from 'react'
import { SectionLabel, StickerButton, StickerCard, INK } from '@/components/ui/sticker'
import { AdminError, adminApi } from '@/lib/admin/reports'
import { creditosAdmin, type PlanManual, type UsoIA, type UsuarioIA } from '@/lib/admin/creditos'
import { describirMovimiento, fechaCorta, type Movimiento, type SaldoIA } from '@/lib/ia/creditosTexto'

// Panel mínimo de créditos de IA (solo admins; el permiso lo valida el backend): buscar un usuario,
// ver su plan, bolsas, consumo y movimientos, darle créditos (con motivo) y asignarle o cambiarle un
// plan manual. Sin pagos: los planes de la beta se asignan aquí.

const fmt = (n: number) => n.toLocaleString('es-ES')
const usd = (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(4)} $`)
const PLANES: { id: PlanManual; nombre: string }[] = [
  { id: 'mensual', nombre: 'Mensual (700/mes + 300 de regalo la 1.ª vez)' },
  { id: 'anual', nombre: 'Anual (700/mes)' },
  { id: 'prueba', nombre: 'Prueba (150 créditos, 7 días)' },
  { id: 'admin', nombre: 'Equipo (ilimitado, se apunta)' },
]

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block text-[0.72rem] font-black uppercase tracking-wide text-[#7D8A96]">
      {etiqueta}
      <div className="mt-1 normal-case tracking-normal">{children}</div>
    </label>
  )
}

const entrada = 'w-full rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2 text-[0.9rem] font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]'

export default function CreditosAdmin() {
  const [acceso, setAcceso] = useState<'cargando' | 'ok' | 'no' | 'error'>('cargando')
  const [buscar, setBuscar] = useState('')
  const [lista, setLista] = useState<UsuarioIA[] | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargarLista = useCallback(async (q: string) => {
    try {
      const usuarios = await creditosAdmin.usuarios(q)
      setLista(usuarios)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    }
  }, [])

  useEffect(() => {
    adminApi
      .me()
      .then(() => {
        setAcceso('ok')
        return cargarLista('')
      })
      .catch((e) => setAcceso(e instanceof AdminError && (e.status === 401 || e.status === 403) ? 'no' : 'error'))
  }, [cargarLista])

  if (acceso === 'cargando') return <p className="text-[0.9rem] text-[#7D8A96]">Comprobando el acceso…</p>
  if (acceso !== 'ok') return <p className="text-[0.9rem] font-bold text-[#B04A5E]">{acceso === 'no' ? 'Solo para administradores.' : 'No se pudo comprobar el acceso.'}</p>

  return (
    <div className="space-y-6">
      <StickerCard className="p-5 sm:p-6" depth={6}>
        <h1 className="text-[1.7rem] font-black text-[#2C3E50]">Créditos de IA</h1>
        <p className="mt-1 text-[0.9rem] text-[#7D8A96]">Planes manuales de la beta, saldo y consumo por usuario. Sin pagos.</p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setElegido(null)
            void cargarLista(buscar.trim())
          }}
        >
          <input className={entrada} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Email, nombre o id (vacío: los que tienen plan o consumo este mes)" />
          <StickerButton type="submit" icon="search">Buscar</StickerButton>
        </form>
        {error && <p className="mt-2 text-[0.85rem] font-bold text-[#B04A5E]">{error}</p>}
      </StickerCard>

      {lista && (
        <StickerCard className="overflow-x-auto p-2" depth={4}>
          {lista.length === 0 ? (
            <p className="p-3 text-[0.88rem] text-[#7D8A96]">Nadie.</p>
          ) : (
            <table className="w-full min-w-[44rem] text-left text-[0.82rem]">
              <thead className="text-[0.7rem] uppercase tracking-wide text-[#7D8A96]">
                <tr>
                  <th className="px-2 py-1.5">Usuario</th>
                  <th className="px-2 py-1.5">Plan</th>
                  <th className="px-2 py-1.5 text-right">Saldo</th>
                  <th className="px-2 py-1.5 text-right">Créditos mes</th>
                  <th className="px-2 py-1.5 text-right">Coste mes</th>
                  <th className="px-2 py-1.5 text-right">Gen. / err. / canc.</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => setElegido(u.user_id)}
                    className={`cursor-pointer border-t border-[#F0E9E5] hover:bg-[#FAF7F4] ${elegido === u.user_id ? 'bg-[#FCEFEC]' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <span className="block font-bold text-[#2C3E50]">{u.email}</span>
                      <span className="block text-[0.7rem] text-[#7D8A96]">{u.display_name}{u.role === 'admin' ? ' · admin' : ''}</span>
                    </td>
                    <td className="px-2 py-1.5">{u.plan ? `${u.plan}${u.estado && u.estado !== 'activo' ? ` (${u.estado})` : ''}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-bold tabular-nums">{u.ilimitado ? '∞' : fmt(u.saldo)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(u.creditos_mes)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{usd(u.usd_mes)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{u.generaciones_mes} / {u.errores_mes} / {u.cancelaciones_mes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </StickerCard>
      )}

      {elegido && <FichaUsuario key={elegido} id={elegido} onCambio={() => void cargarLista(buscar.trim())} />}
    </div>
  )
}

function FichaUsuario({ id, onCambio }: { id: string; onCambio: () => void }) {
  const [datos, setDatos] = useState<{ usuario: UsuarioIA; saldo: SaldoIA; uso: UsoIA[]; movimientos: Movimiento[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [creditos, setCreditos] = useState('100')
  const [motivo, setMotivo] = useState('')
  const [dias, setDias] = useState('30')
  const [plan, setPlan] = useState<PlanManual>('mensual')
  const [porMes, setPorMes] = useState('')
  const [masMovs, setMasMovs] = useState<number | null>(null)
  const [masUso, setMasUso] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    try {
      const d = await creditosAdmin.usuario(id)
      setDatos(d)
      setMasMovs(d.movimientos.length === 30 ? d.movimientos[29].id : null)
      setMasUso(d.uso.length === 30 ? d.uso[29].id : null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    }
  }, [id])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const accion = async (hacer: () => Promise<unknown>, ok: string) => {
    setOcupado(true)
    setAviso(null)
    try {
      await hacer()
      setAviso(ok)
      await cargar()
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo')
    } finally {
      setOcupado(false)
    }
  }

  if (error && !datos) return <p className="text-[0.9rem] font-bold text-[#B04A5E]">{error}</p>
  if (!datos) return <p className="text-[0.9rem] text-[#7D8A96]">Cargando…</p>
  const { usuario: u, saldo: s } = datos

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <StickerCard className="p-5" depth={4}>
        <SectionLabel>{u.email}</SectionLabel>
        <p className="text-[0.9rem] text-[#2C3E50]">
          <b>{s.plan ?? 'Sin plan'}</b>
          {s.estado ? ` · ${s.estado}` : ''}
          {s.periodo_fin && s.plan !== 'admin' ? ` · periodo hasta el ${fechaCorta(s.periodo_fin)}` : ''}
          {s.ilimitado ? ' · ilimitado' : ''}
          {s.creditos_periodo !== null ? ` · ${fmt(s.creditos_periodo)}/mes` : ''}
        </p>
        <p className="mt-1 text-[0.9rem] text-[#2C3E50]">
          Saldo usable: <b>{fmt(s.total)}</b> · cancelaciones gratis: {s.cancelaciones_gratis_restantes}/{s.cancelaciones_gratis_mes}
        </p>
        <ul className="mt-2 space-y-0.5 text-[0.8rem] text-[#7D8A96]">
          {s.bolsas.map((b) => (
            <li key={b.id}>
              {b.tipo}: {fmt(b.saldo)} de {fmt(b.iniciales)} · caduca el {fechaCorta(b.caduca_at)}
              {b.congelada ? ' · congelada' : ''}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[0.8rem] text-[#7D8A96]">
          Este mes: {fmt(u.creditos_mes)} créditos · {usd(u.usd_mes)} de lista · {u.generaciones_mes} generaciones, {u.errores_mes} errores devueltos, {u.cancelaciones_mes} cancelaciones
        </p>
        {aviso && <p className="mt-3 rounded-xl bg-[#EAF3E8] px-3 py-2 text-[0.85rem] font-bold text-[#3F6E3C]">{aviso}</p>}
        {error && <p className="mt-3 text-[0.85rem] font-bold text-[#B04A5E]">{error}</p>}

        <div className="mt-5 space-y-3 rounded-2xl bg-[#FAF7F4] p-4" style={{ border: `2px solid ${INK}` }}>
          <p className="text-[0.85rem] font-black text-[#2C3E50]">Dar créditos (bolsa de ajuste)</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo etiqueta="Créditos">
              <input className={entrada} inputMode="numeric" value={creditos} onChange={(e) => setCreditos(e.target.value.replace(/\D/g, ''))} />
            </Campo>
            <Campo etiqueta="Caducan en (días)">
              <input className={entrada} inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} />
            </Campo>
            <Campo etiqueta="Motivo (obligatorio)">
              <input className={entrada} value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 200))} placeholder="p. ej. compensación" />
            </Campo>
          </div>
          <StickerButton
            icon="redeem"
            disabled={ocupado || !Number(creditos) || motivo.trim().length < 3}
            onClick={() => void accion(() => creditosAdmin.conceder(id, Number(creditos), motivo.trim(), Number(dias) || 30), `+${creditos} créditos concedidos.`)}
          >
            Dar créditos
          </StickerButton>
        </div>

        <div className="mt-4 space-y-3 rounded-2xl bg-[#FAF7F4] p-4" style={{ border: `2px solid ${INK}` }}>
          <p className="text-[0.85rem] font-black text-[#2C3E50]">Plan manual</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo etiqueta="Plan">
              <select className={entrada} value={plan} onChange={(e) => setPlan(e.target.value as PlanManual)}>
                {PLANES.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Créditos al mes (vacío: 700)">
              <input className={entrada} inputMode="numeric" value={porMes} onChange={(e) => setPorMes(e.target.value.replace(/\D/g, ''))} />
            </Campo>
          </div>
          <div className="flex flex-wrap gap-2">
            <StickerButton
              icon="workspace_premium"
              disabled={ocupado}
              onClick={() => void accion(() => creditosAdmin.plan(id, plan, porMes ? Number(porMes) : null), `Plan ${plan} asignado.`)}
            >
              Asignar
            </StickerButton>
            {s.plan && s.estado === 'activo' && (
              <StickerButton color="#B04A5E" icon="block" disabled={ocupado} onClick={() => void accion(() => creditosAdmin.estado(id, 'cancelado'), 'Plan dado de baja.')}>
                Dar de baja
              </StickerButton>
            )}
            {s.plan && s.plan !== 'prueba' && s.estado !== 'activo' && (
              <StickerButton color="#5E8C5A" icon="restart_alt" disabled={ocupado} onClick={() => void accion(() => creditosAdmin.estado(id, 'activo'), 'Plan reactivado.')}>
                Reactivar
              </StickerButton>
            )}
          </div>
          <p className="text-[0.75rem] text-[#7D8A96]">
            Mismo plan y activo: solo cambia los créditos al mes (desde el periodo siguiente). Para darle créditos ya, usa «Dar créditos».
          </p>
        </div>
      </StickerCard>

      <div className="space-y-6">
        <StickerCard className="p-4" depth={4}>
          <SectionLabel>Movimientos</SectionLabel>
          <ul className="divide-y divide-[#F0E9E5] text-[0.8rem]">
            {datos.movimientos.map((m) => (
              <li key={`${m.id}-${m.tipo}`} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate text-[#2C3E50]">{describirMovimiento(m)}</span>
                <span className="shrink-0 tabular-nums text-[#7D8A96]">{new Date(m.creado_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="w-14 shrink-0 text-right font-black tabular-nums" style={{ color: m.creditos < 0 ? '#C4655A' : '#5E8C5A' }}>
                  {m.creditos > 0 ? '+' : ''}
                  {fmt(m.creditos)}
                </span>
              </li>
            ))}
          </ul>
          {masMovs !== null && (
            <button
              type="button"
              className="mt-2 text-[0.8rem] font-bold text-[#2C3E50] underline"
              onClick={() =>
                void creditosAdmin.movimientos(id, masMovs).then((r) => {
                  setDatos((d) => (d ? { ...d, movimientos: [...d.movimientos, ...r.movimientos] } : d))
                  setMasMovs(r.siguiente)
                })
              }
            >
              Ver más
            </button>
          )}
        </StickerCard>

        <StickerCard className="overflow-x-auto p-4" depth={4}>
          <SectionLabel>Uso reciente</SectionLabel>
          <table className="w-full min-w-[30rem] text-left text-[0.76rem]">
            <thead className="text-[0.66rem] uppercase tracking-wide text-[#7D8A96]">
              <tr>
                <th className="py-1">Cuándo</th>
                <th className="py-1">Qué</th>
                <th className="py-1">Resultado</th>
                <th className="py-1 text-right">Créditos</th>
                <th className="py-1 text-right">Coste</th>
              </tr>
            </thead>
            <tbody>
              {datos.uso.map((x) => (
                <tr key={x.id} className="border-t border-[#F0E9E5]">
                  <td className="py-1 pr-2 tabular-nums">{new Date(x.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-1 pr-2">
                    <span className="block font-bold text-[#2C3E50]">{x.clave ?? x.kind}</span>
                    <span className="block max-w-[12rem] truncate text-[#7D8A96]">{x.titulo ?? x.modo}</span>
                  </td>
                  <td className="py-1 pr-2">{x.status}{x.cancelado_por ? ` (${x.cancelado_por})` : x.error_code ? ` (${x.error_code})` : ''}</td>
                  <td className="py-1 text-right tabular-nums">
                    {x.creditos ?? '—'}
                    {x.creditos_devueltos ? ` (−${x.creditos_devueltos})` : ''}
                  </td>
                  <td className="py-1 text-right tabular-nums">{usd(x.cost_usd ?? x.est_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {masUso !== null && (
            <button
              type="button"
              className="mt-2 text-[0.8rem] font-bold text-[#2C3E50] underline"
              onClick={() =>
                void creditosAdmin.uso(id, masUso).then((r) => {
                  setDatos((d) => (d ? { ...d, uso: [...d.uso, ...r.uso] } : d))
                  setMasUso(r.siguiente)
                })
              }
            >
              Ver más
            </button>
          )}
        </StickerCard>
      </div>
    </div>
  )
}
