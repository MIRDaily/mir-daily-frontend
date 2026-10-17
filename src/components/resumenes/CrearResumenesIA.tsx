'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { aplicarEvento, type EstadoTema, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { construirIndice, resumenSeleccion } from '@/lib/mapas/ia/indice'
import { entradasDeTemas, temasParaEnviar, type TemaIndice } from '@/lib/mapas/ia/libro'
import { ExtractError, IAError, type Extraido } from '@/lib/mapas/ia/types'
import { ProgresoIA } from '@/components/mapas/ia/ProgresoIA'
import { SelectorParte } from '@/components/mapas/ia/SelectorParte'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { supabase } from '@/lib/supabaseBrowser'
import { NIVELES, type Nivel } from '@/lib/resumenes/huecos'
import { hashArchivo } from '@/lib/mapas/ia/docs'
import {
  borrarBorrador,
  guardarBorrador,
  guardarDocumento,
  leerBorrador,
  leerDocumento,
  type BorradorResumen,
  type DocumentoResumen,
  type FuenteFirmada,
  type ModoResumen,
  type ParrafoBorrador,
} from '@/lib/resumenes/borrador'
import {
  DENSIDADES,
  MODOS,
  parrafosAprox,
  resumenesIAGenerar,
  resumenesIAIndice,
  resumenesIAMas,
  resumenesIARehacer,
  type Densidad,
  type EstadoResumenesIA,
} from '@/lib/resumenes/ia'
import { fragmentoDeParrafo, fragmentoDeTema, nivelesDeLista, paginasDeFragmento, rangosDeTemas, temasMarcados } from '@/lib/resumenes/ampliar'
import { seleccionInicial, type PropsEmbebido, type ResultadoGenerar } from '@/lib/ia/embebido'
import { PrecioIA } from '@/components/ia/PrecioIA'
import { useCobroIA, useCreditosIA } from '@/hooks/useCreditosIA'
import { caracteresDocumento, caracteresLibro, claveResumenes, precioIA } from '@/lib/ia/precio'
import { anotarReserva, mensajeErrorIA, nuevaGeneracion, nuevoCobro, refrescarCreditos, type Generacion } from '@/lib/ia/creditos'
import { INK } from './ParrafoHuecos'
import { VistaPreviaResumenes, type MasConfig, type RehacerConfig } from './VistaPreviaResumenes'
import DestinoCarpeta from '@/components/carpetas/DestinoCarpeta'
import { CabeceraCrear, Detalles, FilaDetalle, OpcionAnimada, Opciones, PieCrear, TituloBloque } from '@/components/ia/crear/Kit'
import { EscenaParrafo } from '@/components/ia/crear/Escenas'
import { useCarpeta } from '@/lib/carpetas/useCarpeta'
import { textosDocumento } from '@/lib/carpetas/sugerir'

// «Resúmenes activos con IA» desde un documento (PDF, Word, PowerPoint): el mismo camino que las
// flashcards (el archivo se lee en el navegador y no se sube; «Qué parte usar»; tema a tema con el
// índice; niveles; cantidad; progreso en directo) más el MODO: «Resumen» (la IA condensa) o «Texto
// original» (la IA elige párrafos del documento tal cual). Al final, la VISTA PREVIA editable, con
// borrador en este navegador (uno por archivo: si ya hay uno de este archivo, se avisa antes de
// sustituirlo). Nada se guarda hasta aprobarla.
//
// Con la IA de admin, la vista previa ofrece «Más de este tema» y «Rehacer este párrafo»: para eso el
// TEXTO del documento se guarda con el borrador (solo en este navegador) y, de ahí, viaja solo el
// fragmento del tema o del párrafo. Si no está (un borrador anterior), se pide el archivo otra vez y se
// comprueba con su SHA-256 que es el mismo.

type Fase = 'elegir' | 'leyendo' | 'ajustes' | 'generando' | 'vista'
type ProgresoTema = { titulo: string; estado: EstadoTema | 'espera' }
type Resultado = {
  titulo: string
  modo: ModoResumen
  lista: ParrafoBorrador[]
  fallidos: string[]
  fuente: BorradorResumen['fuente']
  fuentes: FuenteFirmada[]
  creado?: number
  /** Los niveles con que se generó (al retomar un borrador no se saben: los de sus huecos). */
  niveles?: Nivel[]
}
/** El texto del documento para «Más» y «Rehacer». */
type TextoDocumento = Pick<DocumentoResumen, 'secciones' | 'paginas' | 'unidad' | 'temas'>
const textoDe = (d: DocumentoResumen): TextoDocumento => ({
  secciones: d.secciones,
  paginas: d.paginas,
  ...(d.unidad ? { unidad: d.unidad } : {}),
  ...(d.temas ? { temas: d.temas } : {}),
})
const textoDeExtraido = (x: Extraido): TextoDocumento => ({
  secciones: x.secciones,
  paginas: Math.max(1, x.paginas),
  ...(x.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
})
const HEX64 = /^[0-9a-f]{64}$/

/** Sin el texto del documento: elegir otra vez el archivo (se comprueba que es el mismo y no se sube). */
function AvisoArchivo({
  para,
  nombre,
  comprobando,
  error,
  onArchivo,
}: {
  para: string
  nombre?: string
  comprobando: boolean
  error: string | null
  onArchivo: (f: File | undefined) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p>
        Para {para}, vuelve a elegir el archivo{nombre ? <b> «{nombre}»</b> : null}: hace falta el texto del documento y este navegador no lo tiene guardado (un
        borrador anterior, o se ha borrado). Se comprueba que es el mismo y no se sube.
      </p>
      <input
        ref={ref}
        type="file"
        accept={FORMATOS_ACEPTADOS}
        className="hidden"
        onChange={(e) => {
          onArchivo(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={comprobando}
        onClick={() => ref.current?.click()}
        className="mt-2 rounded-lg bg-[#E8A598] px-3 py-1 text-[0.76rem] font-extrabold text-white disabled:opacity-60"
        style={{ border: `2px solid ${INK}` }}
      >
        {comprobando ? 'Comprobando…' : 'Elegir el archivo'}
      </button>
      {error && <p className="mt-1 text-[0.74rem] font-bold text-[#B04A5E]">{error}</p>}
    </div>
  )
}

const deBorrador = (b: BorradorResumen): Resultado => ({ titulo: b.titulo, modo: b.modo, lista: b.lista, fallidos: b.fallidos, fuente: b.fuente, fuentes: b.fuentes, creado: b.creado })

function haceCuanto(ms: number): string {
  const min = Math.round(Math.max(0, Date.now() - ms) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
}

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
  compartido,
  visible = true,
  controlRef,
  onEstado,
  archivoInicial,
}: PropsEmbebido & {
  estado: EstadoResumenesIA | null
  /** Un documento soltado sobre la página: se empieza leyéndolo. */
  archivoInicial?: File
  /** Retomar la revisión de un borrador guardado en este navegador (no hace falta la IA). */
  borrador?: BorradorResumen
  onClose: () => void
}) {
  const embebido = !!compartido
  const estado: EstadoResumenesIA = estadoDado ?? {
    disponible: false, niveles: [], densidades: [], modos: [],
    limites: { maxChars: 0, maxPaginas: 0 },
    cupo: { generacionesHoy: 0, maxGeneracionesDia: 0, caracteresHoy: 0, maxCaracteresDia: 0 },
  }
  // Con el documento compartido del popup unificado, se empieza en los ajustes con lo que cabe marcado.
  const [fase, setFase] = useState<Fase>(borrador ? 'vista' : compartido ? 'ajustes' : archivoInicial ? 'leyendo' : 'elegir')
  const [archivo, setArchivo] = useState<File | null>(compartido?.archivo ?? archivoInicial ?? null)
  const [extraido, setExtraido] = useState<Extraido | null>(compartido?.extraido ?? null)
  const [titulo, setTitulo] = useState(compartido?.extraido.titulo ?? '')
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
  const [sel, setSel] = useState<Set<number>>(() => (compartido ? seleccionInicial(compartido.extraido, estado.limites).sel : new Set()))
  const [selectorAbierto, setSelectorAbierto] = useState(() => (compartido ? seleccionInicial(compartido.extraido, estado.limites).abierto : false))
  const [temasLibro, setTemasLibro] = useState<TemaIndice[] | null>(null)
  const [cargandoIndice, setCargandoIndice] = useState(false)
  const [progresoTemas, setProgresoTemas] = useState<ProgresoTema[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(borrador ? deBorrador(borrador) : null)
  // El archivo elegido (su SHA-256): la clave de su borrador. Y el borrador que ya tenga, si lo hay.
  const [documento, setDocumento] = useState<string | null>(borrador?.documento ?? null)
  const [previo, setPrevio] = useState<BorradorResumen | null>(null)
  const [retomado, setRetomado] = useState<BorradorResumen | null>(borrador ?? null)
  const [usuario, setUsuario] = useState<string | null>(borrador?.usuario ?? null)
  useEffect(() => {
    if (usuario) return
    void supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user.id ?? null))
  }, [usuario])
  // «Más» y «Rehacer»: el texto del documento (el leído ahora o, al retomar, el guardado con el
  // borrador; undefined mientras se busca, null si no está y hay que pedir el archivo).
  const [textoDoc, setTextoDoc] = useState<TextoDocumento | null | undefined>(borrador ? undefined : null)
  const [masUsadas, setMasUsadas] = useState(0)
  const [rehacerUsadas, setRehacerUsadas] = useState(0)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [comprobando, setComprobando] = useState(false)

  // Con el documento compartido no pasa por `leer`: su SHA-256 (la clave de su borrador) y el borrador
  // que ya tenga, si lo hay, se buscan aquí.
  useEffect(() => {
    if (!compartido) return
    let vivo = true
    void (async () => {
      const hash = await hashArchivo(compartido.archivo).catch(() => null)
      if (!vivo || !hash) return
      setDocumento(hash)
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id
      const ya = uid ? await leerBorrador(uid, hash) : null
      if (vivo) setPrevio(ya)
    })()
    return () => {
      vivo = false
    }
  }, [compartido])

  // Al retomar un borrador: su documento, si este navegador lo guarda.
  useEffect(() => {
    if (!borrador) return
    let vivo = true
    void leerDocumento(borrador.usuario, borrador.documento).then((d) => {
      if (vivo) setTextoDoc(d ? textoDe(d) : null)
    })
    return () => {
      vivo = false
    }
  }, [borrador])

  const persistir = useCallback(
    (lista: ParrafoBorrador[], r?: Resultado) => {
      const base = r ?? resultado
      if (!usuario || !base || !documento) return
      void guardarBorrador({
        usuario,
        documento,
        titulo: base.titulo,
        nombreGrupo: retomado?.nombreGrupo ?? base.titulo.slice(0, 80),
        modo: base.modo,
        fuente: base.fuente,
        fuentes: base.fuentes,
        lista,
        fallidos: base.fallidos,
        ...(base.creado ? { creado: base.creado } : {}),
      })
    },
    [usuario, resultado, retomado, documento],
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // La generación en curso (su cobro y el id de la reserva, para «Cancelar»).
  const genRef = useRef<Generacion | null>(null)
  const montado = useRef(true)
  const porTemas = !!temasLibro

  const { maxChars, maxPaginas } = estado.limites
  // Con los créditos encendidos el servidor no manda el cupo de hoy: no limita aquí.
  const cupo = estado.cupo
  const restantes = cupo ? Math.max(0, cupo.maxGeneracionesDia - cupo.generacionesHoy) : Infinity
  const charsRestantesHoy = cupo ? Math.max(0, cupo.maxCaracteresDia - cupo.caracteresHoy) : Infinity
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
    if (embebido) return // el popup unificado gestiona el cierre
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cerrar, embebido])

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
    setDocumento(null)
    setPrevio(null)
    try {
      const [r, hash] = await Promise.all([
        extraerDocumento(file, { maxChars: topeLectura, onProgreso: (hecho, total) => montado.current && setProgreso({ hecho, total }) }),
        hashArchivo(file),
      ])
      if (!montado.current) return
      setDocumento(hash)
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id
      const ya = uid ? await leerBorrador(uid, hash) : null
      if (!montado.current) return
      setPrevio(ya)
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

  // Archivo soltado sobre la página (useSoltarDocumento): se lee en cuanto se abre, sin pasar por «elegir».
  // Una sola vez (en desarrollo, StrictMode monta dos veces) y fuera del cuerpo del efecto.
  const leidoInicial = useRef(false)
  useEffect(() => {
    if (!archivoInicial || leidoInicial.current) return
    leidoInicial.current = true
    void Promise.resolve().then(() => leer(archivoInicial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivoInicial])

  const indiceLocal = useMemo(() => (extraido ? construirIndice(extraido.secciones, extraido.marcadores, extraido.encabezados) : []), [extraido])
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
  // Créditos: lo marcado (tema a tema, un fijo por tema), por modo y con la densidad como factor.
  const tarifaIA = useCreditosIA().tarifa
  const precio = useMemo(() => {
    if (!extraido) return null
    const clave = claveResumenes(modo)
    if (envioLibro) return precioIA(tarifaIA, { clave, densidad, ...caracteresLibro(envioLibro.secciones, envioLibro.temas) })
    return precioIA(tarifaIA, { clave, densidad, caracteres: caracteresDocumento(eleccion?.elegidas ?? []) })
  }, [extraido, envioLibro, eleccion, modo, densidad, tarifaIA])
  const precioMas = useMemo(() => precioIA(tarifaIA, { clave: 'resumenes_mas' }), [tarifaIA])
  const precioRehacer = useMemo(() => precioIA(tarifaIA, { clave: 'resumenes_rehacer' }), [tarifaIA])
  const cobroIA = useCobroIA(precio)
  const puedeGenerar =
    !!extraido && !nadaElegido && !excedeTexto && !excedePaginas && !excedeTemas && !excedeCupoChars && !sinCupo && cobroIA.suficiente && !cargandoIndice && niveles.length > 0 && titulo.trim().length > 0 && derechos && (!compartido || !!documento)

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

  /** Seguir con el borrador que ya había de este archivo (sin gastar IA). */
  const retomarPrevio = () => {
    if (!previo) return
    setRetomado(previo)
    setResultado(deBorrador(previo))
    setFase('vista')
    // Su texto: el guardado (con los temas del libro, si los hubo) o, si no está, el del archivo recién leído.
    const leido = extraido
    setTextoDoc(undefined)
    void leerDocumento(previo.usuario, previo.documento).then((d) => {
      if (!montado.current) return
      if (d) return setTextoDoc(textoDe(d))
      if (!leido) return setTextoDoc(null)
      const t = textoDeExtraido(leido)
      setTextoDoc(t)
      void guardarDocumento(previo.usuario, previo.documento, t)
    })
  }

  const generar = async (): Promise<ResultadoGenerar> => {
    if (!extraido || !puedeGenerar) return 'no'
    if (
      previo &&
      !window.confirm(`Ya tienes un borrador de este documento sin guardar (${previo.lista.length} párrafos, ${haceCuanto(previo.actualizado)}). Si generas de nuevo, se sustituirá. ¿Seguir?`)
    ) {
      return 'no'
    }
    setError(null)
    setSegundos(0)
    setFaseIA('leyendo')
    setLineas([])
    setProgresoTemas([])
    setFase('generando')
    const ctl = new AbortController()
    abortRef.current = ctl
    const gen = nuevaGeneracion(precio)
    genRef.current = gen
    const onEvento = (e: Parameters<NonNullable<Parameters<typeof resumenesIAGenerar>[2]>>[0]) => {
      if (e.tipo === 'reserva') anotarReserva(gen, e)
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
      ...gen.cobro,
    }
    try {
      const r = envioLibro
        ? await resumenesIAGenerar({ ...comun, secciones: envioLibro.secciones, temas: envioLibro.temas }, ctl.signal, onEvento)
        : await resumenesIAGenerar({ ...comun, secciones: eleccion?.elegidas ?? [] }, ctl.signal, onEvento)
      void refrescarCreditos()
      if (!montado.current) return 'cancelado'
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
        fuentes: r.fuentes,
        niveles,
      }
      // El texto del documento, con el borrador (solo en este navegador): «Más» y «Rehacer» lo
      // necesitan también tras recargar. Tema a tema, con el rango de cada tema del libro que salió.
      const temasDoc = 'temas' in r && temasLibro ? rangosDeTemas(temasMarcados(temasLibro, sel), r.temas) : []
      const texto: TextoDocumento = { ...textoDeExtraido(extraido), ...(temasDoc.length ? { temas: temasDoc } : {}) }
      setTextoDoc(texto)
      if (usuario && documento) void guardarDocumento(usuario, documento, texto)
      setRetomado(null)
      setPrevio(null)
      setResultado(nuevo)
      // Guardado ya (antes de tocar nada): una recarga a mitad de revisión no lo pierde.
      persistir(lista, nuevo)
      setFase('vista')
      return 'ok'
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) void refrescarCreditos()
      if (!montado.current) return 'cancelado'
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      setError(mensajeErrorIA(e, 'No se pudieron generar los resúmenes'))
      setFase('ajustes')
      return 'fallo'
    }
  }

  // Como pestaña del popup unificado: el popup lanza la generación (en cola) y pinta el estado.
  useImperativeHandle(controlRef, () => ({ generar }))
  const falta = !extraido
    ? undefined
    : !derechos
      ? 'Marca que tienes derecho a usar el documento.'
      : niveles.length === 0
        ? 'Marca al menos un nivel de los huecos.'
        : nadaElegido
          ? 'Marca al menos una parte del documento.'
          : excedeTexto || excedePaginas || excedeTemas
            ? 'Lo marcado es demasiado grande: desmarca alguna parte.'
            : excedeCupoChars || sinCupo
              ? 'No te queda cupo de IA hoy para esto.'
              : cobroIA.falta
                ? cobroIA.falta
                : titulo.trim().length === 0
                  ? 'Falta el nombre.'
                  : undefined
  const listo = fase === 'ajustes' && puedeGenerar
  useEffect(() => {
    onEstado?.({ fase, listo, ...(falta && fase === 'ajustes' ? { falta } : {}) })
  }, [onEstado, fase, listo, falta])

  const resumenParte = !extraido
    ? ''
    : envioLibro
      ? `${fmt(envioLibro.temas.length)} de ${fmt(temasLibro?.length ?? 0)} temas · ${fmt(caracteres)} caracteres`
      : todoElegido
        ? `Todo el documento · ${fmt(caracteres)} caracteres`
        : sel.size === 0
          ? 'Nada marcado'
          : `${fmt(eleccion?.elegidas.length ?? 0)} de ${fmt(extraido.secciones.length)} ${extraido.unidad === 'diapositiva' ? 'diapositivas' : 'secciones'} · ${fmt(caracteres)} caracteres`

  // Sin el texto del documento (un borrador anterior, o el navegador lo perdió): se pide el archivo y se
  // comprueba con su SHA-256 que es el del borrador (en uno de la versión 1, sin hash, que se llame igual).
  const volverAElegir = async (file: File | undefined) => {
    if (!file || !resultado || !documento) return
    setErrorArchivo(null)
    setComprobando(true)
    try {
      const nombre = resultado.fuente.nombre
      const mismo = HEX64.test(documento) ? (await hashArchivo(file)) === documento : !nombre || file.name === nombre
      if (!mismo) throw new Error(`No es el mismo archivo${nombre ? `: elige «${nombre}»` : ''}.`)
      const r = await extraerDocumento(file, { maxChars: topeLectura })
      if (!montado.current) return
      const texto = textoDeExtraido(r)
      setTextoDoc(texto)
      if (usuario) void guardarDocumento(usuario, documento, texto)
    } catch (e) {
      if (montado.current) setErrorArchivo(e instanceof ExtractError || e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      if (montado.current) setComprobando(false)
    }
  }

  const opcionesIA = estadoDado?.disponible ? estadoDado.opciones : undefined
  const cupoIA = estadoDado?.cupo
  const unidadDoc = textoDoc?.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}
  const bloqueo = (para: string) =>
    textoDoc ? undefined : textoDoc === undefined ? (
      <p className="text-[#7D8A96]">Buscando el documento en este navegador…</p>
    ) : (
      <AvisoArchivo para={para} nombre={resultado?.fuente.nombre} comprobando={comprobando} error={errorArchivo} onArchivo={(f) => void volverAElegir(f)} />
    )
  const bloqueoMas = bloqueo('pedir más')
  const bloqueoRehacer = bloqueo('rehacer un párrafo')
  const mas: MasConfig | undefined =
    opcionesIA?.ampliar && resultado
      ? {
          niveles: resultado.niveles ?? nivelesDeLista(resultado.lista),
          cantidades: opcionesIA.ampliar.cantidades,
          ...(cupoIA?.maxMasDia !== undefined ? { restantes: cupoIA.maxMasDia - (cupoIA.masHoy ?? 0) - masUsadas } : {}),
          precio: precioMas,
          ...(bloqueoMas ? { bloqueo: bloqueoMas } : {}),
          pedir: async ({ grupo, tema, niveles: nv, cantidad, parrafos, vecinos }, signal) => {
            if (!textoDoc) throw new Error('Falta el texto del documento.')
            // Solo el fragmento de ese tema: las páginas de sus párrafos (con margen), dentro de su tema del libro.
            const secciones = fragmentoDeTema(textoDoc, grupo, tema, parrafos)
            const r = await resumenesIAMas(
              {
                titulo: resultado.titulo,
                modo: resultado.modo,
                niveles: nv,
                secciones,
                paginas: paginasDeFragmento(secciones),
                ...unidadDoc,
                ampliar: { tema, cantidad, existentes: parrafos.map((p) => p.texto), vecinos },
                ...nuevoCobro(precioMas),
              },
              signal,
            ).finally(() => void refrescarCreditos())
            setMasUsadas((n) => n + 1)
            return r
          },
        }
      : undefined
  const rehacer: RehacerConfig | undefined =
    opcionesIA?.rehacer && resultado
      ? {
          ...(cupoIA?.maxRehacerDia !== undefined ? { restantes: cupoIA.maxRehacerDia - (cupoIA.rehacerHoy ?? 0) - rehacerUsadas } : {}),
          precio: precioRehacer,
          ...(bloqueoRehacer ? { bloqueo: bloqueoRehacer } : {}),
          pedir: async ({ parrafo, delTema }, signal) => {
            if (!textoDoc) throw new Error('Falta el texto del documento.')
            // Su página ±1 (o, sin página, el fragmento de su tema).
            const secciones = fragmentoDeParrafo(textoDoc, parrafo, delTema)
            const p = await resumenesIARehacer(
              {
                titulo: resultado.titulo,
                modo: resultado.modo,
                secciones,
                paginas: paginasDeFragmento(secciones),
                ...unidadDoc,
                rehacer: { tema: parrafo.tema, texto: parrafo.texto, huecos: parrafo.huecos },
                ...nuevoCobro(precioRehacer),
              },
              signal,
            ).finally(() => void refrescarCreditos())
            setRehacerUsadas((n) => n + 1)
            return p
          },
        }
      : undefined

  const ancho = fase === 'vista' ? 'max-w-4xl' : 'max-w-xl'

  // Carpeta del grupo: se decide aquí y llega ya marcada a la revisión (donde se elige el grupo).
  const carpeta = useCarpeta(
    useMemo(() => textosDocumento(titulo || extraido?.titulo || '', indice.map((e) => e.titulo)), [titulo, extraido, indice]),
    !!extraido,
  )
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null)
  const alternarFila = (id: string) => {
    setSelectorAbierto(false)
    setFilaAbierta((f) => (f === id ? null : id))
  }
  const datosDocumento = extraido
    ? `${fmt(extraido.paginas)} ${extraido.unidad === 'diapositiva' ? 'diapositiva' : 'página'}${extraido.paginas === 1 ? '' : 's'} · ${fmt(extraido.caracteres)} caracteres`
    : ''
  const quitarTemas = () => {
    if (!extraido) return
    setTemasLibro(null)
    const cabe = extraido.caracteres <= maxChars && extraido.paginas <= maxPaginas
    setSel(cabe ? new Set(extraido.secciones.map((_, i) => i)) : new Set())
  }
  const densidadActual = DENSIDADES.find((d) => d.id === densidad)

  const cuerpo = (
    <>
      {!embebido && (
        <CabeceraCrear
          herramienta="resumen"
          idTitulo="ra-ia-titulo"
          titulo={fase === 'vista' ? 'Revisa los resúmenes' : fase === 'generando' ? 'Creando tu resumen…' : 'Nuevo resumen activo'}
          subtitulo={
            fase === 'vista' && resultado
              ? `${resultado.titulo} · ${resultado.modo === 'literal' ? 'texto original' : 'resumen'}`
              : fase === 'generando'
                ? (archivo?.name ?? '')
                : 'Párrafos con los datos clave tapados para recordarlos.'
          }
          documento={fase === 'ajustes' && extraido && archivo ? { nombre: archivo.name, datos: datosDocumento } : null}
          {...(fase === 'ajustes'
            ? {
                onCambiarDocumento: () => {
                  setExtraido(null)
                  setArchivo(null)
                  setDocumento(null)
                  setPrevio(null)
                  setError(null)
                  setFase('elegir')
                },
              }
            : {})}
          {...(fase !== 'generando' ? { onCerrar: fase === 'vista' ? onClose : cerrar } : {})}
        />
      )}

      {fase === 'vista' && resultado ? (
        <>
          {resultado.fallidos.length > 0 && (
            <div className="mx-6 mb-3 mt-3 rounded-xl bg-[#FAEAED] px-3 py-2 text-[0.78rem] text-[#B04A5E]">
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
            nombreGrupo={(retomado?.nombreGrupo ?? resultado.titulo).slice(0, 80)}
            modo={resultado.modo}
            fuente={resultado.fuente}
            fuentes={resultado.fuentes}
            persistir={persistir}
            teclado={visible}
            carpetaInicial={carpeta.arbol ? { valor: carpeta.valor, origen: carpeta.origen } : null}
            alGuardar={() => usuario && documento && void borrarBorrador(usuario, documento)}
            {...(extraido
              ? {
                  onVolver: () => {
                    setResultado(null)
                    setFase('ajustes')
                  },
                }
              : {})}
            onCerrar={onClose}
            {...(mas ? { mas } : {})}
            {...(rehacer ? { rehacer } : {})}
          />
        </>
      ) : (
        <div className="overflow-y-auto px-5 pb-5 pt-4">
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
                className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors disabled:cursor-wait"
                style={{ borderColor: arrastrando ? 'var(--cia-acc-d)' : 'rgba(125,138,150,.3)', background: arrastrando ? 'var(--cia-soft)' : '#fff' }}
              >
                {fase === 'leyendo' ? (
                  <>
                    <span className="material-symbols-outlined animate-pulse text-[40px]" style={{ color: 'var(--cia-acc-d)' }}>description</span>
                    <span className="font-bold text-[#2C3E50]">Leyendo {archivo?.name}…</span>
                    {progreso && progreso.total > 1 && (
                      <span className="text-sm text-[#7D8A96]">
                        Página {progreso.hecho} de {progreso.total}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[40px]" style={{ color: 'var(--cia-acc-d)' }}>upload_file</span>
                    <span className="font-bold text-[#2C3E50]">Elige un archivo o suéltalo aquí</span>
                    <span className="text-sm text-[#7D8A96]">PDF con texto, Word (.docx) o PowerPoint (.pptx)</span>
                  </>
                )}
              </button>
              <ul className="mt-4 space-y-1 text-xs text-[#7D8A96]">
                <li>
                  Máximo {fmt(maxChars)} caracteres de texto (unas {Math.round(maxChars / 3000)} páginas de apuntes); un documento más largo, tema a tema.
                </li>
                {cupo && (
                  <li>
                    Hoy te quedan {restantes} de {cupo.maxGeneracionesDia} generaciones de resúmenes.
                  </li>
                )}
              </ul>
            </>
          )}

          {(fase === 'ajustes' || fase === 'generando') && extraido && (
            <div className={fase === 'generando' ? 'hidden' : 'flex flex-col gap-[18px]'}>
              {previo && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#FBF3E1] px-3.5 py-2.5" style={{ border: `2px solid ${INK}` }} data-aviso-borrador>
                  <span className="material-symbols-outlined text-[22px] text-[#B07A1E]" aria-hidden>draft</span>
                  <p className="min-w-0 flex-1 text-[0.8rem] text-[#2C3E50]">
                    Ya tienes un borrador de este documento: <b>{previo.lista.length} párrafos</b> ({previo.modo === 'literal' ? 'texto original' : 'resumen'},{' '}
                    {haceCuanto(previo.actualizado)}). Si generas de nuevo, se sustituirá.
                  </p>
                  <button
                    type="button"
                    onClick={retomarPrevio}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
                    style={{ background: 'var(--cia-acc)', border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                  >
                    Retomar ese borrador
                  </button>
                </div>
              )}
              {extraido.avisos.map((a) => (
                <p key={a} className="-mb-2 text-xs font-medium text-[#B07A1E]">
                  {a}
                </p>
              ))}

              {ofrecerLibro && !porTemas && documentoGrande && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-[#FFF6DC] px-3.5 py-3" style={{ border: `2px solid ${INK}` }}>
                  <span className="material-symbols-outlined text-[22px] text-[#B07A1E]" aria-hidden>auto_stories</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.82rem] font-semibold text-[#2C3E50]">
                      Es largo: {fmt(extraido.caracteres)} caracteres y de una vez caben {fmt(maxChars)}. ¿Cómo lo hacemos?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void activarTemas()}
                        disabled={cargandoIndice}
                        className="rounded-full px-3 py-1 text-[0.75rem] font-bold text-white disabled:opacity-60"
                        style={{ background: INK, border: `2px solid ${INK}` }}
                      >
                        {cargandoIndice ? 'Sacando el índice…' : 'Tema a tema'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFilaAbierta(null)
                          setSelectorAbierto(true)
                        }}
                        className="rounded-full bg-white px-3 py-1 text-[0.75rem] font-bold text-[#2C3E50]"
                        style={{ border: `2px solid ${INK}` }}
                      >
                        Solo una parte
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {ofrecerLibro && !porTemas && !documentoGrande && (
                <button
                  type="button"
                  onClick={() => void activarTemas()}
                  disabled={cargandoIndice}
                  className="-mb-2 flex items-center gap-2 self-start text-[0.78rem] font-bold disabled:opacity-60"
                  style={{ color: 'var(--cia-acc-d)' }}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>library_books</span>
                  {cargandoIndice ? 'Sacando el índice…' : '¿Trae varios temas? Hacerlo tema a tema'}
                </button>
              )}
              {porTemas && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5" style={{ border: '2px solid var(--cia-acc)' }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--cia-acc-d)' }} aria-hidden>library_books</span>
                  <span className="min-w-0 flex-1 text-[0.8rem] font-bold text-[#2C3E50]">
                    Tema a tema · {fmt(temasLibro?.length ?? 0)} temas · cada uno puede ir a su grupo
                  </span>
                  <button type="button" onClick={quitarTemas} className="text-xs font-bold text-[#7D8A96] hover:text-[#B04A5E]">
                    Quitar
                  </button>
                </div>
              )}

              <div>
                <TituloBloque n={1} nota={nadaElegido ? undefined : `≈${fmt(aprox)} párrafos`}>
                  ¿Cómo lo escribimos?
                </TituloBloque>
                <Opciones etiqueta="Modo">
                  {MODOS.map((m) => (
                    <OpcionAnimada
                      key={m.id}
                      activa={modo === m.id}
                      onElegir={() => setModo(m.id)}
                      titulo={m.id === 'resumen' ? 'Resumido' : 'Literal'}
                      descripcion={m.id === 'resumen' ? 'La IA condensa con las palabras del documento.' : 'Copia tal cual los párrafos más preguntables.'}
                      dato={m.id === 'resumen' ? 'Recomendado' : 'Solo párrafos cortos'}
                      escena={<EscenaParrafo literal={m.id === 'literal'} />}
                    />
                  ))}
                </Opciones>
                <h4 className="mb-2 mt-4 flex items-center text-[0.8rem] font-black text-[#2C3E50]">
                  Huecos
                  <span className="ml-auto text-[0.72rem] font-medium text-[#7D8A96]">Qué datos tapar</span>
                </h4>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Niveles de los huecos">
                  {NIVELES.map((n) => {
                    const on = niveles.includes(n)
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        title={DESCRIPCION_NIVEL[n]}
                        onClick={() => alternarNivel(n)}
                        className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-2 pr-3 text-[0.78rem] font-bold"
                        style={{ border: `2px solid ${on ? INK : '#EDE6DE'}`, color: on ? INK : '#7D8A96', boxShadow: on ? `2px 2px 0 0 ${INK}` : 'none' }}
                      >
                        <span className="size-3.5 rounded-full" style={{ background: LEVEL_INFO[n].color, opacity: on ? 1 : 0.35 }} aria-hidden />
                        {LEVEL_INFO[n].name}
                      </button>
                    )
                  })}
                </div>
                {niveles.length === 0 && <p className="mt-1.5 text-xs font-bold text-[#B04A5E]">Marca al menos un nivel.</p>}
              </div>

              {carpeta.arbol && (
                <div>
                  <TituloBloque n={2}>Dónde se guarda</TituloBloque>
                  <DestinoCarpeta
                    arbol={carpeta.arbol}
                    valor={carpeta.valor}
                    sugerida={carpeta.sugerida}
                    candidatas={carpeta.sugerencia?.candidatas}
                    onChange={carpeta.elegir}
                    {...(porTemas && carpeta.valor.subjectId !== null && carpeta.valor.topicId === null
                      ? { nota: 'Si guardas un grupo por tema, cada uno irá a su tema dentro de la asignatura.' }
                      : {})}
                  />
                </div>
              )}

              <div>
                <TituloBloque n={carpeta.arbol ? 3 : 2} nota="Toca para cambiar">Detalles</TituloBloque>
                <Detalles>
                  <FilaDetalle
                    primera
                    icono="checklist"
                    etiqueta="Qué parte usar"
                    valor={resumenParte}
                    abierta={selectorAbierto}
                    onAlternar={() => {
                      setFilaAbierta(null)
                      setSelectorAbierto(!selectorAbierto)
                    }}
                  >
                    <SelectorParte
                      soloContenido
                      secciones={extraido.secciones}
                      indice={indice}
                      sel={sel}
                      onChange={setSel}
                      unidad={extraido.unidad ?? 'página'}
                      abierto={selectorAbierto}
                      onAbrir={setSelectorAbierto}
                      resumen={resumenParte}
                    />
                  </FilaDetalle>
                  <FilaDetalle
                    icono="tune"
                    etiqueta="Cantidad"
                    valor={`${densidadActual?.titulo ?? ''} · ≈${fmt(aprox)} párrafos`}
                    abierta={filaAbierta === 'cantidad'}
                    onAlternar={() => alternarFila('cantidad')}
                  >
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cantidad de párrafos">
                      {DENSIDADES.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          role="radio"
                          aria-checked={densidad === d.id}
                          title={d.descripcion}
                          onClick={() => setDensidad(d.id)}
                          className="rounded-full px-3 py-1 text-[0.75rem] font-bold"
                          style={{
                            border: `2px solid ${densidad === d.id ? INK : '#EDE6DE'}`,
                            background: densidad === d.id ? 'var(--cia-soft)' : '#fff',
                            color: densidad === d.id ? INK : '#7D8A96',
                          }}
                        >
                          {d.titulo}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[0.72rem] text-[#7D8A96]">{densidadActual?.descripcion}</p>
                  </FilaDetalle>
                  <FilaDetalle
                    icono="edit"
                    etiqueta={porTemas ? 'Nombre del documento' : 'Nombre del grupo'}
                    valor={titulo.trim() || 'Sin nombre'}
                    abierta={filaAbierta === 'nombre'}
                    onAlternar={() => alternarFila('nombre')}
                  >
                    <input
                      id="ra-ia-nombre"
                      aria-label="Nombre"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value.slice(0, 80))}
                      className="w-full rounded-xl border-2 border-[#EDE6DE] bg-[#FAF7F4] px-3 py-2 text-[0.82rem] font-semibold text-[#2C3E50] outline-none focus:border-[var(--cia-acc)]"
                    />
                  </FilaDetalle>
                </Detalles>
              </div>

              {nadaElegido && <p className="-mt-2 text-xs font-bold text-[#B04A5E]">Marca al menos una parte del documento.</p>}
              {excedeTexto && (
                <p role="alert" className="-mt-2 text-sm font-bold text-[#B04A5E]">
                  Lo marcado tiene {fmt(caracteres)} caracteres: el máximo {porTemas ? 'tema a tema' : 'de una vez'} es {fmt(maxCharsUsado)}. Desmarca alguna parte.
                </p>
              )}
              {excedePaginas && (
                <p role="alert" className="-mt-2 text-sm font-bold text-[#B04A5E]">
                  Lo marcado tiene más de {maxPaginasUsado} páginas. Desmarca alguna parte.
                </p>
              )}
              {excedeTemas && (
                <p role="alert" className="-mt-2 text-sm font-bold text-[#B04A5E]">
                  Como mucho {estado.limites.maxTemas ?? 40} temas de una vez. Desmarca alguno.
                </p>
              )}
              {!excedeTexto && excedeCupoChars && (
                <p role="alert" className="-mt-2 text-sm font-bold text-[#B04A5E]">
                  Hoy te quedan {fmt(charsRestantesHoy)} caracteres de IA y lo marcado tiene {fmt(caracteres)}. Marca menos o vuelve mañana.
                </p>
              )}
              {sinCupo && (
                <p role="alert" className="-mt-2 text-sm font-bold text-[#B04A5E]">
                  Has llegado al máximo de generaciones de hoy. Vuelve mañana.
                </p>
              )}
              {cupo && !nadaElegido && (
                <p className="-mt-2 text-xs text-[#7D8A96]" aria-live="polite">
                  Usará {fmt(caracteres)} de los {fmt(charsRestantesHoy)} caracteres que te quedan hoy.
                </p>
              )}
              {embebido && !nadaElegido && <PrecioIA precio={precio} />}

              <label
                className="-mt-1 flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-white px-3 py-2.5 text-[0.76rem] leading-snug text-[#2C3E50]"
                style={{ border: `2px solid ${derechos ? INK : '#EDE6DE'}` }}
              >
                <input type="checkbox" checked={derechos} onChange={(e) => setDerechos(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#5E7F5B]" data-resumen-derechos />
                <span>
                  <b>Tengo derecho a usar este documento para estudiar</b> (son mis apuntes o material que puedo usar). Los párrafos son solo para mí: no se comparten ni se
                  reutilizan, y se borran con mi cuenta.{modo === 'literal' ? ' En «Literal» se guardan solo los párrafos elegidos, cortos.' : ''}
                </span>
              </label>
            </div>
          )}

          {fase === 'generando' && (
            <ProgresoIA
              herramienta="resumen"
              fases={['leyendo', 'parrafos', 'ordenando']}
              fase={faseIA}
              lineas={lineas}
              segundos={segundos}
              contador={(ls) => {
                const n = ls.filter((l) => l.d > 1).length
                return `${n} ${n === 1 ? 'párrafo' : 'párrafos'}`
              }}
              {...(porTemas
                ? {
                    temas: progresoTemas,
                    detalle: progresoTemas.length ? `Temas: ${progresoTemas.filter((p) => p.estado === 'listo').length} de ${progresoTemas.length} listos` : undefined,
                  }
                : {})}
            />
          )}
        </div>
      )}

      {fase === 'ajustes' && !embebido && extraido && (
        <PieCrear
          precio={
            nadaElegido ? null : (
              <PrecioIA
                precio={precio}
                alternativas={[
                  porTemas ? 'Desmarca algún tema: el precio baja al momento.' : 'Marca menos partes del documento: el precio baja al momento.',
                  ...(densidad !== 'pocas' ? ['Elige menos párrafos («Pocos»).'] : []),
                ]}
              />
            )
          }
          boton={porTemas ? 'Generar los temas' : 'Generar resumen'}
          onGenerar={() => void generar()}
          puede={puedeGenerar}
          {...(falta ? { falta } : {})}
        />
      )}
    </>
  )
  const estilos = <style>{`@keyframes ia-barra{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}@keyframes ia-entra{from{opacity:0;transform:translateX(-0.25rem)}to{opacity:1;transform:none}}.ia-prov-entra{animation:ia-entra .25s ease-out}`}</style>
  if (embebido) {
    return (
      <div data-cia="resumen" className={visible ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        {cuerpo}
        {estilos}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ra-ia-titulo"
        data-cia="resumen"
        className={`flex max-h-[92dvh] w-full ${ancho} flex-col overflow-hidden rounded-[28px] bg-[#FAF7F4]`}
        style={{ border: `2px solid ${INK}`, boxShadow: `8px 8px 0 0 ${INK}` }}
      >
        {cuerpo}
      </div>
      {estilos}
    </div>
  )
}
