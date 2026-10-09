'use client'

// Resúmenes activos: los grupos del usuario. Un resumen activo es un párrafo de repaso con HUECOS que
// se estudia destapando y autoevaluando, con repaso espaciado. Se crean con IA desde un documento
// (solo admin, como las flashcards con IA) o se escriben a mano dentro de un grupo.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { supabase } from '@/lib/supabaseBrowser'
import { GhostButton, Hero, INK, SectionLabel, StatChip, StickerButton, StickerCard } from '@/components/ui/sticker'
import CrearResumenesIA from '@/components/resumenes/CrearResumenesIA'
import { crearGrupo, listarGrupos, type GrupoResumen } from '@/lib/resumenes/api'
import { resumenesIAEstado, type EstadoResumenesIA } from '@/lib/resumenes/ia'
import { borrarBorrador, leerBorradores, type BorradorResumen } from '@/lib/resumenes/borrador'

const ESTADOS: { k: keyof GrupoResumen['resumen']; nombre: string; color: string }[] = [
  { k: 'new', nombre: 'nuevos', color: '#7D8A96' },
  { k: 'failed', nombre: 'fallados', color: '#B04A5E' },
  { k: 'learning', nombre: 'aprendiendo', color: '#B07A1E' },
  { k: 'mastered', nombre: 'dominados', color: '#5E8C5A' },
]

function haceCuanto(ms: number): string {
  const min = Math.round(Math.max(0, Date.now() - ms) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

/** Un párrafo de ejemplo pintado como en el estudio: el arte de la portada. */
function ParrafoArte() {
  const hueco = (w: string, c: string) => (
    <span className="mx-[2px] inline-block h-[0.95em] rounded align-[-2px]" style={{ width: w, background: `repeating-linear-gradient(135deg, ${c}33 0 5px, #fff 5px 8px)`, border: `2px solid ${c}` }} />
  )
  return (
    <div className="hidden w-64 rotate-[2deg] rounded-2xl bg-white p-4 text-[0.78rem] leading-[1.9] text-[#2C3E50] md:block" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }} aria-hidden>
      La causa más frecuente es la {hueco('6.5em', '#5E8C5A')}, con anticuerpos {hueco('3.5em', '#3F7EA6')}. Se trata con{' '}
      <span className="rounded px-1 font-bold text-[#B07A1E]" style={{ background: '#FBF0DA', boxShadow: 'inset 0 -2px 0 #B07A1E' }}>
        levotiroxina
      </span>{' '}
      a {hueco('4em', '#B04A5E')}.
    </div>
  )
}

export default function ResumenesPage() {
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const [estado, setEstado] = useState<'cargando' | 'sin-sesion' | 'listo'>('cargando')
  const [grupos, setGrupos] = useState<GrupoResumen[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ia, setIa] = useState<EstadoResumenesIA | null>(null)
  const [iaAbierto, setIaAbierto] = useState<{ borrador?: BorradorResumen } | null>(null)
  // Borradores de la IA en este navegador: uno por documento, del más reciente al más viejo.
  const [borradores, setBorradores] = useState<BorradorResumen[]>([])
  const [usuario, setUsuario] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio', current: 'Resúmenes activos' })
    return () => setBackAction(null)
  }, [setBackAction])

  const cargar = useCallback(async () => {
    try {
      setGrupos(await listarGrupos())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los grupos')
    }
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!vivo) return
      if (!session?.access_token) {
        setEstado('sin-sesion')
        return
      }
      await cargar()
      if (!vivo) return
      setEstado('listo')
      setUsuario(session.user.id)
      void resumenesIAEstado().then((e) => vivo && setIa(e))
      void leerBorradores(session.user.id).then((bs) => vivo && setBorradores(bs))
    })()
    return () => {
      vivo = false
    }
  }, [cargar])

  const crear = async () => {
    if (!nuevo || nuevo.trim().length < 3) return
    setCreando(true)
    try {
      const g = await crearGrupo(nuevo.trim())
      router.push(`/resumenes/${g.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el grupo')
      setCreando(false)
    }
  }

  const totalPendientes = grupos.reduce((n, g) => n + g.pendientes, 0)
  const totalParrafos = grupos.reduce((n, g) => n + g.total, 0)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)' }}
      />
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/12 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
        <Hero
          badge="Repaso espaciado"
          badgeIcon="text_snippet"
          title="Resúmenes activos"
          subtitle="Párrafos de repaso con los datos clave tapados. Lee, intenta recordar, destapa y valora: cada repaso los reprograma para que vuelvan justo cuando toca."
          aside={<ParrafoArte />}
          actions={
            <>
              <StickerButton icon="add" onClick={() => setNuevo('')}>
                Nuevo grupo
              </StickerButton>
              {ia ? (
                <GhostButton icon="auto_awesome" onClick={() => setIaAbierto({})}>
                  Crear con IA
                </GhostButton>
              ) : null}
            </>
          }
        >
          {estado === 'listo' && grupos.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <StatChip value={grupos.length} label={grupos.length === 1 ? 'grupo' : 'grupos'} />
              <StatChip value={totalParrafos} label="párrafos" color="#3F7EA6" />
              <StatChip value={totalPendientes} label="por repasar" color="#B07A1E" />
            </div>
          ) : null}
        </Hero>

        {nuevo !== null && (
          <StickerCard className="flex flex-wrap items-center gap-3 p-4">
            <label htmlFor="ra-nuevo" className="text-sm font-extrabold text-[#2C3E50]">
              Nombre del grupo
            </label>
            <input
              id="ra-nuevo"
              autoFocus
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value.slice(0, 80))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void crear()
                if (e.key === 'Escape') setNuevo(null)
              }}
              placeholder="Vasculitis"
              className="min-w-0 flex-1 rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
            />
            <button type="button" onClick={() => setNuevo(null)} className="text-sm font-bold text-[#7D8A96]">
              Cancelar
            </button>
            <StickerButton icon="check" onClick={() => void crear()} disabled={creando || nuevo.trim().length < 3}>
              Crear
            </StickerButton>
          </StickerCard>
        )}

        {borradores.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Borradores sin guardar" data-borradores>
            <p className="text-xs font-bold uppercase tracking-wide text-[#B07A1E]">
              {borradores.length === 1 ? 'Un borrador sin guardar' : `${borradores.length} borradores sin guardar`} · solo en este navegador, 7 días
            </p>
            {borradores.map((b) => (
              <div key={b.clave} data-borrador={b.documento}>
              <StickerCard className="flex flex-wrap items-center gap-3 p-4" style={{ background: '#FBF3E1' }}>
                <span className="material-symbols-outlined text-[26px] text-[#B07A1E]">draft</span>
                <p className="min-w-0 flex-1 text-sm text-[#2C3E50]">
                  <b>{b.lista.length} párrafos sin revisar</b> de «{b.titulo}»
                  {b.fuente.nombre && b.fuente.nombre !== b.titulo ? <span className="text-[#7D8A96]"> ({b.fuente.nombre})</span> : null} ·{' '}
                  {b.modo === 'literal' ? 'texto original' : 'resumen'} · {haceCuanto(b.actualizado)}
                </p>
                <GhostButton
                  icon="delete"
                  onClick={() => {
                    if (!usuario || !window.confirm(`¿Descartar el borrador de «${b.titulo}»? No se puede recuperar.`)) return
                    void borrarBorrador(usuario, b.documento).then(() => setBorradores((xs) => xs.filter((x) => x.clave !== b.clave)))
                  }}
                >
                  Descartar
                </GhostButton>
                <StickerButton icon="edit_note" onClick={() => setIaAbierto({ borrador: b })}>
                  Retomar
                </StickerButton>
              </StickerCard>
              </div>
            ))}
          </section>
        )}

        {error && <p className="rounded-2xl bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E]">{error}</p>}

        {estado === 'sin-sesion' ? (
          <StickerCard className="p-6 text-center text-sm">Inicia sesión para ver tus resúmenes.</StickerCard>
        ) : estado === 'cargando' ? (
          <p className="py-10 text-center text-sm">Cargando…</p>
        ) : grupos.length === 0 ? (
          <StickerCard className="p-8 text-center">
            <p className="text-lg font-extrabold text-[#2C3E50]">Aún no tienes resúmenes activos</p>
            <p className="mx-auto mt-2 max-w-xl text-sm">
              Crea un grupo y escribe tus párrafos marcando los datos que quieres tapar{ia ? ', o hazlos con IA desde un PDF, Word o PowerPoint' : ''}.
            </p>
          </StickerCard>
        ) : (
          <>
            <SectionLabel>Tus grupos</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grupos.map((g) => (
                <StickerCard key={g.id} className="flex flex-col gap-3 p-5" as="article">
                  <Link href={`/resumenes/${g.id}`} className="group block min-w-0">
                    <h3 className="truncate text-lg font-black text-[#2C3E50] group-hover:underline">{g.name}</h3>
                    <p className="text-xs">
                      {g.total} {g.total === 1 ? 'párrafo' : 'párrafos'} · <b className="text-[#B07A1E]">{g.pendientes}</b> por repasar
                    </p>
                  </Link>
                  <div className="flex h-2 overflow-hidden rounded-full bg-[#F2EFED]" aria-hidden>
                    {ESTADOS.map((s) =>
                      g.total && g.resumen[s.k] ? <span key={s.k} style={{ width: `${(g.resumen[s.k] / g.total) * 100}%`, background: s.color }} /> : null,
                    )}
                  </div>
                  <p className="flex flex-wrap gap-x-3 text-[0.7rem]">
                    {ESTADOS.map((s) => (g.resumen[s.k] ? <span key={s.k} style={{ color: s.color }}>{g.resumen[s.k]} {s.nombre}</span> : null))}
                  </p>
                  <div className="mt-auto flex gap-2">
                    <StickerButton icon="play_arrow" onClick={() => router.push(`/resumenes/${g.id}?estudiar=1`)} disabled={!g.total}>
                      Estudiar
                    </StickerButton>
                    <GhostButton icon="list" onClick={() => router.push(`/resumenes/${g.id}`)}>
                      Abrir
                    </GhostButton>
                  </div>
                </StickerCard>
              ))}
            </div>
          </>
        )}

        <p className="mx-auto max-w-3xl pt-4 text-center text-[0.7rem] leading-relaxed">
          Tus resúmenes son privados: el texto de tus documentos solo lo ves tú, no se comparte ni se reutiliza, y se borra con tu cuenta.
        </p>
      </main>

      {iaAbierto && (
        <CrearResumenesIA
          estado={ia}
          {...(iaAbierto.borrador ? { borrador: iaAbierto.borrador } : {})}
          onClose={() => {
            setIaAbierto(null)
            void cargar()
            if (usuario) void leerBorradores(usuario).then(setBorradores)
          }}
        />
      )}
    </div>
  )
}
