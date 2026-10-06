'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMap } from '@/lib/mapas/api'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { iaGenerar } from '@/lib/mapas/ia/api'
import {
  NODOS_POR_RAIZ,
  ExtractError,
  IAError,
  type EstadoIA,
  type Extraido,
  type ModoIA,
} from '@/lib/mapas/ia/types'

// Diálogo «Crear con IA»: elegir archivo → leerlo en el navegador → ajustes
// (título y estilo de los nodos) → generar → abrir el mapa en el editor.
// El archivo no se sube: solo viaja su texto, y nada se guarda hasta que el
// mapa se ha generado bien.

type Fase = 'elegir' | 'leyendo' | 'ajustes' | 'generando'

const MODOS: { id: ModoIA; titulo: string; descripcion: string; ejemplo: string[] }[] = [
  {
    id: 'esquema',
    titulo: 'Esquemático',
    descripcion: 'Mapa compacto por bloques: cada enfermedad con sus datos clave.',
    ejemplo: ['Hipotiroidismo primario', 'Etiología: autoinmune, antiperoxidasa', 'Diagnóstico: TSH alta con T4L baja'],
  },
  {
    id: 'detalle',
    titulo: 'Con más contenido',
    descripcion: 'Los mismos bloques, con más datos por enfermedad: cifras, criterios, fármacos.',
    ejemplo: [
      'Hipotiroidismo primario',
      'Marcador: antiperoxidasa positivos en más del 90%',
      'Tratamiento: levotiroxina 1,6 µg/kg/día en ayunas',
    ],
  },
]

const fmt = (n: number) => n.toLocaleString('es-ES')

export default function CrearConIA({
  estado,
  onClose,
}: {
  estado: EstadoIA
  onClose: () => void
}) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>('elegir')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [extraido, setExtraido] = useState<Extraido | null>(null)
  const [titulo, setTitulo] = useState('')
  const [modo, setModo] = useState<ModoIA>('esquema')
  // Opción «Incluir tablas»: solo si el servidor la ofrece.
  const [tablas, setTablas] = useState(false)
  const conTablas = !!estado.opciones?.tablas && tablas
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const montado = useRef(true)

  const { maxChars, maxPaginas } = estado.limites
  const restantes = Math.max(0, estado.cupo.maxGeneracionesDia - estado.cupo.generacionesHoy)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      abortRef.current?.abort()
    }
  }, [])

  const cerrar = useCallback(() => {
    if (fase === 'generando') return // no se cierra a medias: el servidor ya está trabajando
    onClose()
  }, [fase, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cerrar])

  useEffect(() => {
    if (fase !== 'generando') return
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [fase])

  const leer = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setArchivo(file)
    setFase('leyendo')
    setProgreso(null)
    try {
      const r = await extraerDocumento(file, {
        maxChars,
        onProgreso: (hecho, total) => montado.current && setProgreso({ hecho, total }),
      })
      if (!montado.current) return
      setExtraido(r)
      setTitulo(r.titulo)
      setFase('ajustes')
    } catch (e) {
      if (!montado.current) return
      setError(e instanceof ExtractError ? e.message : 'No se pudo leer el archivo.')
      setFase('elegir')
    }
  }

  const excedeTexto = !!extraido && extraido.caracteres > maxChars
  const excedePaginas = !!extraido && extraido.paginas > maxPaginas
  const sinCupo = restantes === 0
  const puedeGenerar = !!extraido && !excedeTexto && !excedePaginas && !sinCupo && titulo.trim().length > 0

  const generar = async () => {
    if (!extraido || !puedeGenerar) return
    setError(null)
    setSegundos(0)
    setFase('generando')
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      const r = await iaGenerar(
        {
          titulo: titulo.trim(),
          modo,
          secciones: extraido.secciones,
          paginas: extraido.paginas,
          ...(conTablas ? { tablas: true as const } : {}),
        },
        ctl.signal,
      )
      const id = await createMap(r.titulo, r.doc)
      if (!montado.current) return
      router.push(`/mapas/${id}?ia=1`)
    } catch (e) {
      if (!montado.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof IAError || e instanceof Error ? e.message : 'No se pudo generar el mapa')
      setFase('ajustes')
    }
  }

  const nodosAprox = extraido ? Math.max(5, Math.round(NODOS_POR_RAIZ[modo] * Math.sqrt(extraido.caracteres))) : 0
  const segMin = extraido ? Math.max(5, Math.round(extraido.caracteres / 6000)) : 0
  const segMax = extraido ? Math.max(10, Math.round(extraido.caracteres / 3500)) : 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crear-ia-titulo"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-[#FAF7F4] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <h2 id="crear-ia-titulo" className="flex items-center gap-2 text-xl font-extrabold text-[#2C3E50]">
              <span className="material-symbols-outlined text-[24px] text-[#E8A598]">auto_awesome</span>
              Crear mapa con IA
            </h2>
            <p className="mt-1 text-sm text-[#7D8A96]">Convierte un PDF, Word o PowerPoint en un mapa mental.</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            disabled={fase === 'generando'}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-[#7D8A96] transition-colors hover:bg-white hover:text-[#2C3E50] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <div className="overflow-y-auto px-6 pb-6">
          {error && (
            <div role="alert" className="mb-4 rounded-2xl border border-[#D4667A]/30 bg-[#FAEAED] px-4 py-3 text-sm font-medium text-[#B04A5E]">
              {error}
            </div>
          )}

          {(fase === 'elegir' || fase === 'leyendo') && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={FORMATOS_ACEPTADOS}
                className="hidden"
                onChange={(e) => {
                  void leer(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                disabled={fase === 'leyendo'}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setArrastrando(true)
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastrando(false)
                  void leer(e.dataTransfer.files?.[0])
                }}
                className={`flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                  arrastrando ? 'border-[#E8A598] bg-[#FCEFEC]' : 'border-[#7D8A96]/30 bg-white hover:border-[#E8A598]'
                } disabled:cursor-wait`}
              >
                {fase === 'leyendo' ? (
                  <>
                    <span className="material-symbols-outlined animate-pulse text-[40px] text-[#E8A598]">description</span>
                    <span className="font-bold text-[#2C3E50]">Leyendo {archivo?.name}…</span>
                    {progreso && progreso.total > 1 && (
                      <span className="text-sm text-[#7D8A96]">
                        Página {progreso.hecho} de {progreso.total}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[40px] text-[#E8A598]">upload_file</span>
                    <span className="font-bold text-[#2C3E50]">Elige un archivo o suéltalo aquí</span>
                    <span className="text-sm text-[#7D8A96]">PDF con texto, Word (.docx) o PowerPoint (.pptx)</span>
                  </>
                )}
              </button>
              <ul className="mt-4 space-y-1 text-xs text-[#7D8A96]">
                <li>
                  Máximo {fmt(maxChars)} caracteres de texto (unas {Math.round(maxChars / 3000)} páginas de apuntes) y {maxPaginas} páginas.
                </li>
                <li>Hoy te quedan {restantes} de {estado.cupo.maxGeneracionesDia} mapas con IA.</li>
              </ul>
            </>
          )}

          {(fase === 'ajustes' || fase === 'generando') && extraido && (
            <div className={fase === 'generando' ? 'pointer-events-none opacity-50' : ''}>
              <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                <span className="material-symbols-outlined text-[28px] text-[#E8A598]">description</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#2C3E50]">{archivo?.name}</p>
                  <p className="text-xs text-[#7D8A96]">
                    {fmt(extraido.paginas)} {extraido.unidad ?? 'página'}
                    {extraido.paginas === 1 ? '' : 's'} · {fmt(extraido.caracteres)} caracteres
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExtraido(null)
                    setArchivo(null)
                    setError(null)
                    setFase('elegir')
                  }}
                  className="text-xs font-bold text-[#7D8A96] hover:text-[#E8A598]"
                >
                  Cambiar
                </button>
              </div>

              {extraido.avisos.map((a) => (
                <p key={a} className="mt-2 text-xs font-medium text-[#B07A1E]">
                  {a}
                </p>
              ))}
              {excedeTexto && (
                <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">
                  Supera el máximo de {fmt(maxChars)} caracteres. Divide el documento por temas y genera un mapa de cada parte.
                </p>
              )}
              {excedePaginas && (
                <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">
                  Tiene más de {maxPaginas} páginas. Divídelo por temas.
                </p>
              )}

              <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-[#7D8A96]" htmlFor="ia-titulo">
                Título del mapa
              </label>
              <input
                id="ia-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value.slice(0, 120))}
                className="mt-1 w-full rounded-2xl border border-[#7D8A96]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
              />

              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Estilo de los nodos</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Estilo de los nodos">
                {MODOS.map((m) => {
                  const activo = modo === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setModo(m.id)}
                      className={`rounded-2xl border-2 bg-white p-3 text-left transition-colors ${
                        activo ? 'border-[#E8A598]' : 'border-transparent hover:border-[#7D8A96]/30'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[#2C3E50]">{m.titulo}</span>
                        <span
                          className={`size-4 rounded-full border-2 ${activo ? 'border-[#E8A598] bg-[#E8A598]' : 'border-[#7D8A96]/40'}`}
                        />
                      </span>
                      <span className="mt-0.5 block text-xs text-[#7D8A96]">{m.descripcion}</span>
                      <span className="mt-2 flex flex-col gap-1">
                        {m.ejemplo.map((t) => (
                          <span key={t} className="rounded-lg bg-[#F1F3F5] px-2 py-1 text-[11px] font-medium text-[#2C3E50]">
                            {t}
                          </span>
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>

              {estado.opciones?.tablas && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={tablas}
                    onChange={(e) => setTablas(e.target.checked)}
                    style={{ accentColor: '#E8A598', width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    <span className="block text-sm font-extrabold text-[#2C3E50]">Incluir tablas</span>
                    <span className="mt-0.5 block text-xs text-[#7D8A96]">
                      La IA rehace, con los datos del texto, las tablas que comparan enfermedades (diagnóstico
                      diferencial, tablas resumen) y los criterios con puntos. No copia imágenes: lo que solo esté en
                      una imagen no se lee. Revisa las tablas que salgan de un PDF: sus columnas llegan desordenadas.
                    </span>
                  </span>
                </label>
              )}

              <p className="mt-4 text-xs text-[#7D8A96]">
                Saldrán unos {fmt(nodosAprox)} nodos y tardará {segMin}–{segMax} segundos. Hoy te quedan {restantes} de{' '}
                {estado.cupo.maxGeneracionesDia} mapas.
              </p>
              {sinCupo && (
                <p role="alert" className="mt-1 text-sm font-bold text-[#B04A5E]">
                  Has llegado al máximo de mapas con IA de hoy. Vuelve mañana.
                </p>
              )}
            </div>
          )}

          {fase === 'generando' && (
            <div className="mt-4 rounded-2xl bg-white px-4 py-4" role="status" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F3F5]">
                <div
                  className="h-full w-1/3 rounded-full bg-[#E8A598]"
                  style={{ animation: 'ia-barra 1.4s ease-in-out infinite' }}
                />
              </div>
              <p className="mt-3 text-sm font-bold text-[#2C3E50]">Generando el mapa… {segundos} s</p>
              <p className="text-xs text-[#7D8A96]">No cierres esta ventana. Al terminar se abrirá el editor.</p>
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort()
                  setError('Generación cancelada. Si el servidor ya estaba trabajando, esta generación cuenta en tu cupo de hoy.')
                  setFase('ajustes')
                }}
                className="pointer-events-auto mt-2 text-xs font-bold text-[#7D8A96] hover:text-[#B04A5E]"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {(fase === 'ajustes' || fase === 'generando') && (
          <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
            <p className="mb-3 text-[11px] leading-relaxed text-[#7D8A96]">
              El archivo no se guarda. Su texto se envía a un servicio de IA externo (DeepSeek) solo para generar el mapa. La IA
              puede equivocarse: revisa el resultado antes de estudiar con él.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cerrar}
                disabled={fase === 'generando'}
                className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void generar()}
                disabled={!puedeGenerar || fase === 'generando'}
                className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d18d80] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                {fase === 'generando' ? 'Generando…' : 'Generar mapa'}
              </button>
            </div>
          </footer>
        )}
      </div>
      <style>{`@keyframes ia-barra{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  )
}
