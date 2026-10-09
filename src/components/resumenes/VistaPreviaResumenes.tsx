'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { NIVELES, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import type { ModoResumen, ParrafoBorrador } from '@/lib/resumenes/borrador'
import { anadirParrafos, crearGrupo, listarGrupos, type GrupoResumen, type ParrafoNuevo } from '@/lib/resumenes/api'
import { INK, NivelNuevo, ParrafoHuecos, ResumenHuecos } from './ParrafoHuecos'
import { EditorParrafo } from './EditorParrafo'

// Vista previa de los resúmenes activos con IA: por tema y párrafo. Se puede quitar un párrafo (o
// desmarcarlo), editar su texto, tocar una palabra o seleccionar un trozo para crear un hueco, tocar un
// hueco para cambiar su nivel o quitarlo. Cada cambio se guarda en el borrador (IndexedDB) con
// `persistir`. Al final se guarda en un grupo nuevo o en uno que ya existe (sin duplicar: lo valida el
// servidor) o, tema a tema, uno por tema del libro.

type Destino = 'nuevo' | 'existente' | 'porTema'
type Hecho = { grupos: { id: string; name: string }[]; creados: number; duplicados: number }

const Tarjeta = memo(function Tarjeta({
  p,
  nivel,
  temas,
  onCambiar,
  onQuitar,
  onAviso,
}: {
  p: ParrafoBorrador
  nivel: Nivel
  temas: string[]
  onCambiar: (key: string, cambio: Partial<ParrafoBorrador>) => void
  onQuitar: (key: string) => void
  onAviso: (m: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const cambiarHuecos = useCallback((huecos: Hueco[]) => onCambiar(p.key, { huecos }), [onCambiar, p.key])
  if (editando) {
    return (
      <EditorParrafo
        inicial={{ texto: p.texto, huecos: p.huecos, tema: p.tema }}
        temas={temas}
        textoBoton="Aplicar"
        onCancelar={() => setEditando(false)}
        onGuardar={(x) => {
          onCambiar(p.key, { texto: x.texto, huecos: x.huecos, tema: x.tema || p.tema })
          setEditando(false)
        }}
      />
    )
  }
  const pagina = p.ia?.pagina ?? p.ia?.diapositiva
  return (
    <div
      className={`rounded-2xl bg-white px-3 py-2.5 transition-opacity ${p.incluir ? '' : 'opacity-45'}`}
      style={{ border: `2px solid ${p.ia?.dudoso ? '#D9A441' : 'rgba(44,62,80,0.18)'}` }}
      data-parrafo={p.key}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={p.incluir}
          onChange={(e) => onCambiar(p.key, { incluir: e.target.checked })}
          aria-label="Incluir este párrafo"
          className="mt-1.5 h-4 w-4 shrink-0 accent-[#E8A598]"
        />
        <div className="min-w-0 flex-1">
          <ParrafoHuecos texto={p.texto} huecos={p.huecos} onChange={cambiarHuecos} nivel={nivel} editable={p.incluir} onAviso={onAviso} />
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.7rem] text-[#7D8A96]">
            <ResumenHuecos huecos={p.huecos} />
            {pagina ? <span>{p.ia?.diapositiva ? 'Diapositiva' : 'Pág.'} {pagina}</span> : null}
            {p.ia?.dudoso ? (
              <span className="rounded-md bg-[#FBF3E1] px-1.5 py-0.5 font-bold text-[#8A6418]" title="La revisión no lo encuentra bien en el documento: compruébalo">
                Revisar
              </span>
            ) : null}
            <span className="ml-auto flex gap-1">
              <button type="button" onClick={() => setEditando(true)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAF7F4] hover:text-[#2C3E50]">
                Editar texto
              </button>
              <button type="button" onClick={() => onQuitar(p.key)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAEAED] hover:text-[#B04A5E]">
                Quitar
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

export function VistaPreviaResumenes({
  inicial,
  nombreGrupo,
  modo,
  fuente,
  persistir,
  alGuardar,
  onVolver,
  onCerrar,
}: {
  inicial: ParrafoBorrador[]
  nombreGrupo: string
  modo: ModoResumen
  fuente: { nombre?: string; unidad?: 'pagina' | 'diapositiva' }
  persistir: (lista: ParrafoBorrador[]) => void
  alGuardar: () => void
  onVolver?: () => void
  onCerrar: () => void
}) {
  const [lista, setLista] = useState(inicial)
  const [nivel, setNivel] = useState<Nivel>(2)
  const [plegados, setPlegados] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const porLibro = lista.some((p) => p.grupo)
  const [destino, setDestino] = useState<Destino>(porLibro ? 'porTema' : 'nuevo')
  const [nombre, setNombre] = useState(nombreGrupo)
  const [grupos, setGrupos] = useState<GrupoResumen[] | null>(null)
  const [elegido, setElegido] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<Hecho | null>(null)

  // El borrador se guarda (con un respiro) a cada cambio.
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    const t = setTimeout(() => persistir(lista), 400)
    return () => clearTimeout(t)
  }, [lista, persistir])

  useEffect(() => {
    if (destino !== 'existente' || grupos) return
    void listarGrupos()
      .then((g) => {
        setGrupos(g)
        setElegido((x) => x || g[0]?.id || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los grupos'))
  }, [destino, grupos])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const cambiar = useCallback((key: string, cambio: Partial<ParrafoBorrador>) => {
    setLista((ls) => ls.map((p) => (p.key === key ? { ...p, ...cambio } : p)))
  }, [])
  const quitar = useCallback((key: string) => setLista((ls) => ls.filter((p) => p.key !== key)), [])

  // Por bloque del libro (si lo hay) y, dentro, por tema; en el orden en que llegaron.
  const bloques = useMemo(() => {
    const out: { grupo: string; temas: { tema: string; parrafos: ParrafoBorrador[] }[] }[] = []
    for (const p of lista) {
      const g = p.grupo ?? ''
      let b = out.find((x) => x.grupo === g)
      if (!b) out.push((b = { grupo: g, temas: [] }))
      let t = b.temas.find((x) => x.tema === p.tema)
      if (!t) b.temas.push((t = { tema: p.tema, parrafos: [] }))
      t.parrafos.push(p)
    }
    return out
  }, [lista])
  const temas = useMemo(() => [...new Set(lista.map((p) => p.tema))], [lista])
  const marcados = lista.filter((p) => p.incluir)
  const huecosMarcados = marcados.reduce((n, p) => n + p.huecos.length, 0)
  const porNivel = NIVELES.map((n) => marcados.reduce((c, p) => c + p.huecos.filter((h) => h.n === n).length, 0))

  const aNuevo = (p: ParrafoBorrador): ParrafoNuevo => {
    const pagina = p.ia?.pagina ?? p.ia?.diapositiva
    return {
      tema: p.tema,
      modo,
      texto: p.texto,
      huecos: p.huecos,
      ...(fuente.nombre || pagina
        ? { origen: { ...(fuente.nombre ? { name: fuente.nombre } : {}), ...(pagina ? { page: pagina, unit: p.ia?.diapositiva ? 'diapositiva' : 'pagina' } : {}) } }
        : {}),
    }
  }

  /** El grupo con ese nombre: se crea o, si ya existe, se usa. */
  const grupoDe = async (name: string, existentes: GrupoResumen[] | null): Promise<GrupoResumen> => {
    try {
      return await crearGrupo(name)
    } catch (e) {
      const ya = (existentes ?? (await listarGrupos())).find((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase())
      if (ya) return ya
      throw e
    }
  }

  const guardar = async () => {
    if (!marcados.length || guardando) return
    setError(null)
    try {
      const r: Hecho = { grupos: [], creados: 0, duplicados: 0 }
      if (destino === 'porTema') {
        const nombres = [...new Set(marcados.map((p) => p.grupo ?? nombreGrupo))]
        const todos = await listarGrupos()
        for (const [k, g] of nombres.entries()) {
          setGuardando(`Tema ${k + 1} de ${nombres.length}…`)
          const grupo = await grupoDe(g.slice(0, 80), todos)
          const x = await anadirParrafos(grupo.id, marcados.filter((p) => (p.grupo ?? nombreGrupo) === g).map(aNuevo), true)
          r.grupos.push({ id: grupo.id, name: grupo.name })
          r.creados += x.creados
          r.duplicados += x.duplicados
        }
      } else {
        setGuardando('Guardando…')
        const grupo =
          destino === 'nuevo'
            ? await grupoDe(nombre.trim(), null)
            : (grupos ?? []).find((g) => g.id === elegido) ?? null
        if (!grupo) throw new Error('Elige un grupo')
        const x = await anadirParrafos(grupo.id, marcados.map(aNuevo), true, (n) => setGuardando(`Guardando ${n} de ${marcados.length}…`))
        r.grupos.push({ id: grupo.id, name: grupo.name })
        r.creados = x.creados
        r.duplicados = x.duplicados
      }
      setHecho(r)
      alGuardar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }

  if (hecho) {
    const uno = hecho.grupos.length === 1 ? hecho.grupos[0] : null
    return (
      <div className="px-6 pb-6">
        <div className="rounded-2xl bg-white p-5 text-center" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
          <span className="material-symbols-outlined text-[40px] text-[#5E8C5A]">task_alt</span>
          <p className="mt-1 text-lg font-extrabold text-[#2C3E50]">
            {hecho.creados} {hecho.creados === 1 ? 'párrafo guardado' : 'párrafos guardados'}
          </p>
          {hecho.duplicados > 0 && (
            <p className="text-sm text-[#7D8A96]">
              {hecho.duplicados} {hecho.duplicados === 1 ? 'ya estaba' : 'ya estaban'} en el grupo y no se ha{hecho.duplicados === 1 ? '' : 'n'} repetido.
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {uno ? (
              <>
                <Link
                  href={`/resumenes/${uno.id}?estudiar=1`}
                  className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-extrabold text-white"
                  style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                >
                  Empezar a estudiar
                </Link>
                <Link href={`/resumenes/${uno.id}`} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
                  Abrir «{uno.name}»
                </Link>
              </>
            ) : (
              hecho.grupos.map((g) => (
                <Link key={g.id} href={`/resumenes/${g.id}`} className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
                  {g.name}
                </Link>
              ))
            )}
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#7D8A96]/15 px-6 pb-3 text-xs text-[#7D8A96]">
        <span className="font-bold text-[#2C3E50]">
          {marcados.length} de {lista.length} párrafos · {huecosMarcados} huecos
        </span>
        <span className="flex gap-1">
          {NIVELES.map((n, k) => (
            <span key={n} className="rounded-md px-1.5 py-0.5 font-extrabold" style={{ background: LEVEL_INFO[n].soft, color: LEVEL_INFO[n].color }}>
              {porNivel[k]} {LEVEL_INFO[n].name.toLowerCase()}
            </span>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-2">
          Nivel al marcar <NivelNuevo nivel={nivel} onChange={setNivel} />
        </span>
      </div>
      <p className="px-6 pt-2 text-[0.72rem] text-[#7D8A96]">
        Toca una palabra o selecciona un trozo para taparlo; toca un hueco para cambiar su nivel o quitarlo.
        {modo === 'literal' ? ' Texto original: «[…]» marca lo que se ha saltado del documento.' : ''}
      </p>
      {aviso && <p className="px-6 pt-1 text-xs font-bold text-[#B04A5E]">{aviso}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
        {bloques.map((b) => (
          <section key={b.grupo || '-'} className="mb-4">
            {b.grupo ? <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-[#2C3E50]">{b.grupo}</h3> : null}
            {b.temas.map((t) => {
              const clave = `${b.grupo}|${t.tema}`
              const plegado = plegados.has(clave)
              return (
                <div key={clave} className="mb-3">
                  <button
                    type="button"
                    onClick={() => setPlegados((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n })}
                    className="mb-1.5 flex w-full items-center gap-2 text-left"
                    aria-expanded={!plegado}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">{plegado ? 'chevron_right' : 'expand_more'}</span>
                    <span className="font-extrabold text-[#2C3E50]">{t.tema}</span>
                    <span className="text-xs text-[#7D8A96]">
                      {t.parrafos.filter((p) => p.incluir).length}/{t.parrafos.length}
                    </span>
                  </button>
                  {!plegado && (
                    <div className="flex flex-col gap-2 pl-6">
                      {t.parrafos.map((p) => (
                        <Tarjeta key={p.key} p={p} nivel={nivel} temas={temas} onCambiar={cambiar} onQuitar={quitar} onAviso={setAviso} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
        {lista.length === 0 && <p className="py-8 text-center text-sm text-[#7D8A96]">No queda ningún párrafo.</p>}
      </div>

      <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Guardar en</span>
          {porLibro && (
            <label className="flex items-center gap-1.5 font-semibold text-[#2C3E50]">
              <input type="radio" checked={destino === 'porTema'} onChange={() => setDestino('porTema')} className="accent-[#E8A598]" />
              Un grupo por tema del libro
            </label>
          )}
          <label className="flex items-center gap-1.5 font-semibold text-[#2C3E50]">
            <input type="radio" checked={destino === 'nuevo'} onChange={() => setDestino('nuevo')} className="accent-[#E8A598]" />
            Grupo nuevo
          </label>
          <label className="flex items-center gap-1.5 font-semibold text-[#2C3E50]">
            <input type="radio" checked={destino === 'existente'} onChange={() => setDestino('existente')} className="accent-[#E8A598]" />
            Grupo que ya tengo
          </label>
        </div>
        <div className="mt-2">
          {destino === 'nuevo' && (
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.slice(0, 80))}
              aria-label="Nombre del grupo nuevo"
              className="w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
            />
          )}
          {destino === 'existente' &&
            (grupos === null ? (
              <p className="text-xs text-[#7D8A96]">Cargando tus grupos…</p>
            ) : grupos.length === 0 ? (
              <p className="text-xs text-[#7D8A96]">Aún no tienes grupos de resúmenes.</p>
            ) : (
              <select
                value={elegido}
                onChange={(e) => setElegido(e.target.value)}
                aria-label="Grupo existente"
                className="w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none"
              >
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.total})
                  </option>
                ))}
              </select>
            ))}
        </div>
        {error && <p className="mt-2 text-sm font-bold text-[#B04A5E]">{error}</p>}
        <div className="mt-3 flex items-center justify-end gap-3">
          {onVolver && (
            <button type="button" onClick={onVolver} className="mr-auto text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
              ← Otros ajustes
            </button>
          )}
          <button type="button" onClick={onCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
            Cerrar (queda el borrador)
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!marcados.length || !!guardando || (destino === 'nuevo' && nombre.trim().length < 3) || (destino === 'existente' && !elegido)}
            className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            {guardando ?? `Guardar ${marcados.length} párrafos`}
          </button>
        </div>
      </footer>
    </>
  )
}
