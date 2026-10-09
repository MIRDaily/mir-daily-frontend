'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { aplicarEvento, arbolLibro, type EstadoTema, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { construirIndice, resumenSeleccion } from '@/lib/mapas/ia/indice'
import { entradasDeTemas, temasParaEnviar, type TemaIndice } from '@/lib/mapas/ia/libro'
import { ExtractError, IAError, type Extraido } from '@/lib/mapas/ia/types'
import { ProgresoIA } from '@/components/mapas/ia/ProgresoIA'
import { SelectorParte } from '@/components/mapas/ia/SelectorParte'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { supabase } from '@/lib/supabaseBrowser'
import { NIVELES, type Nivel } from '@/lib/resumenes/huecos'
import { borrarBorrador, guardarBorrador, type BorradorResumen, type ModoResumen, type ParrafoBorrador } from '@/lib/resumenes/borrador'
import { DENSIDADES, MODOS, parrafosAprox, resumenesIAGenerar, resumenesIAIndice, type Densidad, type EstadoResumenesIA } from '@/lib/resumenes/ia'
import { INK } from './ParrafoHuecos'
import { VistaPreviaResumenes } from './VistaPreviaResumenes'

// «Resúmenes activos con IA» desde un documento (PDF, Word, PowerPoint): el mismo camino que las
// flashcards (el archivo se lee en el navegador y no se sube; «Qué parte usar»; tema a tema con el
// índice; niveles; cantidad; progreso en directo) más el MODO: «Resumen» (la IA condensa) o «Texto
// original» (la IA elige párrafos del documento tal cual). Al final, la VISTA PREVIA editable, con
// borrador en este navegador. Nada se guarda hasta aprobarla.

type Fase = 'elegir' | 'leyendo' | 'ajustes' | 'generando' | 'vista'
type ProgresoTema = { titulo: string; estado: EstadoTema | 'espera' }
type Resultado = { titulo: string; modo: ModoResumen; lista: ParrafoBorrador[]; fallidos: string[]; fuente: BorradorResumen['fuente']; creado?: number }

const fmt = (n: number) => n.toLocaleString('es-ES')

const DESCRIPCION_NIVEL: Record<Nivel, string> = {
  1: 'Lo nuclear: definición, causa, clínica típica.',
  2: 'Diagnóstico y tratamiento de elección, asociaciones.',
  3: 'Cifras, criterios, segunda línea, diferenciales.',
  4: 'Letra pequeña y trampas MIR.',
}

export default function CrearResumenesIA({
  estado: estadoDado,
  borrador,
  onClose,
}: {
  estado: EstadoResumenesIA | null
  /** Retomar la revisión de un borrador guardado en este navegador (no hace falta la IA). */
  borrador?: BorradorResumen
  onClose: () => void
}) {
  const estado: EstadoResumenesIA = estadoDado ?? {
    disponible: false, niveles: [], densidades: [], modos: [],
    limites: { maxChars: 0, maxPaginas: 0 },
    cupo: { generacionesHoy: 0, maxGeneracionesDia: 0, caracteresHoy: 0, maxCaracteresDia: 0 },
  }
  const [fase, setFase] = useState<Fase>(borrador ? 'vista' : 'elegir')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [extraido, setExtraido] = useState<Extraido | null>(null)
  const [titulo, setTitulo] = useState('')
  const [modo, setModo] = useState<ModoResumen>('resumen')
  const [niveles, setNiveles] = useState<Nivel[]>([...NIVELES])
  const [densidad, setDensidad] = useState<Densidad>('normal')
  const [derechos, setDerechos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [faseIA, setFaseIA] = useState<FaseIA>('leyendo')
  const [lineas, setLineas] = useState<LineaProvisional[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [temasLibro, setTemasLibro] = useState<TemaIndice[] | null>(null)
  const [cargandoIndice, setCargandoIndice] = useState(false)
  const [progresoTemas, setProgresoTemas] = useState<ProgresoTema[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(
    borrador ? { titulo: borrador.titulo, modo: borrador.modo, lista: borrador.lista, fallidos: borrador.fallidos, fuente: borrador.fuente, creado: borrador.creado } : null,
  )
  const [usuario, setUsuario] = useState<string | null>(borrador?.usuario ?? null)
  useEffect(() => {
    if (usuario) return
    void supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user.id ?? null))
  }, [usuario])

  const persistir = useCallback(
    (lista: ParrafoBorrador[], r?: Resultado) => {
      const base = r ?? resultado
      if (!usuario || !base) return
      void guardarBorrador({
        usuario,
        titulo: base.titulo,
        nombreGrupo: borrador?.nombreGrupo ?? base.titulo.slice(0, 80),
        modo: base.modo,
        fuente: base.fuente,
        lista,
        fallidos: base.fallidos,
        ...(base.creado ? { creado: base.creado } : {}),
      })
    },
    [usuario, resultado, borrador],
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const montado = useRef(true)
  const porTemas = !!temasLibro

  const { maxChars, maxPaginas } = estado.limites
  const restantes = Math.max(0, estado.cupo.maxGeneracionesDia - estado.cupo.generacionesHoy)
  const charsRestantesHoy = Math.max(0, estado.cupo.maxCaracteresDia - estado.cupo.caracteresHoy)
  const topeLectura = Math.max(maxChars * 4, estado.limites.maxCharsLibro ?? 0)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      abortRef.current?.abort()
    }
  }, [])

  // En la vista previa no se cierra con Escape ni clicando fuera: se perdería el trabajo de revisión.
  const cerrar = useCallback(() => {
    if (fase === 'generando' || fase === 'vista') return
    onClose()
  }, [fase, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
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
      const r = await extraerDocumento(file, { maxChars: topeLectura, onProgreso: (hecho, total) => montado.current && setProgreso({ hecho, total }) })
      if (!montado.current) return
      setExtraido(r)
      setTitulo(r.titulo)
      setTemasLibro(null)
      const cabe = r.caracteres <= maxChars && r.paginas <= maxPaginas
      setSel(cabe ? new Set(r.secciones.map((_, i) => i)) : new Set())
      setSelectorAbierto(!cabe)
      setFase('ajustes')
    } catch (e) {
      if (!montado.current) return
      setError(e instanceof ExtractError ? e.message : 'No se pudo leer el archivo.')
      setFase('elegir')
    }
  }

  const indiceLocal = useMemo(() => (extraido ? construirIndice(extraido.secciones, extraido.marcadores) : []), [extraido])
  const indice = useMemo(() => (extraido && temasLibro ? entradasDeTemas(temasLibro, extraido.secciones) : indiceLocal), [extraido, temasLibro, indiceLocal])
  const eleccion = useMemo(() => (extraido ? resumenSeleccion(extraido.secciones, sel) : null), [extraido, sel])
  const envioLibro = useMemo(() => (extraido && temasLibro ? temasParaEnviar(extraido.secciones, sel, temasLibro) : null), [extraido, temasLibro, sel])
  const todoElegido = !!extraido && sel.size === extraido.secciones.length
  const caracteres = envioLibro ? envioLibro.caracteres : (eleccion?.caracteres ?? 0)
  const paginasElegidas = !extraido
    ? 0
    : envioLibro
      ? resumenSeleccion(envioLibro.secciones, new Set(envioLibro.secciones.map((_, i) => i))).paginas
      : todoElegido
        ? extraido.paginas
        : (eleccion?.paginas ?? 0)
  const documentoGrande = !!extraido && (extraido.caracteres > maxChars || extraido.paginas > maxPaginas)
  const ofrecerLibro =
    !!estado.opciones?.libro && !!extraido && (documentoGrande || indiceLocal.filter((e) => e.nivel === 1 && !e.key.startsWith('inicio')).length >= 2)
  const maxCharsUsado = porTemas ? (estado.limites.maxCharsLibro ?? maxChars) : maxChars
  const maxPaginasUsado = porTemas ? (estado.limites.maxPaginasLibro ?? maxPaginas) : maxPaginas
  const nadaElegido = !!extraido && caracteres < 200
  const excedeTexto = caracteres > maxCharsUsado
  const excedePaginas = paginasElegidas > maxPaginasUsado
  const excedeTemas = !!envioLibro && envioLibro.temas.length > (estado.limites.maxTemas ?? 40)
  const excedeCupoChars = caracteres > charsRestantesHoy
  const sinCupo = restantes === 0
  const puedeGenerar =
    !!extraido && !nadaElegido && !excedeTexto && !excedePaginas && !excedeTemas && !excedeCupoChars && !sinCupo && !cargandoIndice && niveles.length > 0 && titulo.trim().length > 0 && derechos

  const aprox = envioLibro
    ? envioLibro.temas.reduce((n, t) => n + parrafosAprox(envioLibro.secciones.slice(t.desde, t.hasta + 1).reduce((c, s) => c + s.texto.length, 0), densidad, modo), 0)
    : parrafosAprox(caracteres, densidad, modo)

  const activarTemas = async () => {
    if (!extraido) return
    setError(null)
    setCargandoIndice(true)
    try {
      const temas = await resumenesIAIndice({ titulo: titulo.trim() || extraido.titulo, secciones: extraido.secciones })
      if (!montado.current) return
      if (temas.length < 1) throw new IAError('La IA no encontró temas en este documento. Elige una parte a mano.')
      const nuevo = new Set<number>()
      for (const t of temas) for (let i = t.desde; i <= t.hasta; i++) nuevo.add(i)
      setTemasLibro(temas)
      setSel(nuevo)
      setSelectorAbierto(true)
    } catch (e) {
      if (montado.current) setError(e instanceof Error ? e.message : 'No se pudo sacar el índice')
    } finally {
      if (montado.current) setCargandoIndice(false)
    }
  }

  const alternarNivel = (n: Nivel) => setNiveles((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n].sort()))

  const generar = async () => {
    if (!extraido || !puedeGenerar) return
    setError(null)
    setSegundos(0)
    setFaseIA('leyendo')
    setLineas([])
    setProgresoTemas([])
    setFase('generando')
    const ctl = new AbortController()
    abortRef.current = ctl
    const onEvento = (e: Parameters<NonNullable<Parameters<typeof resumenesIAGenerar>[2]>>[0]) => {
      if (!montado.current || ctl.signal.aborted) return
      if (e.tipo === 'fase') setFaseIA(e.fase)
      else if (e.tipo === 'rama' || e.tipo === 'reinicio') setLineas((ls) => aplicarEvento(ls, e))
      else if (e.tipo === 'temas') setProgresoTemas(e.temas.map((t) => ({ titulo: t.titulo, estado: 'espera' })))
      else if (e.tipo === 'tema') setProgresoTemas((ps) => ps.map((p, i) => (i === e.i ? { ...p, estado: e.estado } : p)))
    }
    const comun = {
      titulo: titulo.trim(),
      modo,
      niveles,
      densidad,
      paginas: Math.max(1, paginasElegidas),
      ...(extraido.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
    }
    try {
      const r = envioLibro
        ? await resumenesIAGenerar({ ...comun, secciones: envioLibro.secciones, temas: envioLibro.temas }, ctl.signal, onEvento)
        : await resumenesIAGenerar({ ...comun, secciones: eleccion?.elegidas ?? [] }, ctl.signal, onEvento)
      if (!montado.current) return
      const lista = 'temas' in r ? r.temas.flatMap((t) => t.parrafos) : r.parrafos
      if (lista.length === 0) throw new IAError('La IA no devolvió párrafos válidos. Prueba con otra parte del documento.')
      const nuevo: Resultado = {
        titulo: r.titulo,
        modo,
        lista,
        fallidos: 'temas' in r ? r.fallidos.map((f) => `${f.titulo}: ${f.motivo}`) : [],
        fuente: {
          ...(archivo ? { nombre: archivo.name.slice(0, 160) } : {}),
          ...(extraido.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
        },
      }
      setResultado(nuevo)
      // Guardado ya (antes de tocar nada): una recarga a mitad de revisión no lo pierde.
      persistir(lista, nuevo)
      setFase('vista')
    } catch (e) {
      if (!montado.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'No se pudieron generar los resúmenes')
      setFase('ajustes')
    }
  }

  const resumenParte = !extraido
    ? ''
    : envioLibro
      ? `${fmt(envioLibro.temas.length)} de ${fmt(temasLibro?.length ?? 0)} temas · ${fmt(caracteres)} caracteres`
      : todoElegido
        ? `Todo el documento · ${fmt(caracteres)} caracteres`
        : sel.size === 0
          ? 'Nada marcado'
          : `${fmt(eleccion?.elegidas.length ?? 0)} de ${fmt(extraido.secciones.length)} ${extraido.unidad === 'diapositiva' ? 'diapositivas' : 'secciones'} · ${fmt(caracteres)} caracteres`

  const ancho = fase === 'vista' ? 'max-w-4xl' : 'max-w-xl'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ra-ia-titulo"
        className={`flex max-h-[92dvh] w-full ${ancho} flex-col overflow-hidden rounded-3xl bg-[#FAF7F4]`}
        style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div className="min-w-0">
            <h2 id="ra-ia-titulo" className="flex items-center gap-2 text-xl font-extrabold text-[#2C3E50]">
              <span aria-hidden className="inline-block text-[#E8A598]">
                <span className="material-symbols-outlined text-[24px] leading-none">auto_awesome</span>
              </span>
              {fase === 'vista' ? 'Revisa los resúmenes' : 'Resúmenes activos con IA'}
            </h2>
            <p className="mt-1 truncate text-sm text-[#7D8A96]">
              {fase === 'vista' && resultado
                ? `${resultado.titulo} · ${resultado.modo === 'literal' ? 'texto original' : 'resumen'}`
                : 'De un PDF, Word o PowerPoint: párrafos de repaso con huecos, por tema.'}
            </p>
          </div>
          <button
            type="button"
            onClick={fase === 'vista' ? onClose : cerrar}
            disabled={fase === 'generando'}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-[#7D8A96] transition-colors hover:bg-white hover:text-[#2C3E50] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        {fase === 'vista' && resultado ? (
          <>
            {resultado.fallidos.length > 0 && (
              <div className="mx-6 mb-3 rounded-xl bg-[#FAEAED] px-3 py-2 text-[0.78rem] text-[#B04A5E]">
                <p className="font-extrabold">No salieron {resultado.fallidos.length === 1 ? 'este tema' : `estos ${resultado.fallidos.length} temas`}:</p>
                <ul className="mt-1 list-disc pl-5">
                  {resultado.fallidos.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <VistaPreviaResumenes
              inicial={resultado.lista}
              nombreGrupo={(borrador?.nombreGrupo ?? resultado.titulo).slice(0, 80)}
              modo={resultado.modo}
              fuente={resultado.fuente}
              persistir={persistir}
              alGuardar={() => usuario && void borrarBorrador(usuario)}
              {...(extraido
                ? {
                    onVolver: () => {
                      setResultado(null)
                      setFase('ajustes')
                    },
                  }
                : {})}
              onCerrar={onClose}
            />
          </>
        ) : (
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
                  data-resumen-archivo
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
                    Máximo {fmt(maxChars)} caracteres de texto (unas {Math.round(maxChars / 3000)} páginas de apuntes); un documento más largo, tema a tema.
                  </li>
                  <li>
                    Hoy te quedan {restantes} de {estado.cupo.maxGeneracionesDia} generaciones de resúmenes.
                  </li>
                </ul>
              </>
            )}

            {(fase === 'ajustes' || fase === 'generando') && extraido && (
              <div className={fase === 'generando' ? 'hidden' : ''}>
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

                <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Modo</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modo">
                  {MODOS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={modo === m.id}
                      onClick={() => setModo(m.id)}
                      className="rounded-2xl bg-white p-3 text-left"
                      style={{ border: `2px solid ${modo === m.id ? '#E8A598' : 'transparent'}` }}
                    >
                      <span className="block text-sm font-extrabold text-[#2C3E50]">
                        {m.titulo}
                        {m.id === 'resumen' ? <span className="ml-1 text-[0.68rem] font-bold text-[#7D8A96]">(por defecto)</span> : null}
                      </span>
                      <span className="block text-[0.74rem] text-[#7D8A96]">{m.descripcion}</span>
                    </button>
                  ))}
                </div>

                {documentoGrande && !porTemas && (
                  <p className="mt-3 rounded-xl bg-[#FBF3E1] px-3 py-2 text-[0.8rem] font-semibold text-[#8A6418]">
                    El documento tiene {fmt(extraido.caracteres)} caracteres y de una vez caben {fmt(maxChars)}.{' '}
                    {ofrecerLibro ? 'Hazlo tema a tema o elige qué parte usar.' : 'Elige qué parte usar.'}
                  </p>
                )}
                {ofrecerLibro && (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3" style={{ border: `2px solid ${porTemas ? '#E8A598' : INK}` }}>
                    <span aria-hidden className="inline-block text-[#E8A598]">
                      <span className="material-symbols-outlined text-[1.4rem] leading-none">library_books</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-[#2C3E50]">Tema a tema</span>
                      <span className="block text-xs text-[#7D8A96]">
                        {porTemas
                          ? `${temasLibro?.length ?? 0} temas encontrados. Cada uno da sus párrafos y puede ir a su propio grupo.`
                          : 'Primero la IA saca el índice (unos segundos) y luego hace cada tema por separado.'}
                      </span>
                    </span>
                    {porTemas ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTemasLibro(null)
                          const cabe = extraido.caracteres <= maxChars && extraido.paginas <= maxPaginas
                          setSel(cabe ? new Set(extraido.secciones.map((_, i) => i)) : new Set())
                        }}
                        className="text-xs font-bold text-[#7D8A96] hover:text-[#B04A5E]"
                      >
                        Quitar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void activarTemas()}
                        disabled={cargandoIndice}
                        className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
                        style={{ background: '#E8A598', border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                      >
                        {cargandoIndice ? 'Sacando el índice…' : 'Sacar el índice'}
                      </button>
                    )}
                  </div>
                )}
                <SelectorParte
                  secciones={extraido.secciones}
                  indice={indice}
                  sel={sel}
                  onChange={setSel}
                  unidad={extraido.unidad ?? 'página'}
                  abierto={selectorAbierto}
                  onAbrir={setSelectorAbierto}
                  resumen={resumenParte}
                />
                {excedeTexto && (
                  <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">
                    Lo marcado tiene {fmt(caracteres)} caracteres: el máximo {porTemas ? 'tema a tema' : 'de una vez'} es {fmt(maxCharsUsado)}. Desmarca alguna parte.
                  </p>
                )}
                {excedePaginas && (
                  <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">
                    Lo marcado tiene más de {maxPaginasUsado} páginas. Desmarca alguna parte.
                  </p>
                )}
                {excedeTemas && (
                  <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">
                    Como mucho {estado.limites.maxTemas ?? 40} temas de una vez. Desmarca alguno.
                  </p>
                )}
                {!excedeTexto && excedeCupoChars && (
                  <p role="alert" className="mt-2 text-sm font-bold text-[#B04A5E]">
                    Hoy te quedan {fmt(charsRestantesHoy)} caracteres de IA y lo marcado tiene {fmt(caracteres)}. Marca menos o vuelve mañana.
                  </p>
                )}

                <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-[#7D8A96]" htmlFor="ra-ia-nombre">
                  {porTemas ? 'Nombre del documento' : 'Nombre del grupo'}
                </label>
                <input
                  id="ra-ia-nombre"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value.slice(0, 80))}
                  className="mt-1 w-full rounded-2xl border border-[#7D8A96]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
                />

                <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Dificultad de los huecos</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label="Niveles de los huecos">
                  {NIVELES.map((n) => {
                    const on = niveles.includes(n)
                    return (
                      <label key={n} className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-white px-3 py-2.5" style={{ border: `2px solid ${on ? LEVEL_INFO[n].color : 'transparent'}` }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => alternarNivel(n)}
                          style={{ accentColor: LEVEL_INFO[n].color, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                        />
                        <span className="min-w-0">
                          <span className="rounded-md px-1.5 py-0.5 text-[0.7rem] font-extrabold" style={{ background: LEVEL_INFO[n].soft, color: LEVEL_INFO[n].color }}>
                            {LEVEL_INFO[n].name}
                          </span>
                          <span className="mt-1 block text-xs text-[#7D8A96]">{DESCRIPCION_NIVEL[n]}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {niveles.length === 0 && <p className="mt-1 text-xs font-bold text-[#B04A5E]">Marca al menos un nivel.</p>}

                <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Cantidad</p>
                <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cantidad de párrafos">
                  {DENSIDADES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={densidad === d.id}
                      onClick={() => setDensidad(d.id)}
                      className="rounded-2xl bg-white p-2.5 text-left"
                      style={{ border: `2px solid ${densidad === d.id ? '#E8A598' : 'transparent'}` }}
                    >
                      <span className="block text-sm font-extrabold text-[#2C3E50]">{d.titulo}</span>
                      <span className="block text-[0.72rem] text-[#7D8A96]">{d.descripcion}</span>
                    </button>
                  ))}
                </div>

                {nadaElegido ? (
                  <p className="mt-4 text-xs font-bold text-[#B04A5E]">Marca al menos una parte del documento.</p>
                ) : (
                  <p className="mt-4 text-xs text-[#7D8A96]" aria-live="polite">
                    {fmt(caracteres)} caracteres{envioLibro ? ` en ${fmt(envioLibro.temas.length)} temas` : ''}: saldrán unos {fmt(aprox)} párrafos con sus huecos, por tema. Antes de
                    guardarlos los revisas. Usará {fmt(caracteres)} de los {fmt(charsRestantesHoy)} caracteres que te quedan hoy.
                  </p>
                )}
                {sinCupo && (
                  <p role="alert" className="mt-1 text-sm font-bold text-[#B04A5E]">
                    Has llegado al máximo de generaciones de hoy. Vuelve mañana.
                  </p>
                )}

                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-[0.8rem] text-[#2C3E50]" style={{ border: `2px solid ${derechos ? '#5E8C5A' : 'rgba(44,62,80,0.15)'}` }}>
                  <input type="checkbox" checked={derechos} onChange={(e) => setDerechos(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#5E8C5A]" data-resumen-derechos />
                  <span>
                    <b>Tengo derecho a usar este documento para estudiar</b> (son mis apuntes o material que puedo usar). Los párrafos que salgan son solo para mí: no se
                    comparten ni se reutilizan, y se borran con mi cuenta.
                  </span>
                </label>
              </div>
            )}

            {fase === 'generando' && (
              <>
                <ProgresoIA
                  fases={['leyendo', 'parrafos', 'ordenando']}
                  fase={faseIA}
                  lineas={lineas}
                  segundos={segundos}
                  contador={(ls) => `${ls.filter((l) => l.d > 1).length} párrafos · se revisan al terminar`}
                  {...(porTemas
                    ? {
                        arbol: arbolLibro(lineas, progresoTemas.map((t) => t.titulo)),
                        temas: progresoTemas,
                        detalle: progresoTemas.length ? `Temas: ${progresoTemas.filter((p) => p.estado === 'listo').length} de ${progresoTemas.length} listos` : undefined,
                      }
                    : {})}
                />
                <p className="mt-2 text-xs text-[#7D8A96]">
                  No cierres esta ventana. Al terminar verás los párrafos para revisarlos antes de guardarlos.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      abortRef.current?.abort()
                      setError('Generación cancelada: la IA ha dejado de trabajar y no cuenta en tus generaciones de hoy.')
                      setFase('ajustes')
                    }}
                    className="font-bold text-[#7D8A96] underline hover:text-[#B04A5E]"
                  >
                    Cancelar
                  </button>
                </p>
              </>
            )}
          </div>
        )}

        {fase === 'ajustes' && (
          <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
            <p className="mb-3 text-[11px] leading-relaxed text-[#7D8A96]">
              El archivo no se guarda ni se sube: se lee en tu navegador y su texto se envía a un servicio de IA externo (DeepSeek) solo para hacer los párrafos. En
              «Texto original» se guardan únicamente los párrafos elegidos, cortos. La IA puede equivocarse: los revisas antes de guardarlos.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={cerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void generar()}
                disabled={!puedeGenerar}
                title={!derechos ? 'Confirma que tienes derecho a usar el documento' : undefined}
                className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d18d80] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                {porTemas ? 'Generar los temas' : 'Generar resúmenes'}
              </button>
            </div>
          </footer>
        )}
      </div>
      <style>{`@keyframes ia-barra{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}@keyframes ia-entra{from{opacity:0;transform:translateX(-0.25rem)}to{opacity:1;transform:none}}.ia-prov-entra{animation:ia-entra .25s ease-out}`}</style>
    </div>
  )
}
