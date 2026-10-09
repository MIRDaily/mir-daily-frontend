'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { NIVELES, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import type { FuenteFirmada, ModoResumen, ParrafoBorrador } from '@/lib/resumenes/borrador'
import {
  anadirParrafos,
  anadirParrafosIA,
  buscarParecidos,
  crearGrupo,
  listarGrupos,
  type GrupoResumen,
  type Parecido,
  type ParrafoNuevo,
  type UsoLiteral,
} from '@/lib/resumenes/api'
import { excesosLiteral, literalPorDocumento, seGuarda, tandasDeGuardado } from '@/lib/resumenes/guardado'
import { INK, NivelNuevo, ParrafoHuecos, ResumenHuecos } from './ParrafoHuecos'
import { EditorParrafo } from './EditorParrafo'

// Vista previa de los resúmenes activos con IA: por tema y párrafo. Se puede quitar un párrafo (o
// desmarcarlo), editar su texto, tocar una palabra o seleccionar un trozo para crear un hueco, tocar un
// hueco para cambiar su nivel o quitarlo. Cada cambio se guarda en el borrador (IndexedDB) con
// `persistir`. Al final se guarda en un grupo nuevo o en uno que ya existe (sin duplicar: lo valida el
// servidor) o, tema a tema, uno por tema del libro.
//
// Informe 82: al elegir un grupo que ya existe, los párrafos casi iguales a uno suyo se marcan («Ya
// tienes uno parecido») y no se guardan salvo «Incluir igual»; y en «Texto original» se avisa ANTES de
// guardar si lo copiado de un documento pasaría del 30 % de su texto en ese grupo (el servidor lo
// comprueba igual).

type Destino = 'nuevo' | 'existente' | 'porTema'
type Hecho = { grupos: { id: string; name: string }[]; creados: number; duplicados: number; parecidos: number }

const fmt = (n: number) => n.toLocaleString('es-ES')
const mismoNombre = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const Tarjeta = memo(function Tarjeta({
  p,
  nivel,
  temas,
  parecido,
  onCambiar,
  onQuitar,
  onAviso,
}: {
  p: ParrafoBorrador
  nivel: Nivel
  temas: string[]
  parecido: Parecido | null | undefined
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
  const entra = seGuarda(p, parecido)
  return (
    <div
      className={`rounded-2xl bg-white px-3 py-2.5 transition-opacity ${p.incluir ? '' : 'opacity-45'}`}
      style={{ border: `2px solid ${parecido ? '#7D8A96' : p.ia?.dudoso ? '#D9A441' : 'rgba(44,62,80,0.18)'}` }}
      data-parrafo={p.key}
      {...(parecido ? { 'data-parecido': parecido.igual ? 'igual' : 'parecido' } : {})}
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
          {/* Con un parecido que no se va a guardar, se atenúa el párrafo pero no el aviso ni su botón. */}
          <div className={p.incluir && !entra ? 'opacity-50' : ''}>
            <ParrafoHuecos texto={p.texto} huecos={p.huecos} onChange={cambiarHuecos} nivel={nivel} editable={p.incluir} onAviso={onAviso} />
          </div>
          {parecido && p.incluir ? (
            <div className="mt-2 rounded-xl bg-[#F2EFED] px-2.5 py-1.5 text-[0.72rem] text-[#2C3E50]">
              <p className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#7D8A96]">content_copy</span>
                <b>{parecido.igual ? 'Ya está en el grupo' : 'Ya tienes uno parecido'}</b>
                {parecido.tema ? <span className="text-[#7D8A96]">en «{parecido.tema}»</span> : null}
                {parecido.igual ? (
                  <span className="text-[#7D8A96]">· no se guardará</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCambiar(p.key, { incluirParecido: !p.incluirParecido })}
                    className="ml-auto rounded-lg px-2 py-0.5 font-bold"
                    style={{ border: `1.5px solid ${INK}`, background: p.incluirParecido ? '#E8A598' : '#fff', color: p.incluirParecido ? '#fff' : INK }}
                    aria-pressed={!!p.incluirParecido}
                  >
                    {p.incluirParecido ? 'Se incluirá igual' : 'Incluir igual'}
                  </button>
                )}
              </p>
              <p className="mt-1 line-clamp-2 italic text-[#7D8A96]" title={parecido.texto}>
                «{parecido.texto}»
              </p>
            </div>
          ) : null}
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
  fuentes,
  persistir,
  alGuardar,
  onVolver,
  onCerrar,
}: {
  inicial: ParrafoBorrador[]
  nombreGrupo: string
  modo: ModoResumen
  fuente: { nombre?: string; unidad?: 'pagina' | 'diapositiva' }
  /** Las fuentes firmadas (vacío en un borrador de antes del informe 82: se guarda por la ruta de siempre). */
  fuentes: FuenteFirmada[]
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
  // Lo que dice el servidor del grupo de destino: los parecidos (por párrafo) y el literal de cada documento (por grupo).
  const [parecidos, setParecidos] = useState<Map<string, Parecido | null>>(new Map())
  const [usos, setUsos] = useState<Map<string, UsoLiteral[]>>(new Map())
  const [comprobando, setComprobando] = useState(false)

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

  // Los grupos se cargan siempre: «Grupo nuevo» con el nombre de uno que ya existe lo reutiliza.
  useEffect(() => {
    void listarGrupos()
      .then((g) => {
        setGrupos(g)
        setElegido((x) => x || g[0]?.id || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los grupos'))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const cambiar = useCallback((key: string, cambio: Partial<ParrafoBorrador>) => {
    setLista((ls) => ls.map((p) => (p.key === key ? { ...p, ...cambio } : p)))
  }, [])
  const quitar = useCallback((key: string) => setLista((ls) => ls.filter((p) => p.key !== key)), [])

  /** El grupo (que ya existe) al que iría cada párrafo, o null si va a uno nuevo. */
  const grupoExistenteDe = useCallback(
    (p: ParrafoBorrador): GrupoResumen | null => {
      if (!grupos) return null
      if (destino === 'existente') return grupos.find((g) => g.id === elegido) ?? null
      const n = destino === 'porTema' ? (p.grupo ?? nombreGrupo).slice(0, 80) : nombre
      return grupos.find((g) => mismoNombre(g.name, n)) ?? null
    },
    [grupos, destino, elegido, nombre, nombreGrupo],
  )

  // Qué se compara con cada grupo: los textos (no los «incluir»: marcar o desmarcar no vuelve a preguntar).
  const consulta = useMemo(() => {
    const porGrupo = new Map<string, ParrafoBorrador[]>()
    for (const p of lista) {
      const g = grupoExistenteDe(p)
      if (!g) continue
      const xs = porGrupo.get(g.id)
      if (xs) xs.push(p)
      else porGrupo.set(g.id, [p])
    }
    const firma = [...porGrupo].map(([id, ps]) => `${id}:${ps.map((p) => `${p.key}=${p.texto.length}`).join(',')}`).join('|')
    return { porGrupo, firma }
  }, [lista, grupoExistenteDe])

  useEffect(() => {
    if (!consulta.porGrupo.size) {
      setParecidos(new Map())
      setUsos(new Map())
      return
    }
    let vivo = true
    const t = setTimeout(() => {
      setComprobando(true)
      void (async () => {
        const nuevos = new Map<string, Parecido | null>()
        const nuevosUsos = new Map<string, UsoLiteral[]>()
        try {
          for (const [id, ps] of consulta.porGrupo) {
            const docs = new Set(ps.map((p) => p.doc).filter(Boolean))
            const r = await buscarParecidos(id, ps.map((p) => p.texto), fuentes.filter((f) => docs.has(f.hash)))
            ps.forEach((p, k) => nuevos.set(p.key, r.parecidos[k] ?? null))
            nuevosUsos.set(id, r.literal)
          }
          if (!vivo) return
          setParecidos(nuevos)
          setUsos(nuevosUsos)
        } catch {
          // Sin la comprobación se puede guardar igual: el servidor no guarda los casi iguales ni pasa del tope.
        } finally {
          if (vivo) setComprobando(false)
        }
      })()
    }, 350)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // La firma resume `porGrupo`: no hace falta repetir la consulta si no cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta.firma, fuentes])

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
  const marcados = lista.filter((p) => seGuarda(p, parecidos.get(p.key)))
  const huecosMarcados = marcados.reduce((n, p) => n + p.huecos.length, 0)
  const porNivel = NIVELES.map((n) => marcados.reduce((c, p) => c + p.huecos.filter((h) => h.n === n).length, 0))
  const nParecidos = lista.filter((p) => p.incluir && parecidos.get(p.key)).length

  // «Texto original»: lo que se pasaría del 30 % de su documento en cada grupo de destino.
  const excesos = useMemo(() => {
    const out: { grupo: string; hash: string; usado: number; tope: number; nuevos: number; sobran: number }[] = []
    for (const [id, ps] of consulta.porGrupo) {
      const nombreG = grupos?.find((g) => g.id === id)?.name ?? ''
      for (const e of excesosLiteral(literalPorDocumento(ps, modo, parecidos), usos.get(id) ?? [])) out.push({ grupo: nombreG, ...e })
    }
    return out
  }, [consulta.porGrupo, grupos, modo, parecidos, usos])

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
    const ya = existentes?.find((g) => mismoNombre(g.name, name))
    if (ya) return ya
    try {
      return await crearGrupo(name)
    } catch (e) {
      const otra = (await listarGrupos()).find((g) => mismoNombre(g.name, name))
      if (otra) return otra
      throw e
    }
  }

  /** Guarda unos párrafos en un grupo: con su documento de origen si lo hay; si no (borrador antiguo), como siempre. */
  const guardarEn = async (grupo: GrupoResumen, ps: ParrafoBorrador[], progreso?: (n: number) => void) => {
    if (fuentes.length) {
      const r = await anadirParrafosIA(grupo.id, tandasDeGuardado(ps, aNuevo, fuentes, parecidos), progreso)
      return r
    }
    const r = await anadirParrafos(grupo.id, ps.filter((p) => seGuarda(p, parecidos.get(p.key))).map(aNuevo), true, progreso)
    return { ...r, parecidos: 0 }
  }

  const guardar = async () => {
    if (!marcados.length || guardando || excesos.length) return
    setError(null)
    try {
      const r: Hecho = { grupos: [], creados: 0, duplicados: 0, parecidos: 0 }
      const sumar = (x: { creados: number; duplicados: number; parecidos: number }) => {
        r.creados += x.creados
        r.duplicados += x.duplicados
        r.parecidos += x.parecidos
      }
      if (destino === 'porTema') {
        const nombres = [...new Set(marcados.map((p) => p.grupo ?? nombreGrupo))]
        const todos = await listarGrupos()
        for (const [k, g] of nombres.entries()) {
          setGuardando(`Tema ${k + 1} de ${nombres.length}…`)
          const grupo = await grupoDe(g.slice(0, 80), todos)
          sumar(await guardarEn(grupo, lista.filter((p) => (p.grupo ?? nombreGrupo) === g)))
          r.grupos.push({ id: grupo.id, name: grupo.name })
        }
      } else {
        setGuardando('Guardando…')
        const grupo = destino === 'nuevo' ? await grupoDe(nombre.trim(), grupos) : ((grupos ?? []).find((g) => g.id === elegido) ?? null)
        if (!grupo) throw new Error('Elige un grupo')
        sumar(await guardarEn(grupo, lista, (n) => setGuardando(`Guardando ${n} de ${marcados.length}…`)))
        r.grupos.push({ id: grupo.id, name: grupo.name })
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
          {hecho.parecidos > 0 && (
            <p className="text-sm text-[#7D8A96]">
              {hecho.parecidos} {hecho.parecidos === 1 ? 'se parecía' : 'se parecían'} a uno que ya tenías y no se ha{hecho.parecidos === 1 ? '' : 'n'} guardado.
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
      {nParecidos > 0 && (
        <p className="px-6 pt-1 text-[0.72rem] font-semibold text-[#2C3E50]" data-aviso-parecidos>
          {nParecidos === 1 ? 'Uno se parece' : `${nParecidos} se parecen`} a párrafos que ya tienes en el grupo: no se guardarán salvo que marques «Incluir igual».
        </p>
      )}
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
                      {t.parrafos.filter((p) => seGuarda(p, parecidos.get(p.key))).length}/{t.parrafos.length}
                    </span>
                  </button>
                  {!plegado && (
                    <div className="flex flex-col gap-2 pl-6">
                      {t.parrafos.map((p) => (
                        <Tarjeta key={p.key} p={p} nivel={nivel} temas={temas} parecido={parecidos.get(p.key)} onCambiar={cambiar} onQuitar={quitar} onAviso={setAviso} />
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
          {comprobando && <span className="text-xs text-[#7D8A96]">Comprobando el grupo…</span>}
        </div>
        <div className="mt-2">
          {destino === 'nuevo' && (
            <>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.slice(0, 80))}
                aria-label="Nombre del grupo nuevo"
                className="w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
              />
              {grupos?.some((g) => mismoNombre(g.name, nombre)) && (
                <p className="mt-1 text-xs text-[#7D8A96]">Ya tienes un grupo con ese nombre: se añadirán a él.</p>
              )}
            </>
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
        {excesos.map((e) => (
          <p key={`${e.grupo}:${e.hash}`} role="alert" className="mt-2 rounded-xl bg-[#FAEAED] px-3 py-2 text-[0.78rem] font-semibold text-[#B04A5E]" data-aviso-tope>
            Texto original: de este documento ya hay {fmt(e.usado)} caracteres en «{e.grupo}» y estos párrafos añaden {fmt(e.nuevos)}; el máximo es {fmt(e.tope)} (el 30 % del
            documento). Quita párrafos (sobran {fmt(e.sobran)} caracteres) o guárdalos en otro grupo.
          </p>
        ))}
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
            disabled={!marcados.length || !!guardando || excesos.length > 0 || (destino === 'nuevo' && nombre.trim().length < 3) || (destino === 'existente' && !elegido)}
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
