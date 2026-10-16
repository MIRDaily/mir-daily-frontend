'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { aplicarEvento, type EstadoTema, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { construirIndice, resumenSeleccion } from '@/lib/mapas/ia/indice'
import { entradasDeTemas, temasParaEnviar, type TemaIndice } from '@/lib/mapas/ia/libro'
import { ExtractError, IAError, type Extraido } from '@/lib/mapas/ia/types'
import { INK, ProgresoIA } from '@/components/mapas/ia/ProgresoIA'
import { SelectorParte } from '@/components/mapas/ia/SelectorParte'
import { FLASHCARD_LEVELS, LEVEL_INFO, type FlashcardLevel } from '@/lib/studioFlashcards'
import { flashcardsIAGenerar, flashcardsIAIndice, flashcardsIAMas } from '@/lib/flashcards/ia/api'
import { borradores, DENSIDADES, DESCRIPCION_NIVEL, tarjetasAprox, type Borrador, type Densidad, type EstadoFlashcardsIA } from '@/lib/flashcards/ia/tarjetas'
import { VistaPreviaFlashcards, type MasConfig } from './VistaPreviaFlashcards'
import DestinoCarpeta from '@/components/carpetas/DestinoCarpeta'
import { CabeceraCrear, Detalles, FilaDetalle, OpcionAnimada, Opciones, PieCrear, TituloBloque } from '@/components/ia/crear/Kit'
import { EscenaMonton } from '@/components/ia/crear/Escenas'
import { useCarpeta } from '@/lib/carpetas/useCarpeta'
import { textosDocumento } from '@/lib/carpetas/sugerir'
import { supabase } from '@/lib/supabaseBrowser'
import {
  borrarBorrador,
  claveBorrador,
  guardarBorrador,
  guardarDocumentoBorrador,
  leerDocumentoBorrador,
  type BorradorGuardado,
} from '@/lib/flashcards/ia/borrador'
import type { FuenteGuardar } from '@/lib/flashcards/ia/tarjetas'
import { hashArchivo } from '@/lib/mapas/ia/docs'
import { fragmentoParaRama } from '@/lib/mapas/ia/rama'
import type { Seccion } from '@/lib/mapas/ia/types'
import { seleccionInicial, type PropsEmbebido, type ResultadoGenerar } from '@/lib/ia/embebido'
import { PrecioIA } from '@/components/ia/PrecioIA'
import { useCobroIA, useCreditosIA } from '@/hooks/useCreditosIA'
import { caracteresDocumento, caracteresLibro, claveFlashcards, precioIA } from '@/lib/ia/precio'
import { anotarReserva, mensajeErrorIA, nuevaGeneracion, nuevoCobro, refrescarCreditos, type Generacion } from '@/lib/ia/creditos'

// «Crear flashcards con IA» desde un documento (PDF, Word, PowerPoint): el mismo camino que «Crear
// con IA» de los mapas (el archivo se lee en el navegador y no se sube; «Qué parte usar»; tema a
// tema con el índice), con niveles y densidad, y al final una VISTA PREVIA editable. Nada se guarda
// hasta aprobarla.
//
// Paquete 2: el texto del documento se guarda con el borrador (solo en este navegador) para poder
// pedir «Más de este tema» incluso tras recargar; al servidor viaja solo el fragmento del tema. Y se
// puede abrir con un documento YA leído (`inicial`): «Hacer también las flashcards de estos temas»
// desde «Crear con IA» de mapas en modo libro.

type Fase = 'elegir' | 'leyendo' | 'ajustes' | 'generando' | 'vista'
type ProgresoTema = { titulo: string; estado: EstadoTema | 'espera' }

const fmt = (n: number) => n.toLocaleString('es-ES')

type Resultado = {
  titulo: string
  lista: Borrador[]
  fallidos: string[]
  fuente: FuenteGuardar
  creado?: number
  /** Hash y nombre del archivo: con ellos se comprueba el archivo si hay que volver a pedirlo. */
  documento?: { hash: string; nombre: string }
}

/** El texto del documento para «Más de este tema» (el leído ahora o el guardado con el borrador). */
type TextoDocumento = { secciones: Seccion[]; unidad?: 'página' | 'diapositiva' }

/** Un documento ya leído (desde «Crear con IA» de mapas): se empieza en los ajustes, con lo marcado. */
export type DocumentoLeido = { archivo: File; extraido: Extraido; titulo: string; temasLibro: TemaIndice[] | null; sel: Set<number> }

export default function CrearFlashcardsIA({
  estado: estadoDado,
  borrador,
  inicial: inicialDado,
  onClose,
  compartido,
  visible = true,
  controlRef,
  onEstado,
  archivoInicial,
}: PropsEmbebido & {
  estado: EstadoFlashcardsIA | null
  /** Un documento soltado sobre la página: se empieza leyéndolo. */
  archivoInicial?: File
  /** Retomar la revisión de un borrador guardado en este navegador (no hace falta la IA). */
  borrador?: BorradorGuardado
  /** Empezar con un documento ya leído, con sus temas y partes marcados. */
  inicial?: DocumentoLeido
  onClose: () => void
}) {
  const embebido = !!compartido
  // Sin la IA (solo se retoma un borrador) los ajustes no se enseñan: estos valores no se usan.
  const estado: EstadoFlashcardsIA = estadoDado ?? {
    disponible: false, niveles: [], densidades: [],
    limites: { maxChars: 0, maxPaginas: 0 },
    cupo: { generacionesHoy: 0, maxGeneracionesDia: 0, caracteresHoy: 0, maxCaracteresDia: 0 },
  }
  // Con el documento compartido del popup unificado, se empieza en los ajustes con lo que cabe marcado.
  const [inicial] = useState<DocumentoLeido | undefined>(() =>
    inicialDado ??
    (compartido
      ? { archivo: compartido.archivo, extraido: compartido.extraido, titulo: compartido.extraido.titulo, temasLibro: null, sel: seleccionInicial(compartido.extraido, estado.limites).sel }
      : undefined),
  )
  const [fase, setFase] = useState<Fase>(borrador ? 'vista' : inicial ? 'ajustes' : archivoInicial ? 'leyendo' : 'elegir')
  const [archivo, setArchivo] = useState<File | null>(inicial?.archivo ?? archivoInicial ?? null)
  const [extraido, setExtraido] = useState<Extraido | null>(inicial?.extraido ?? null)
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [niveles, setNiveles] = useState<FlashcardLevel[]>([...FLASHCARD_LEVELS])
  const [densidad, setDensidad] = useState<Densidad>('normal')
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [faseIA, setFaseIA] = useState<FaseIA>('leyendo')
  const [lineas, setLineas] = useState<LineaProvisional[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [sel, setSel] = useState<Set<number>>(() => new Set(inicial?.sel ?? []))
  const [selectorAbierto, setSelectorAbierto] = useState(
    !!inicial?.temasLibro || (!inicialDado && !!compartido && seleccionInicial(compartido.extraido, estado.limites).abierto),
  )
  const [temasLibro, setTemasLibro] = useState<TemaIndice[] | null>(inicial?.temasLibro ?? null)
  const [cargandoIndice, setCargandoIndice] = useState(false)
  const [progresoTemas, setProgresoTemas] = useState<ProgresoTema[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(
    borrador
      ? {
          titulo: borrador.titulo,
          lista: borrador.lista,
          fallidos: borrador.fallidos,
          fuente: borrador.fuente,
          creado: borrador.creado,
          ...(borrador.documento ? { documento: borrador.documento } : {}),
        }
      : null,
  )
  // «Más de este tema»: el texto del documento (el leído ahora o, al retomar, el guardado con el
  // borrador; undefined mientras se busca, null si no está y hay que pedir el archivo).
  const [textoDoc, setTextoDoc] = useState<TextoDocumento | null | undefined>(borrador ? undefined : null)
  const [masUsadas, setMasUsadas] = useState(0)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [comprobando, setComprobando] = useState(false)
  const inputMasRef = useRef<HTMLInputElement>(null)
  // Borrador en este navegador: del usuario de la sesión (lo de otra cuenta en el mismo navegador no se mezcla).
  const [usuario, setUsuario] = useState<string | null>(borrador?.usuario ?? null)
  useEffect(() => {
    if (usuario) return
    void supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user.id ?? null))
  }, [usuario])
  const persistir = useCallback(
    (lista: Borrador[], r?: Resultado) => {
      const base = r ?? resultado
      if (!usuario || !base) return
      void guardarBorrador({
        usuario,
        origen: borrador?.origen ?? { tipo: 'documento' },
        titulo: base.titulo,
        nombreGrupo: borrador?.nombreGrupo ?? base.titulo.slice(0, 80),
        fuente: base.fuente,
        lista,
        fallidos: base.fallidos,
        ...(base.creado ? { creado: base.creado } : {}),
        ...(base.documento ? { documento: base.documento } : {}),
      })
    },
    [usuario, resultado, borrador],
  )

  // Al retomar un borrador: su documento, si este navegador lo guarda (y es el mismo archivo).
  useEffect(() => {
    if (!borrador) return
    let vivo = true
    void leerDocumentoBorrador(borrador.clave, borrador.documento?.hash).then((d) => {
      if (vivo) setTextoDoc(d ? { secciones: d.secciones, ...(d.unidad ? { unidad: d.unidad } : {}) } : null)
    })
    return () => {
      vivo = false
    }
  }, [borrador])
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

  // En la vista previa no se cierra con Escape ni clicando fuera: se perdería lo generado.
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

  // Archivo soltado sobre la página (useSoltarDocumento): se lee en cuanto se abre, sin pasar por «elegir».
  // Una sola vez (en desarrollo, StrictMode monta dos veces) y fuera del cuerpo del efecto.
  const leidoInicial = useRef(false)
  useEffect(() => {
    if (!archivoInicial || leidoInicial.current) return
    leidoInicial.current = true
    void Promise.resolve().then(() => leer(archivoInicial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivoInicial])

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
  // Créditos: lo marcado (tema a tema, un fijo por tema) con la densidad como factor.
  const tarifaIA = useCreditosIA().tarifa
  const precio = useMemo(() => {
    if (!extraido) return null
    const clave = claveFlashcards('documento')
    if (envioLibro) return precioIA(tarifaIA, { clave, densidad, ...caracteresLibro(envioLibro.secciones, envioLibro.temas) })
    return precioIA(tarifaIA, { clave, densidad, caracteres: caracteresDocumento(eleccion?.elegidas ?? []) })
  }, [extraido, envioLibro, eleccion, densidad, tarifaIA])
  const precioMas = useMemo(() => precioIA(tarifaIA, { clave: 'flashcards_mas' }), [tarifaIA])
  const cobroIA = useCobroIA(precio)
  const puedeGenerar =
    !!extraido && !nadaElegido && !excedeTexto && !excedePaginas && !excedeTemas && !excedeCupoChars && !sinCupo && cobroIA.suficiente && !cargandoIndice && niveles.length > 0 && titulo.trim().length > 0

  const charsPorTema = useMemo(
    () => (envioLibro ? envioLibro.temas.map((t) => envioLibro.secciones.slice(t.desde, t.hasta + 1).reduce((n, s) => n + s.texto.length, 0)) : []),
    [envioLibro],
  )
  const aprox = envioLibro
    ? charsPorTema.reduce((n, c) => n + tarjetasAprox(c, densidad, niveles.length), 0)
    : tarjetasAprox(caracteres, densidad, niveles.length)

  const activarTemas = async () => {
    if (!extraido) return
    setError(null)
    setCargandoIndice(true)
    try {
      const temas = await flashcardsIAIndice({ titulo: titulo.trim() || extraido.titulo, secciones: extraido.secciones })
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

  const alternarNivel = (n: FlashcardLevel) =>
    setNiveles((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n].sort()))

  const generar = async (): Promise<ResultadoGenerar> => {
    if (!extraido || !puedeGenerar) return 'no'
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
    const onEvento = (e: Parameters<NonNullable<Parameters<typeof flashcardsIAGenerar>[2]>>[0]) => {
      if (e.tipo === 'reserva') anotarReserva(gen, e)
      if (!montado.current || ctl.signal.aborted) return
      if (e.tipo === 'fase') setFaseIA(e.fase)
      else if (e.tipo === 'rama' || e.tipo === 'reinicio') setLineas((ls) => aplicarEvento(ls, e))
      else if (e.tipo === 'temas') setProgresoTemas(e.temas.map((t) => ({ titulo: t.titulo, estado: 'espera' })))
      else if (e.tipo === 'tema') setProgresoTemas((ps) => ps.map((p, i) => (i === e.i ? { ...p, estado: e.estado } : p)))
    }
    const comun = {
      titulo: titulo.trim(),
      niveles,
      densidad,
      paginas: Math.max(1, paginasElegidas),
      ...(extraido.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
      ...gen.cobro,
    }
    try {
      const r = envioLibro
        ? await flashcardsIAGenerar({ ...comun, secciones: envioLibro.secciones, temas: envioLibro.temas }, ctl.signal, onEvento)
        : await flashcardsIAGenerar({ ...comun, secciones: eleccion?.elegidas ?? [] }, ctl.signal, onEvento)
      void refrescarCreditos()
      if (!montado.current) return 'cancelado'
      const lista =
        'temas' in r
          ? r.temas.flatMap((t) => borradores(t.tarjetas, `t${t.i}-`, t.titulo))
          : borradores(r.tarjetas)
      if (lista.length === 0) throw new IAError('La IA no devolvió tarjetas válidas. Prueba con otra parte del documento.')
      // El texto del documento, con el borrador (solo en este navegador): «Más de este tema» lo
      // necesita también tras recargar. Si el navegador no puede guardarlo, se pedirá el archivo.
      const hash = archivo ? await hashArchivo(archivo).catch(() => null) : null
      if (!montado.current) return 'cancelado'
      const nuevo: Resultado = {
        titulo: r.titulo,
        lista,
        fallidos: 'temas' in r ? r.fallidos.map((f) => `${f.titulo}: ${f.motivo}`) : [],
        fuente: {
          ...(archivo ? { nombre: archivo.name.slice(0, 160) } : {}),
          ...(extraido.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
        },
        ...(hash && archivo ? { documento: { hash, nombre: archivo.name.slice(0, 160) } } : {}),
      }
      setTextoDoc({ secciones: extraido.secciones, ...(extraido.unidad ? { unidad: extraido.unidad } : {}) })
      if (usuario && hash && archivo) {
        void guardarDocumentoBorrador(usuario, {
          hash,
          nombre: archivo.name.slice(0, 160),
          secciones: extraido.secciones,
          ...(extraido.unidad ? { unidad: extraido.unidad } : {}),
        })
      }
      setResultado(nuevo)
      // Guardado ya (antes de tocar nada): una recarga a mitad de revisión no lo pierde.
      persistir(lista, nuevo)
      setFase('vista')
      return 'ok'
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) void refrescarCreditos()
      if (!montado.current) return 'cancelado'
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      setError(mensajeErrorIA(e, 'No se pudieron generar las flashcards'))
      setFase('ajustes')
      return 'fallo'
    }
  }

  // Como pestaña del popup unificado: el popup lanza la generación (en cola) y pinta el estado.
  useImperativeHandle(controlRef, () => ({ generar }))
  const falta = !extraido
    ? undefined
    : niveles.length === 0
      ? 'Marca al menos un nivel de dificultad.'
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

  // Sin el texto del documento (un borrador antiguo, o el navegador lo perdió): se pide el archivo y
  // se comprueba con el hash que es el mismo (si el borrador no lo tiene, que se llame igual).
  const volverAElegir = async (file: File | undefined) => {
    if (!file || !resultado) return
    setErrorArchivo(null)
    setComprobando(true)
    try {
      const hash = await hashArchivo(file)
      const esperado = resultado.documento
      const mismo = esperado ? hash === esperado.hash : !resultado.fuente.nombre || file.name === resultado.fuente.nombre
      if (!mismo) throw new Error(`Ese no es el archivo de estas tarjetas${resultado.documento?.nombre || resultado.fuente.nombre ? ` («${resultado.documento?.nombre ?? resultado.fuente.nombre}»)` : ''}.`)
      const r = await extraerDocumento(file, { maxChars: topeLectura })
      if (!montado.current) return
      setTextoDoc({ secciones: r.secciones, ...(r.unidad ? { unidad: r.unidad } : {}) })
      const documento = { hash, nombre: file.name.slice(0, 160) }
      setResultado((x) => (x ? { ...x, documento } : x))
      if (usuario) void guardarDocumentoBorrador(usuario, { ...documento, secciones: r.secciones, ...(r.unidad ? { unidad: r.unidad } : {}) })
    } catch (e) {
      if (montado.current) setErrorArchivo(e instanceof ExtractError || e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      if (montado.current) setComprobando(false)
    }
  }

  const masRestantes = estadoDado?.cupo?.maxMasDia !== undefined ? estadoDado.cupo.maxMasDia - (estadoDado.cupo.masHoy ?? 0) - masUsadas : undefined
  const mas: MasConfig | undefined =
    estadoDado?.disponible && estadoDado.opciones?.ampliar && resultado
      ? {
          restantes: masRestantes,
          precio: precioMas,
          pedir: async ({ tema, niveles: nv, cantidad, existentes, paginas, vecinos }, signal) => {
            if (!textoDoc) throw new Error('Falta el texto del documento.')
            // Solo el fragmento de ese tema: las páginas de sus tarjetas (con margen) o, sin páginas, las
            // secciones que más se le parecen.
            const fragmento = fragmentoParaRama(textoDoc.secciones, paginas, `${tema} ${existentes.map((x) => x.pregunta).join(' ')}`)
            const r = await flashcardsIAMas(
              {
                titulo: resultado.titulo,
                niveles: nv,
                ampliar: { tema, cantidad, existentes, vecinos },
                secciones: fragmento,
                ...(textoDoc.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
                ...nuevoCobro(precioMas),
              },
              signal,
            ).finally(() => void refrescarCreditos())
            setMasUsadas((n) => n + 1)
            return r
          },
          ...(textoDoc
            ? {}
            : {
                bloqueo:
                  textoDoc === undefined ? (
                    <p className="text-[#7D8A96]">Buscando el documento en este navegador…</p>
                  ) : (
                    <div>
                      <p>
                        Para pedir más tarjetas hace falta el texto del documento, y este navegador no lo tiene guardado (un borrador anterior, o se ha
                        borrado). Vuelve a elegir el archivo
                        {resultado.documento?.nombre || resultado.fuente.nombre ? <b> «{resultado.documento?.nombre ?? resultado.fuente.nombre}»</b> : null}: se comprueba
                        que es el mismo y no se sube.
                      </p>
                      <input
                        ref={inputMasRef}
                        type="file"
                        accept={FORMATOS_ACEPTADOS}
                        className="hidden"
                        onChange={(e) => {
                          void volverAElegir(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        disabled={comprobando}
                        onClick={() => inputMasRef.current?.click()}
                        className="mt-2 rounded-lg bg-[#E8A598] px-3 py-1 text-[0.76rem] font-extrabold text-white disabled:opacity-60"
                        style={{ border: `2px solid ${INK}` }}
                      >
                        {comprobando ? 'Comprobando…' : 'Elegir el archivo'}
                      </button>
                      {errorArchivo && <p className="mt-1 text-[0.74rem] font-bold text-[#B04A5E]">{errorArchivo}</p>}
                    </div>
                  ),
              }),
        }
      : undefined

  const ancho = fase === 'vista' ? 'max-w-3xl' : 'max-w-xl'

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
  const tarjetasCon = (d: Densidad) =>
    envioLibro ? charsPorTema.reduce((n, c) => n + tarjetasAprox(c, d, niveles.length || 1), 0) : tarjetasAprox(caracteres, d, niveles.length || 1)
  const datosDocumento = extraido
    ? `${fmt(extraido.paginas)} ${extraido.unidad === 'diapositiva' ? 'diapositiva' : 'página'}${extraido.paginas === 1 ? '' : 's'} · ${fmt(extraido.caracteres)} caracteres`
    : ''
  const quitarTemas = () => {
    if (!extraido) return
    setTemasLibro(null)
    const cabe = extraido.caracteres <= maxChars && extraido.paginas <= maxPaginas
    setSel(cabe ? new Set(extraido.secciones.map((_, i) => i)) : new Set())
  }

  const cuerpo = (
    <>
      {!embebido && (
        <CabeceraCrear
          herramienta="flashcards"
          idTitulo="fc-ia-titulo"
          titulo={fase === 'vista' ? 'Revisa las flashcards' : fase === 'generando' ? 'Creando tus flashcards…' : 'Nuevas flashcards'}
          subtitulo={
            fase === 'vista' && resultado
              ? resultado.titulo
              : fase === 'generando'
                ? (archivo?.name ?? '')
                : 'Tarjetas de pregunta y respuesta, de fácil a demencial.'
          }
          documento={fase === 'ajustes' && extraido && archivo ? { nombre: archivo.name, datos: datosDocumento } : null}
          {...(fase === 'ajustes'
            ? {
                onCambiarDocumento: () => {
                  setExtraido(null)
                  setArchivo(null)
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
          <VistaPreviaFlashcards
            inicial={resultado.lista}
            nombreGrupo={(borrador?.nombreGrupo ?? resultado.titulo).slice(0, 80)}
            fuente={resultado.fuente}
            persistir={persistir}
            mas={mas}
            teclado={visible}
            carpetaInicial={carpeta.arbol ? { valor: carpeta.valor, origen: carpeta.origen } : null}
            alGuardar={() => usuario && void borrarBorrador(claveBorrador(usuario, borrador?.origen ?? { tipo: 'documento' }))}
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
                    Hoy te quedan {restantes} de {cupo.maxGeneracionesDia} generaciones de flashcards.
                  </li>
                )}
              </ul>
            </>
          )}

          {(fase === 'ajustes' || fase === 'generando') && extraido && (
            <div className={fase === 'generando' ? 'hidden' : 'flex flex-col gap-[18px]'}>
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
                <TituloBloque n={1} nota={nadaElegido ? undefined : `≈${fmt(aprox)} tarjetas`}>
                  ¿Cuántas tarjetas?
                </TituloBloque>
                <Opciones etiqueta="Cantidad de tarjetas" columnas={3}>
                  {DENSIDADES.map((d, i) => (
                    <OpcionAnimada
                      key={d.id}
                      activa={densidad === d.id}
                      onElegir={() => setDensidad(d.id)}
                      titulo={d.titulo}
                      descripcion={d.descripcion}
                      dato={`≈${fmt(tarjetasCon(d.id))}`}
                      escena={<EscenaMonton n={[2, 4, 6][i] ?? 4} />}
                    />
                  ))}
                </Opciones>
                <h4 className="mb-2 mt-4 flex items-center text-[0.8rem] font-black text-[#2C3E50]">
                  Dificultad
                  <span className="ml-auto text-[0.72rem] font-medium text-[#7D8A96]">Puedes marcar varias</span>
                </h4>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Niveles de dificultad">
                  {FLASHCARD_LEVELS.map((n) => {
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
                {niveles.length === 0 ? (
                  <p className="mt-1.5 text-xs font-bold text-[#B04A5E]">Marca al menos un nivel.</p>
                ) : (
                  <p className="mt-1.5 text-[0.72rem] text-[#7D8A96]">Empezarás por las fáciles: cada nivel se abre al dominar el anterior.</p>
                )}
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
                    icono="edit"
                    etiqueta={porTemas ? 'Nombre del documento' : 'Nombre del grupo'}
                    valor={titulo.trim() || 'Sin nombre'}
                    abierta={filaAbierta === 'nombre'}
                    onAlternar={() => alternarFila('nombre')}
                  >
                    <input
                      id="fc-ia-nombre"
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
            </div>
          )}

          {fase === 'generando' && (
            <ProgresoIA
              herramienta="flashcards"
              fases={['leyendo', 'tarjetas', 'ordenando']}
              fase={faseIA}
              lineas={lineas}
              segundos={segundos}
              contador={(ls) => {
                const n = ls.filter((l) => l.d > 1).length
                return `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`
              }}
              {...(porTemas
                ? {
                    temas: progresoTemas,
                    detalle: progresoTemas.length
                      ? `Temas: ${progresoTemas.filter((p) => p.estado === 'listo').length} de ${progresoTemas.length} listos`
                      : undefined,
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
                  ...(densidad === 'muchas' ? ['Elige «Normal» en la cantidad de tarjetas.'] : []),
                ]}
              />
            )
          }
          boton={porTemas ? 'Generar los temas' : 'Generar flashcards'}
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
      <div data-cia="flashcards" className={visible ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
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
        aria-labelledby="fc-ia-titulo"
        data-cia="flashcards"
        className={`flex max-h-[92dvh] w-full ${ancho} flex-col overflow-hidden rounded-[28px] bg-[#FAF7F4]`}
        style={{ border: `2px solid ${INK}`, boxShadow: `8px 8px 0 0 ${INK}` }}
      >
        {cuerpo}
      </div>
      {estilos}
    </div>
  )
}
