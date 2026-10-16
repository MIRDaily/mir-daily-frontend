'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import MoverACarpeta from '@/components/carpetas/MoverACarpeta'
import MoverVarios from '@/components/carpetas/MoverVarios'
import { cargarArbol, cargarSinClasificar, moverACarpeta } from '@/lib/carpetas/api'
import { nombreCarpeta, type AsignaturaCatalogo, type Carpeta } from '@/lib/carpetas/sugerir'
import { cuentaDe, rutaCarpeta, sugerenciaDe, textoCuenta, type ElementoMaterial } from '@/lib/carpetas/biblioteca'
import { Estado, FilaElemento, Hero, INK, SectionLabel, StickerButton, StickerCard, TEXTURA_LOMOS } from '@/components/library/biblioteca/ui'

// «Sin clasificar» (§6): lo que no tiene carpeta. Cada elemento tiene «Mover a…» y, si el emparejador ve
// a qué tema se parece (título, temas de sus tarjetas o párrafos, documento de origen), un atajo de un
// clic «¿A Reumatología › Lupus?». Selección múltiple para mover varios a la vez. NUNCA se mueve nada solo.

const clave = (e: Pick<ElementoMaterial, 'tipo' | 'id'>) => `${e.tipo}:${e.id}`
const mismas = (a: Carpeta, b: Carpeta) => a.subjectId === b.subjectId && a.topicId === b.topicId

export default function SinClasificarPage() {
  const { setBackAction } = useHeaderUI()
  const [arbol, setArbol] = useState<AsignaturaCatalogo[] | null>(null)
  const [elementos, setElementos] = useState<ElementoMaterial[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [moverUno, setMoverUno] = useState<ElementoMaterial | null>(null)
  const [moverVarios, setMoverVarios] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; carpeta: Carpeta } | null>(null)
  const casillaTodas = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBackAction({ label: 'Biblioteca', href: '/library', current: 'Sin clasificar' })
    return () => setBackAction(null)
  }, [setBackAction])

  useEffect(() => {
    let vivo = true
    Promise.all([cargarArbol(), cargarSinClasificar()])
      .then(([a, e]) => {
        if (!vivo) return
        setArbol(a)
        setElementos(e)
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se pudo cargar'))
    return () => {
      vivo = false
    }
  }, [])

  // La sugerencia se calcula al abrir, en el navegador y sin coste (lib/carpetas/sugerir.ts).
  const sugerencias = useMemo(() => {
    const m = new Map<string, Carpeta>()
    if (!arbol || !elementos) return m
    for (const e of elementos) {
      const s = sugerenciaDe(arbol, e)
      if (s) m.set(clave(e), s)
    }
    return m
  }, [arbol, elementos])

  const lista = elementos ?? []
  const elegidos = lista.filter((e) => seleccion.has(clave(e)))
  const todas = lista.length > 0 && elegidos.length === lista.length
  useEffect(() => {
    if (casillaTodas.current) casillaTodas.current.indeterminate = elegidos.length > 0 && !todas
  }, [elegidos.length, todas])

  // Si todos los seleccionados comparten sugerencia, el diálogo la ofrece como atajo.
  const sugerenciaComun = useMemo(() => {
    const ss = elegidos.map((e) => sugerencias.get(clave(e)) ?? null)
    return ss.length > 0 && ss.every((s) => s && ss[0] && mismas(s, ss[0])) ? ss[0] : null
  }, [elegidos, sugerencias])

  const quitar = (claves: string[], carpeta: Carpeta) => {
    const fuera = new Set(claves)
    setElementos((prev) => prev?.filter((e) => !fuera.has(clave(e))) ?? prev)
    setSeleccion((prev) => new Set([...prev].filter((k) => !fuera.has(k))))
    const n = claves.length
    setAviso({ texto: `${n === 1 ? 'Movido' : `${n} movidos`} a ${nombreCarpeta(arbol, carpeta, { corto: true })}`, carpeta })
  }

  const aceptarSugerencia = async (e: ElementoMaterial, c: Carpeta) => {
    setOcupado(clave(e))
    setError(null)
    try {
      await moverACarpeta(e.tipo, [e.id], c, 'sugerencia')
      quitar([clave(e)], c)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover')
    } finally {
      setOcupado(null)
    }
  }

  const alternar = (k: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (s.has(k)) s.delete(k)
      else s.add(k)
      return s
    })

  const cuenta = cuentaDe(lista)

  return (
    <main className={`min-h-screen bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] sm:px-6 [@media(max-height:850px)]:py-5 ${elegidos.length ? 'pb-28' : ''}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Hero
          badge="Biblioteca"
          badgeIcon="inbox"
          title="Sin clasificar"
          subtitle={
            elementos === null
              ? 'Buscando lo que no tiene carpeta…'
              : lista.length
                ? `${textoCuenta(cuenta)}. Muévelos a su asignatura o tema: allí se ven junto a sus preguntas MIR.`
                : 'Nada por ordenar: todo tu material está en su carpeta.'
          }
          backdrop={<div className="pointer-events-none absolute inset-0" style={TEXTURA_LOMOS} />}
        />

        {aviso ? (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#8BA888] bg-[#EAF1E9] px-4 py-2.5 text-sm font-bold text-[#3F5E3C]">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span className="min-w-0 flex-1">{aviso.texto}</span>
            {aviso.carpeta.subjectId !== null ? (
              <Link href={rutaCarpeta(aviso.carpeta.subjectId, aviso.carpeta.topicId)} className="font-black underline-offset-2 hover:underline">
                Ver la carpeta
              </Link>
            ) : null}
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-[#5C7A59] hover:text-[#2C3E50]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm font-bold text-[#B04A5E]">{error}</p> : null}

        {elementos === null && !error ? <Estado>Cargando…</Estado> : null}

        {lista.length > 0 ? (
          <StickerCard as="section" className="flex flex-col gap-3 p-4 sm:p-5" depth={5}>
            <label className="flex cursor-pointer items-center gap-2 self-start text-sm font-extrabold text-[#2C3E50]">
              <input
                ref={casillaTodas}
                type="checkbox"
                checked={todas}
                onChange={() => setSeleccion(todas ? new Set() : new Set(lista.map(clave)))}
                aria-label="Seleccionar todo"
              />
              {elegidos.length ? `${elegidos.length} ${elegidos.length === 1 ? 'seleccionado' : 'seleccionados'}` : 'Seleccionar todo'}
            </label>
            <SectionLabel>{lista.length} sin carpeta</SectionLabel>
            <ul className="flex flex-col gap-2">
              {lista.map((e) => {
                const k = clave(e)
                const s = sugerencias.get(k)
                return (
                  <FilaElemento
                    key={k}
                    e={e}
                    inicio={<input type="checkbox" checked={seleccion.has(k)} onChange={() => alternar(k)} aria-label={`Seleccionar «${e.titulo}»`} />}
                    extra={
                      s && arbol ? (
                        <button
                          type="button"
                          disabled={ocupado !== null}
                          onClick={() => void aceptarSugerencia(e, s)}
                          className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[#E8A598]/60 bg-[#FCEFEC] px-2.5 py-0.5 text-[11px] font-extrabold text-[#C97D6F] hover:border-[#E8A598] disabled:opacity-50"
                          title="Moverlo ahí con un clic"
                        >
                          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                          {ocupado === k ? 'Moviendo…' : `¿A ${nombreCarpeta(arbol, s, { corto: true })}?`}
                        </button>
                      ) : null
                    }
                    acciones={
                      <button
                        type="button"
                        onClick={() => setMoverUno(e)}
                        className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-extrabold text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#2C3E50]"
                      >
                        <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                        Mover a…
                      </button>
                    }
                  />
                )
              })}
            </ul>
          </StickerCard>
        ) : null}
      </div>

      {/* Con algo seleccionado, una barra flotante abajo: la cabecera global es «sticky» (y alta en móvil),
          así que una barra fija arriba quedaría tapada. */}
      {elegidos.length ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-white py-2 pr-2 pl-4" style={{ boxShadow: `4px 4px 0 0 ${INK}` }} role="region" aria-label="Selección">
            <span className="min-w-0 flex-1 truncate text-sm font-black text-[#2C3E50]">
              {elegidos.length} {elegidos.length === 1 ? 'seleccionado' : 'seleccionados'}
            </span>
            <button type="button" onClick={() => setSeleccion(new Set())} className="shrink-0 text-xs font-extrabold text-[#7D8A96] hover:text-[#2C3E50]">
              Quitar
            </button>
            <StickerButton icon="drive_file_move" disabled={!arbol} onClick={() => setMoverVarios(true)} className="!px-4 !py-2">
              Mover a…
            </StickerButton>
          </div>
        </div>
      ) : null}
      {moverUno ? (
        <MoverACarpeta
          tipo={moverUno.tipo}
          id={moverUno.id}
          titulo={moverUno.titulo}
          actual={moverUno.carpeta}
          onClose={() => setMoverUno(null)}
          onMovido={(c) => quitar([clave(moverUno)], c)}
        />
      ) : null}
      {moverVarios ? (
        <MoverVarios
          seleccion={elegidos.map(({ tipo, id }) => ({ tipo, id }))}
          sugerida={sugerenciaComun}
          onClose={() => setMoverVarios(false)}
          onMovidos={(ids, c) => {
            const movidos = new Set(ids)
            quitar(elegidos.filter((e) => movidos.has(e.id)).map(clave), c)
          }}
        />
      ) : null}
    </main>
  )
}
