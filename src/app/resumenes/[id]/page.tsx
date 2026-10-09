'use client'

// Un grupo de resúmenes activos: sus párrafos por tema (con su estado de repaso), editarlos, borrarlos
// o escribir uno nuevo, y estudiar con ajustes de la sesión. `?estudiar=1` abre los ajustes al llegar
// (desde «Estudiar» en la lista o «Empezar a estudiar» tras la IA).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { GhostButton, Hero, StatChip, StickerButton, StickerCard } from '@/components/ui/sticker'
import { ParrafoHuecos, ResumenHuecos } from '@/components/resumenes/ParrafoHuecos'
import { EditorParrafo } from '@/components/resumenes/EditorParrafo'
import { EstudioResumen } from '@/components/resumenes/EstudioResumen'
import { AjustesEstudio } from '@/components/resumenes/AjustesEstudio'
import {
  anadirParrafos,
  borrarGrupo,
  cargarGrupo,
  editarParrafo,
  quitarParrafo,
  renombrarGrupo,
  type GrupoResumen,
  type Parrafo,
} from '@/lib/resumenes/api'
import { AJUSTES_POR_DEFECTO, aPeticion, sanearAjustes, type Ajustes } from '@/lib/resumenes/sesion'

const ESTADO: Record<string, { nombre: string; color: string }> = {
  new: { nombre: 'Nuevo', color: '#7D8A96' },
  failed: { nombre: 'Fallado', color: '#B04A5E' },
  learning: { nombre: 'Aprendiendo', color: '#B07A1E' },
  mastered: { nombre: 'Dominado', color: '#5E8C5A' },
}

const claveAjustes = (id: string) => `mirdaily-resumenes-ajustes:${id}`
function leerAjustes(id: string): Ajustes {
  try {
    const raw = window.localStorage.getItem(claveAjustes(id))
    return raw ? sanearAjustes(JSON.parse(raw)) : { ...AJUSTES_POR_DEFECTO }
  } catch {
    return { ...AJUSTES_POR_DEFECTO }
  }
}
function guardarAjustes(id: string, a: Ajustes) {
  try {
    window.localStorage.setItem(claveAjustes(id), JSON.stringify(a))
  } catch {
    /* comodidad: si no se puede, la próxima vez salen los de por defecto */
  }
}

export default function GrupoResumenPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const [grupo, setGrupo] = useState<GrupoResumen | null>(null)
  const [parrafos, setParrafos] = useState<Parrafo[]>([])
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [escribiendo, setEscribiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)
  const [estudio, setEstudio] = useState<Ajustes | null>(null)
  const [cambiado, setCambiado] = useState(false)
  const [renombrando, setRenombrando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await cargarGrupo(id)
      setGrupo(r.grupo)
      setParrafos(r.parrafos)
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el grupo')
      setEstado('error')
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ?estudiar=1: los ajustes de la sesión, en cuanto haya párrafos (leído de window.location: sin Suspense).
  useEffect(() => {
    if (estado !== 'listo') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('estudiar') === '1' && parrafos.length) {
      setAjustesAbiertos(true)
      router.replace(`/resumenes/${id}`, { scroll: false })
    }
  }, [estado, parrafos.length, id, router])

  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio', trail: [{ label: 'Resúmenes activos', href: '/resumenes' }], current: grupo?.name })
    return () => setBackAction(null)
  }, [setBackAction, grupo?.name])

  const temas = useMemo(() => [...new Set(parrafos.map((p) => (p.tema ?? '').trim()))], [parrafos])
  const porTema = useMemo(() => {
    const m = new Map<string, Parrafo[]>()
    for (const p of parrafos) {
      const t = (p.tema ?? '').trim()
      if (!m.has(t)) m.set(t, [])
      m.get(t)!.push(p)
    }
    return [...m.entries()]
  }, [parrafos])
  const pendientes = parrafos.filter((p) => p.due).length
  const huecos = parrafos.reduce((n, p) => n + p.huecos.length, 0)

  const empezar = (a: Ajustes) => {
    guardarAjustes(id, a)
    setAjustesAbiertos(false)
    setEstudio(a)
  }

  if (estudio) {
    return (
      <div className="relative min-h-screen bg-[#FAF7F4]">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-8">
          <h1 className="text-2xl font-black text-[#2C3E50]">{grupo?.name}</h1>
          <EstudioResumen
            grupoId={id}
            ajustes={aPeticion(estudio, temas)}
            vista={{ escribir: estudio.escribir, anchoFijo: estudio.anchoFijo }}
            temas={temas.filter(Boolean)}
            onCambio={() => setCambiado(true)}
            onSalir={() => {
              setEstudio(null)
              if (cambiado) void cargar()
              setCambiado(false)
            }}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)' }}
      />
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8">
        {estado === 'error' ? (
          <StickerCard className="p-6 text-center">
            <p className="font-bold text-[#B04A5E]">{error}</p>
            <button type="button" onClick={() => router.push('/resumenes')} className="mt-3 text-sm font-bold underline">
              Volver a los grupos
            </button>
          </StickerCard>
        ) : !grupo ? (
          <p className="py-10 text-center text-sm">Cargando…</p>
        ) : (
          <>
            <Hero
              badge="Resumen activo"
              badgeIcon="text_snippet"
              title={grupo.name}
              actions={
                <>
                  <StickerButton icon="play_arrow" onClick={() => setAjustesAbiertos(true)} disabled={!parrafos.length}>
                    Estudiar
                  </StickerButton>
                  <GhostButton icon="edit_note" onClick={() => setEscribiendo(true)}>
                    Escribir un párrafo
                  </GhostButton>
                  <GhostButton icon="edit" onClick={() => setRenombrando(grupo.name)}>
                    Renombrar
                  </GhostButton>
                  <GhostButton
                    icon="delete"
                    onClick={async () => {
                      if (!window.confirm(`¿Borrar el grupo «${grupo.name}»? Queda 24 horas en la papelera.`)) return
                      try {
                        await borrarGrupo(id)
                        router.push('/resumenes')
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'No se pudo borrar')
                      }
                    }}
                  >
                    Borrar grupo
                  </GhostButton>
                </>
              }
            >
              <div className="mt-4 flex flex-wrap gap-2">
                <StatChip value={parrafos.length} label="párrafos" />
                <StatChip value={huecos} label="huecos" color="#3F7EA6" />
                <StatChip value={pendientes} label="por repasar" color="#B07A1E" />
              </div>
            </Hero>

            {renombrando !== null && (
              <StickerCard className="flex flex-wrap items-center gap-3 p-4">
                <input
                  autoFocus
                  value={renombrando}
                  onChange={(e) => setRenombrando(e.target.value.slice(0, 80))}
                  aria-label="Nombre del grupo"
                  className="min-w-0 flex-1 rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
                />
                <button type="button" onClick={() => setRenombrando(null)} className="text-sm font-bold">
                  Cancelar
                </button>
                <StickerButton
                  icon="check"
                  disabled={renombrando.trim().length < 3}
                  onClick={async () => {
                    try {
                      await renombrarGrupo(id, renombrando.trim())
                      setRenombrando(null)
                      void cargar()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'No se pudo renombrar')
                    }
                  }}
                >
                  Guardar
                </StickerButton>
              </StickerCard>
            )}

            {error && <p className="rounded-2xl bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E]">{error}</p>}

            {escribiendo && (
              <EditorParrafo
                inicial={{ texto: '', huecos: [], tema: '' }}
                temas={temas.filter(Boolean)}
                guardando={guardando}
                textoBoton="Añadir al grupo"
                onCancelar={() => setEscribiendo(false)}
                onGuardar={async (x) => {
                  setGuardando(true)
                  setError(null)
                  try {
                    const r = await anadirParrafos(id, [{ texto: x.texto, huecos: x.huecos, tema: x.tema || null }], false)
                    if (!r.creados) setError('Ese párrafo ya está en el grupo.')
                    setEscribiendo(false)
                    void cargar()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo añadir')
                  } finally {
                    setGuardando(false)
                  }
                }}
              />
            )}

            {parrafos.length === 0 && !escribiendo ? (
              <StickerCard className="p-8 text-center">
                <p className="text-lg font-extrabold text-[#2C3E50]">Este grupo está vacío</p>
                <p className="mt-1 text-sm">Escribe un párrafo y toca las palabras que quieres tapar al estudiar.</p>
              </StickerCard>
            ) : null}

            {porTema.map(([tema, lista]) => (
              <section key={tema || '-'} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#2C3E50]">
                  {tema || 'Sin tema'} <span className="text-xs font-bold normal-case tracking-normal text-[#7D8A96]">{lista.length}</span>
                </h2>
                {lista.map((p) =>
                  editando === p.id ? (
                    <EditorParrafo
                      key={p.id}
                      inicial={{ texto: p.texto, huecos: p.huecos, tema: p.tema ?? '' }}
                      temas={temas.filter(Boolean)}
                      guardando={guardando}
                      onCancelar={() => setEditando(null)}
                      onGuardar={async (x) => {
                        setGuardando(true)
                        setError(null)
                        try {
                          await editarParrafo(p.id, { texto: x.texto, huecos: x.huecos, tema: x.tema || null })
                          setEditando(null)
                          void cargar()
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'No se pudo guardar')
                        } finally {
                          setGuardando(false)
                        }
                      }}
                    />
                  ) : (
                    <div key={p.id} className="rounded-2xl bg-white px-4 py-3" style={{ border: '2px solid rgba(44,62,80,0.15)' }} data-item={p.itemId}>
                      <ParrafoHuecos texto={p.texto} huecos={p.huecos} />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem]">
                        <ResumenHuecos huecos={p.huecos} />
                        {p.status ? (
                          <span className="rounded-md px-1.5 py-0.5 font-extrabold text-white" style={{ background: ESTADO[p.status]?.color ?? '#7D8A96' }}>
                            {ESTADO[p.status]?.nombre}
                          </span>
                        ) : null}
                        {p.due && p.status !== 'new' ? <span className="font-bold text-[#B07A1E]">Toca repasar</span> : null}
                        {p.origen?.page ? (
                          <span>
                            {p.origen.unit === 'diapositiva' ? 'Diap.' : 'Pág.'} {p.origen.page}
                            {p.modo === 'literal' ? ' · texto original' : ''}
                          </span>
                        ) : null}
                        <span className="ml-auto flex gap-1">
                          <button type="button" onClick={() => setEditando(p.id)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAF7F4] hover:text-[#2C3E50]">
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('¿Borrar este párrafo? Queda 24 horas en la papelera.')) return
                              try {
                                await quitarParrafo(id, p.itemId)
                                void cargar()
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'No se pudo borrar')
                              }
                            }}
                            className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAEAED] hover:text-[#B04A5E]"
                          >
                            Borrar
                          </button>
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </section>
            ))}
          </>
        )}
      </main>

      {ajustesAbiertos && (
        <AjustesEstudio parrafos={parrafos} inicial={leerAjustes(id)} onCerrar={() => setAjustesAbiertos(false)} onEmpezar={empezar} />
      )}
    </div>
  )
}
