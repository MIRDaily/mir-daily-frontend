'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMap } from '@/lib/mapas/api'
import DestinoCarpeta from '@/components/carpetas/DestinoCarpeta'
import Image from 'next/image'
import { CabeceraCrear, Detalles, FilaDetalle, LineaInterruptor, OpcionAnimada, Opciones, PieCrear, TituloBloque } from '@/components/ia/crear/Kit'
import { EscenaMapa } from '@/components/ia/crear/Escenas'
import { useCarpeta } from '@/lib/carpetas/useCarpeta'
import { moverACarpeta } from '@/lib/carpetas/api'
import { baseParaPartes, carpetaDeParte, textosDocumento } from '@/lib/carpetas/sugerir'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { iaGenerar, iaIndice } from '@/lib/mapas/ia/api'
import { aplicarEvento, arbolLibro, type EstadoTema, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { INK, ProgresoIA } from './ProgresoIA'
import { SelectorParte } from './SelectorParte'
import { construirIndice, estadoEntrada, resumenSeleccion } from '@/lib/mapas/ia/indice'
import { entradasDeTemas, nodosLibro, temasParaEnviar, unirTemas, type TemaIndice } from '@/lib/mapas/ia/libro'
import type { MapDoc } from '@/lib/mapas/types'
import { guardarDocumento, hashArchivo } from '@/lib/mapas/ia/docs'
import type { Seccion } from '@/lib/mapas/ia/types'
import type { StoredDoc } from '@/lib/mapas/graph'
import CrearFlashcardsIA from '@/components/flashcards/ia/CrearFlashcardsIA'
import { flashcardsIAEstado } from '@/lib/flashcards/ia/api'
import type { EstadoFlashcardsIA } from '@/lib/flashcards/ia/tarjetas'
import { seleccionInicial, type PropsEmbebido, type ResultadoGenerar } from '@/lib/ia/embebido'
import { PrecioIA } from '@/components/ia/PrecioIA'
import { useCobroIA, useCreditosIA } from '@/hooks/useCreditosIA'
import { caracteresDocumento, caracteresLibro, claveMapa, precioIA } from '@/lib/ia/precio'
import { anotarReserva, mensajeErrorIA, nuevaGeneracion, refrescarCreditos, type Generacion } from '@/lib/ia/creditos'
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
// mapa se ha generado bien. Tema a tema, al final se ofrece «Hacer también las
// flashcards de estos temas»: el diálogo de flashcards con el MISMO documento ya
// leído y los mismos temas y partes marcados (sin elegir el archivo ni sacar el
// índice otra vez).

type Fase = 'elegir' | 'leyendo' | 'ajustes' | 'generando' | 'hecho'

/** Cómo se guarda un documento largo generado tema a tema. */
type GuardarComo = 'temas' | 'uno'
type ProgresoTema = { titulo: string; estado: EstadoTema | 'espera' }

const fmt = (n: number) => n.toLocaleString('es-ES')

export default function CrearConIA({
  estado,
  onClose,
  onCreados,
  compartido,
  visible = true,
  controlRef,
  onEstado,
  archivoInicial,
}: PropsEmbebido & {
  estado: EstadoIA
  /** Un documento soltado sobre la página: se empieza leyéndolo. */
  archivoInicial?: File
  onClose: () => void
  /** Se han creado mapas sin abrir el editor (un mapa por tema): la lista debe recargarse. */
  onCreados?: () => void
}) {
  const router = useRouter()
  // Como pestaña del popup unificado (con el documento ya leído y compartido) se empieza en los ajustes.
  const embebido = !!compartido
  const [fase, setFase] = useState<Fase>(compartido ? 'ajustes' : archivoInicial ? 'leyendo' : 'elegir')
  const [archivo, setArchivo] = useState<File | null>(compartido?.archivo ?? archivoInicial ?? null)
  const [extraido, setExtraido] = useState<Extraido | null>(compartido?.extraido ?? null)
  const [titulo, setTitulo] = useState(compartido?.extraido.titulo ?? '')
  const [modo, setModo] = useState<ModoIA>('esquema')
  // Opción «Incluir tablas»: solo si el servidor la ofrece.
  const [tablas, setTablas] = useState(false)
  const conTablas = !!estado.opciones?.tablas && tablas
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null)
  const [segundos, setSegundos] = useState(0)
  // Streaming: fase en curso y ramas provisionales (solo una vista; no se guardan).
  const [faseIA, setFaseIA] = useState<FaseIA>('leyendo')
  const [lineas, setLineas] = useState<LineaProvisional[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  // Qué parte del documento se usa: índices de sección marcados (al servidor solo viaja eso).
  const [sel, setSel] = useState<Set<number>>(() => (compartido ? seleccionInicial(compartido.extraido, estado.limites).sel : new Set()))
  const [selectorAbierto, setSelectorAbierto] = useState(() => (compartido ? seleccionInicial(compartido.extraido, estado.limites).abierto : false))
  // «Detalles»: qué fila está abierta (la de «Qué parte usar» va con selectorAbierto).
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null)
  // Último título puesto solo (el del archivo o el del tema marcado): si el usuario no lo ha
  // cambiado, marcar un único tema le pone su nombre al mapa.
  const tituloAuto = useRef(compartido?.extraido.titulo ?? '')
  // Documento largo TEMA A TEMA: el índice lo saca el servidor (una llamada barata) y cada tema
  // se genera aparte; al final, un mapa por tema o uno grande con cada tema plegado.
  const [temasLibro, setTemasLibro] = useState<TemaIndice[] | null>(null)
  const [cargandoIndice, setCargandoIndice] = useState(false)
  const [guardarComo, setGuardarComo] = useState<GuardarComo>('temas')
  const [progresoTemas, setProgresoTemas] = useState<ProgresoTema[]>([])
  const [creados, setCreados] = useState<{ id: string; titulo: string; nodos: number }[]>([])
  const [fallidos, setFallidos] = useState<{ titulo: string; motivo: string }[]>([])
  // Flashcards de los mismos temas (si la IA de flashcards está para este usuario).
  const [fcEstado, setFcEstado] = useState<EstadoFlashcardsIA | null>(null)
  const [aFlashcards, setAFlashcards] = useState(false)
  const porTemas = !!temasLibro
  useEffect(() => {
    if (fase !== 'hecho' || !porTemas) return
    let vivo = true
    void flashcardsIAEstado().then((e) => vivo && setFcEstado(e))
    return () => {
      vivo = false
    }
  }, [fase, porTemas])
  // SHA-256 del archivo: va al mapa (no el documento) para reconocerlo si hay que volver a elegirlo.
  const hashRef = useRef<Promise<string | null>>(Promise.resolve(null))
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // La generación en curso (su cobro y el id de la reserva, para «Cancelar»).
  const genRef = useRef<Generacion | null>(null)
  const montado = useRef(true)

  const { maxChars, maxPaginas } = estado.limites
  // Con los créditos encendidos el servidor no manda el cupo de hoy: no limita aquí.
  const cupo = estado.cupo
  const restantes = cupo ? Math.max(0, cupo.maxGeneracionesDia - cupo.generacionesHoy) : Infinity
  const charsRestantesHoy = cupo ? Math.max(0, cupo.maxCaracteresDia - cupo.caracteresHoy) : Infinity
  // Se lee más de lo que cabe en un mapa: así se puede elegir una parte de un documento largo.
  const topeLectura = Math.max(maxChars * 4, estado.limites.maxCharsLibro ?? 0)

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
    if (embebido) return // el popup unificado gestiona el cierre
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cerrar, embebido])

  // Con el documento compartido no pasa por `leer`: su SHA-256 se calcula aquí.
  useEffect(() => {
    if (compartido) hashRef.current = hashArchivo(compartido.archivo).catch(() => null)
  }, [compartido])

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
    hashRef.current = hashArchivo(file).catch(() => null)
    try {
      const r = await extraerDocumento(file, {
        maxChars: topeLectura,
        onProgreso: (hecho, total) => montado.current && setProgreso({ hecho, total }),
      })
      if (!montado.current) return
      setExtraido(r)
      setTitulo(r.titulo)
      tituloAuto.current = r.titulo
      setTemasLibro(null)
      // Si cabe, todo marcado; si no, nada marcado y el índice abierto para elegir una parte.
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
  // Tema a tema, el índice es el del servidor (temas y sus apartados).
  const indice = useMemo(
    () => (extraido && temasLibro ? entradasDeTemas(temasLibro, extraido.secciones) : indiceLocal),
    [extraido, temasLibro, indiceLocal],
  )
  const eleccion = useMemo(() => (extraido ? resumenSeleccion(extraido.secciones, sel) : null), [extraido, sel])
  // Carpeta: la sugerida por el título y el índice del documento, hasta que el usuario elige otra.
  const carpeta = useCarpeta(
    useMemo(() => textosDocumento(titulo || extraido?.titulo || '', indice.map((e) => e.titulo)), [titulo, extraido, indice]),
    !!extraido,
  )
  /** Archiva lo creado (si el catálogo llegó). Un fallo aquí no tumba la generación: el mapa ya está. */
  const archivar = async (ids: { id: string; titulo: string }[]) => {
    if (!carpeta.arbol || ids.length === 0) return
    const arbol = carpeta.arbol
    const grupos = new Map<string, { c: typeof carpeta.valor; ids: string[] }>()
    for (const m of ids) {
      // Tema a tema, cada mapa a su tema dentro de la asignatura elegida.
      const c = ids.length > 1 ? carpetaDeParte(arbol, baseParaPartes(carpeta.valor, carpeta.origen), m.titulo) : carpeta.valor
      const k = `${c.subjectId}-${c.topicId}`
      ;(grupos.get(k) ?? grupos.set(k, { c, ids: [] }).get(k)!).ids.push(m.id)
    }
    for (const { c, ids: lote } of grupos.values()) {
      if (c.subjectId === null) continue
      await moverACarpeta('mapa', lote, c, carpeta.origen).catch(() => {})
    }
  }
  const envioLibro = useMemo(
    () => (extraido && temasLibro ? temasParaEnviar(extraido.secciones, sel, temasLibro) : null),
    [extraido, temasLibro, sel],
  )
  const todoElegido = !!extraido && sel.size === extraido.secciones.length

  const elegir = (nuevo: Set<number>) => {
    setSel(nuevo)
    if (!extraido || porTemas || titulo !== tituloAuto.current) return
    const unico = indice.filter((e) => e.nivel === 1 && estadoEntrada(e, nuevo) !== 'nada')
    const propuesto =
      unico.length === 1 && estadoEntrada(unico[0], nuevo) === 'todo' && unico[0].hasta - unico[0].desde + 1 === nuevo.size
        ? unico[0].titulo
        : extraido.titulo
    tituloAuto.current = propuesto
    setTitulo(propuesto)
  }
  // Tema a tema solo viaja lo marcado DENTRO de algún tema.
  const caracteres = envioLibro ? envioLibro.caracteres : (eleccion?.caracteres ?? 0)
  // Páginas que se mandan: las elegidas (en Word, que no tiene páginas, la estimación de siempre).
  const paginasElegidas = !extraido
    ? 0
    : envioLibro
      ? resumenSeleccion(envioLibro.secciones, new Set(envioLibro.secciones.map((_, i) => i))).paginas
      : todoElegido
        ? extraido.paginas
        : (eleccion?.paginas ?? 0)
  const documentoGrande = !!extraido && (extraido.caracteres > maxChars || extraido.paginas > maxPaginas)
  // Tema a tema se ofrece en un documento largo o con varios temas detectados.
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
  // Créditos: el precio de lo marcado con la tarifa del servidor (la misma fórmula y los mismos
  // caracteres que cuenta él). Cambia al momento con el estilo, las tablas y las partes elegidas.
  const tarifaIA = useCreditosIA().tarifa
  const precio = useMemo(() => {
    if (!extraido) return null
    const clave = claveMapa(modo, conTablas)
    if (envioLibro) return precioIA(tarifaIA, { clave, ...caracteresLibro(envioLibro.secciones, envioLibro.temas) })
    return precioIA(tarifaIA, { clave, caracteres: caracteresDocumento(eleccion?.elegidas ?? []) })
  }, [extraido, modo, conTablas, envioLibro, eleccion, tarifaIA])
  const cobroIA = useCobroIA(precio)
  const puedeGenerar =
    !!extraido &&
    !nadaElegido &&
    !excedeTexto &&
    !excedePaginas &&
    !excedeTemas &&
    !excedeCupoChars &&
    !sinCupo &&
    cobroIA.suficiente &&
    !cargandoIndice &&
    titulo.trim().length > 0

  /** Pide el índice al servidor y pasa a tema a tema, con todos los temas marcados. */
  const activarTemas = async () => {
    if (!extraido) return
    setError(null)
    setCargandoIndice(true)
    try {
      const temas = await iaIndice({ titulo: titulo.trim() || extraido.titulo, secciones: extraido.secciones })
      if (!montado.current) return
      if (temas.length < 1) throw new IAError('La IA no encontró temas en este documento. Elige una parte a mano.')
      const nuevo = new Set<number>()
      for (const t of temas) for (let i = t.desde; i <= t.hasta; i++) nuevo.add(i)
      setTemasLibro(temas)
      setSel(nuevo)
      setSelectorAbierto(true)
      if (titulo === tituloAuto.current) {
        setTitulo(extraido.titulo)
        tituloAuto.current = extraido.titulo
      }
    } catch (e) {
      if (!montado.current) return
      setError(e instanceof Error ? e.message : 'No se pudo sacar el índice')
    } finally {
      if (montado.current) setCargandoIndice(false)
    }
  }

  const desactivarTemas = () => {
    if (!extraido) return
    setTemasLibro(null)
    const cabe = extraido.caracteres <= maxChars && extraido.paginas <= maxPaginas
    setSel(cabe ? new Set(extraido.secciones.map((_, i) => i)) : new Set())
  }

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
    const onEvento = (e: Parameters<NonNullable<Parameters<typeof iaGenerar>[2]>>[0]) => {
      if (e.tipo === 'reserva') anotarReserva(gen, e)
      if (!montado.current || ctl.signal.aborted) return
      if (e.tipo === 'fase') setFaseIA(e.fase)
      else if (e.tipo === 'rama' || e.tipo === 'reinicio') setLineas((ls) => aplicarEvento(ls, e))
      else if (e.tipo === 'temas') setProgresoTemas(e.temas.map((t) => ({ titulo: t.titulo, estado: 'espera' })))
      else if (e.tipo === 'tema') setProgresoTemas((ps) => ps.map((p, i) => (i === e.i ? { ...p, estado: e.estado } : p)))
    }
    // Tras crear cada mapa: su texto, SOLO en este navegador (rehacer o ampliar ramas después), y
    // en el mapa el hash y el nombre del archivo. Si el navegador no puede guardarlo, no pasa nada.
    const hash = await hashRef.current
    const fuente = hash && archivo ? { hash, nombre: archivo.name.slice(0, 160), modo, ...(extraido.unidad ? { unidad: extraido.unidad } : {}) } : null
    const conFuente = (doc: StoredDoc): StoredDoc => (fuente ? ({ ...doc, fuente } as unknown as StoredDoc) : doc)
    const recordar = async (id: string, secciones: Seccion[]) => {
      if (!fuente) return
      await guardarDocumento(id, { hash: fuente.hash, nombre: fuente.nombre, secciones, ...(extraido.unidad ? { unidad: extraido.unidad } : {}) }).catch(() => {})
    }
    const comun = {
      titulo: titulo.trim(),
      modo,
      paginas: Math.max(1, paginasElegidas),
      ...(conTablas ? { tablas: true as const } : {}),
      ...(extraido.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
      ...gen.cobro,
    }
    try {
      if (envioLibro) {
        const r = await iaGenerar({ ...comun, secciones: envioLibro.secciones, temas: envioLibro.temas }, ctl.signal, onEvento)
        // Lo que se guarda son los mapas VALIDADOS del final, nunca el borrador.
        const hechos: { id: string; titulo: string; nodos: number }[] = []
        if (guardarComo === 'uno') {
          const doc = unirTemas(r.titulo, r.temas.map((t) => ({ titulo: t.titulo, doc: t.doc as MapDoc })))
          const id = await createMap(r.titulo, conFuente(doc))
          await recordar(id, envioLibro.secciones)
          hechos.push({ id, titulo: r.titulo, nodos: r.temas.reduce((n, t) => n + t.stats.nodos, 0) })
        } else {
          for (const t of r.temas) {
            const id = await createMap(t.titulo, conFuente(t.doc))
            const rango = envioLibro.temas[t.i]
            await recordar(id, rango ? envioLibro.secciones.slice(rango.desde, rango.hasta + 1) : envioLibro.secciones)
            hechos.push({ id, titulo: t.titulo, nodos: t.stats.nodos })
          }
        }
        await archivar(hechos)
        void refrescarCreditos()
        if (!montado.current) return 'cancelado'
        setCreados(hechos)
        setFallidos(r.fallidos.map((f) => ({ titulo: f.titulo, motivo: f.motivo })))
        onCreados?.()
        setFase('hecho')
        return 'ok'
      }
      const r = await iaGenerar({ ...comun, secciones: eleccion?.elegidas ?? [] }, ctl.signal, onEvento)
      void refrescarCreditos()
      // Lo que se guarda es el mapa VALIDADO del final, nunca el borrador.
      const id = await createMap(r.titulo, conFuente(r.doc))
      await recordar(id, eleccion?.elegidas ?? [])
      await archivar([{ id, titulo: r.titulo }])
      if (!montado.current) return 'cancelado'
      if (embebido) {
        // Dentro del popup unificado no se sale a la página del mapa (se perdería lo demás): se avisa y se enlaza.
        setCreados([{ id, titulo: r.titulo, nodos: r.stats.nodos }])
        setFallidos([])
        onCreados?.()
        setFase('hecho')
        return 'ok'
      }
      router.push(`/mapas/${id}?ia=1`)
      return 'ok'
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) void refrescarCreditos()
      if (!montado.current) return 'cancelado'
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      setError(mensajeErrorIA(e, 'No se pudo generar el mapa'))
      setFase('ajustes')
      return 'fallo'
    }
  }

  // Como pestaña del popup unificado: el popup lanza la generación (en cola) y pinta el estado.
  useImperativeHandle(controlRef, () => ({ generar }))
  const falta = !extraido
    ? undefined
    : nadaElegido
      ? 'Marca al menos una parte del documento.'
      : excedeTexto || excedePaginas || excedeTemas
        ? 'Lo marcado es demasiado grande: desmarca alguna parte.'
        : excedeCupoChars || sinCupo
          ? 'No te queda cupo de IA hoy para esto.'
          : cobroIA.falta
            ? cobroIA.falta
            : titulo.trim().length === 0
              ? 'Falta el título.'
              : undefined
  const listo = fase === 'ajustes' && puedeGenerar
  useEffect(() => {
    onEstado?.({ fase, listo, ...(falta && fase === 'ajustes' ? { falta } : {}) })
  }, [onEstado, fase, listo, falta])

  // Tema a tema: cada tema crece con la raíz de su texto y van de 3 en 3 (vasculitis sola, 84.000
  // caracteres, 10-20 s; el libro de reumatología, 16 temas y 421.000 caracteres, 41 s).
  const charsPorTema = useMemo(
    () =>
      envioLibro && extraido
        ? envioLibro.temas.map((t) => envioLibro.secciones.slice(t.desde, t.hasta + 1).reduce((n, s) => n + s.texto.length, 0))
        : [],
    [envioLibro, extraido],
  )
  const nodosAprox = envioLibro
    ? nodosLibro(charsPorTema, NODOS_POR_RAIZ[modo])
    : Math.max(5, Math.round(NODOS_POR_RAIZ[modo] * Math.sqrt(caracteres)))
  const segMin = Math.max(5, Math.round(caracteres / (envioLibro ? 18000 : 6000)))
  const segMax = Math.max(10, Math.round(caracteres / (envioLibro ? 10500 : 3500)) + (envioLibro ? 10 : 0))
  const temasListos = progresoTemas.filter((p) => p.estado === 'listo').length
  const temasFallidos = progresoTemas.filter((p) => p.estado === 'fallo').length
  const resumenParte = !extraido
    ? ''
    : envioLibro
      ? `${fmt(envioLibro.temas.length)} de ${fmt(temasLibro?.length ?? 0)} temas · ${fmt(caracteres)} caracteres`
      : todoElegido
      ? `Todo el documento · ${fmt(caracteres)} caracteres`
      : sel.size === 0
        ? 'Nada marcado'
        : `${fmt(eleccion?.elegidas.length ?? 0)} de ${fmt(extraido.secciones.length)} ${extraido.unidad === 'diapositiva' ? 'diapositivas' : 'secciones'} · ${fmt(caracteres)} caracteres`

  // Mismo documento, mismos temas y partes marcados: el diálogo de flashcards empieza en sus ajustes.
  if (aFlashcards && fcEstado && extraido && archivo && temasLibro) {
    return <CrearFlashcardsIA estado={fcEstado} inicial={{ archivo, extraido, titulo, temasLibro, sel }} onClose={onClose} />
  }

  // Cuántos nodos saldrían con cada estilo (para el dato de cada opción).
  const nodosCon = (m: ModoIA) =>
    envioLibro ? nodosLibro(charsPorTema, NODOS_POR_RAIZ[m]) : Math.max(5, Math.round(NODOS_POR_RAIZ[m] * Math.sqrt(caracteres)))
  const datosDocumento = extraido
    ? `${fmt(extraido.paginas)} ${extraido.unidad === 'diapositiva' ? 'diapositiva' : 'página'}${extraido.paginas === 1 ? '' : 's'} · ${fmt(extraido.caracteres)} caracteres${
        extraido.tablas ? ` · ${extraido.tablas} ${extraido.tablas === 1 ? 'tabla' : 'tablas'}` : ''
      }`
    : ''
  const cambiarDocumento = () => {
    setExtraido(null)
    setArchivo(null)
    setError(null)
    setFase('elegir')
  }
  const alternarFila = (id: string) => {
    setSelectorAbierto(false)
    setFilaAbierta((f) => (f === id ? null : id))
  }

  const cuerpo = (
    <>
      {!embebido && (
        <CabeceraCrear
          herramienta="mapa"
          idTitulo="crear-ia-titulo"
          titulo={fase === 'generando' ? (porTemas ? 'Creando tus mapas…' : 'Creando tu mapa…') : fase === 'hecho' ? '¡Listo!' : 'Nuevo mapa mental'}
          subtitulo={fase === 'generando' || fase === 'hecho' ? (archivo?.name ?? '') : 'La IA lo organiza por bloques: tú eliges cuánto detalle.'}
          documento={fase === 'ajustes' && extraido && archivo ? { nombre: archivo.name, datos: datosDocumento } : null}
          {...(fase === 'ajustes' ? { onCambiarDocumento: cambiarDocumento } : {})}
          {...(fase !== 'generando' ? { onCerrar: cerrar } : {})}
        />
      )}

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
                Máximo {fmt(maxChars)} caracteres de texto (unas {Math.round(maxChars / 3000)} páginas de apuntes) y {maxPaginas} páginas.
              </li>
              {cupo && <li>Hoy te quedan {restantes} de {cupo.maxGeneracionesDia} mapas con IA.</li>}
            </ul>
          </>
        )}

        {(fase === 'ajustes' || fase === 'generando') && extraido && (
          <div className={fase === 'generando' ? 'hidden' : 'flex flex-col gap-[18px]'}>
            {embebido && (
              <p className="text-[0.78rem] text-[#7D8A96]">{datosDocumento}</p>
            )}
            {extraido.avisos.map((a) => (
              <p key={a} className="-mb-2 text-xs font-medium text-[#B07A1E]">
                {a}
              </p>
            ))}

            {/* Documento largo: una pregunta con dos respuestas. Tema a tema ya activo: su estado. */}
            {ofrecerLibro && !porTemas && documentoGrande && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-[#FFF6DC] px-3.5 py-3" style={{ border: `2px solid ${INK}` }}>
                <span className="material-symbols-outlined text-[22px] text-[#B07A1E]" aria-hidden>auto_stories</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.82rem] font-semibold text-[#2C3E50]">
                    Es largo: {fmt(extraido.caracteres)} caracteres y en un mapa caben {fmt(maxChars)}. ¿Cómo lo hacemos?
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
                  Tema a tema · {fmt(temasLibro?.length ?? 0)} temas encontrados
                </span>
                <button type="button" onClick={desactivarTemas} className="text-xs font-bold text-[#7D8A96] hover:text-[#B04A5E]">
                  Quitar
                </button>
              </div>
            )}

            <div>
              <TituloBloque n={1} nota={nadaElegido ? undefined : `≈${fmt(nodosAprox)} nodos · ${segMin}–${segMax} s`}>
                ¿Cuánto detalle?
              </TituloBloque>
              <Opciones etiqueta="Estilo de los nodos">
                <OpcionAnimada
                  activa={modo === 'esquema'}
                  onElegir={() => setModo('esquema')}
                  titulo="Esquemático"
                  descripcion="Un dato clave por rama. Para repasar rápido."
                  dato={`≈${fmt(nodosCon('esquema'))} nodos`}
                  escena={<EscenaMapa rico={false} />}
                />
                <OpcionAnimada
                  activa={modo === 'detalle'}
                  onElegir={() => setModo('detalle')}
                  titulo="Con más contenido"
                  descripcion="Cifras, criterios y fármacos en cada rama."
                  dato={`≈${fmt(nodosCon('detalle'))} nodos`}
                  escena={<EscenaMapa rico />}
                />
              </Opciones>
              {estado.opciones?.tablas && (
                <LineaInterruptor
                  activo={tablas}
                  onCambiar={setTablas}
                  etiqueta="Añadir tablas comparativas"
                  info={`La IA prepara tablas de diagnóstico diferencial, criterios con puntos y clasificaciones.${
                    extraido.tablas ? ` Las ${extraido.tablas} tablas de tu documento se leen igual, actives esto o no.` : ''
                  }`}
                />
              )}
            </div>

            {carpeta.arbol && (
              <div>
                <TituloBloque n={2}>Dónde se guarda</TituloBloque>
                <DestinoCarpeta
                  arbol={carpeta.arbol}
                  valor={carpeta.valor}
                  sugerida={carpeta.sugerencia?.carpeta}
                  candidatas={carpeta.sugerencia?.candidatas}
                  onChange={carpeta.elegir}
                  disabled={fase === 'generando'}
                  {...(porTemas && guardarComo !== 'uno' && carpeta.valor.subjectId !== null && carpeta.valor.topicId === null
                    ? { nota: 'Cada tema irá a su carpeta dentro de la asignatura (o a «Toda la asignatura» si no encaja con ninguno).' }
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
                    onChange={elegir}
                    unidad={extraido.unidad ?? 'página'}
                    abierto={selectorAbierto}
                    onAbrir={setSelectorAbierto}
                    resumen={resumenParte}
                  />
                </FilaDetalle>
                {porTemas && (
                  <FilaDetalle
                    icono="library_books"
                    etiqueta="Cómo guardarlo"
                    valor={guardarComo === 'uno' ? 'Un mapa grande, con cada tema plegado' : `Un mapa por tema (${fmt(envioLibro?.temas.length ?? 0)})`}
                    abierta={filaAbierta === 'guardar'}
                    onAlternar={() => alternarFila('guardar')}
                  >
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo guardarlo">
                      {(
                        [
                          ['temas', 'Un mapa por tema'],
                          ['uno', 'Un mapa grande'],
                        ] as const
                      ).map(([id, nombre]) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={guardarComo === id}
                          onClick={() => setGuardarComo(id)}
                          className="rounded-full px-3 py-1 text-[0.75rem] font-bold"
                          style={{
                            border: `2px solid ${guardarComo === id ? INK : '#EDE6DE'}`,
                            background: guardarComo === id ? 'var(--cia-soft)' : '#fff',
                            color: guardarComo === id ? INK : '#7D8A96',
                          }}
                        >
                          {nombre}
                        </button>
                      ))}
                    </div>
                  </FilaDetalle>
                )}
                <FilaDetalle
                  icono="edit"
                  etiqueta={porTemas && guardarComo !== 'uno' ? 'Nombre del documento' : 'Título del mapa'}
                  valor={titulo.trim() || 'Sin título'}
                  abierta={filaAbierta === 'titulo'}
                  onAlternar={() => alternarFila('titulo')}
                >
                  <input
                    id="ia-titulo"
                    aria-label="Título"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value.slice(0, 120))}
                    className="w-full rounded-xl border-2 border-[#EDE6DE] bg-[#FAF7F4] px-3 py-2 text-[0.82rem] font-semibold text-[#2C3E50] outline-none focus:border-[var(--cia-acc)]"
                  />
                </FilaDetalle>
              </Detalles>
            </div>

            {nadaElegido && <p className="-mt-2 text-xs font-bold text-[#B04A5E]">Marca al menos una parte del documento.</p>}
            {excedeTexto && (
              <p role="alert" className="-mt-2 text-sm font-bold text-[#B04A5E]">
                Lo marcado tiene {fmt(caracteres)} caracteres: el máximo {porTemas ? 'tema a tema' : 'por mapa'} es {fmt(maxCharsUsado)}. Desmarca alguna parte.
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
                Has llegado al máximo de mapas con IA de hoy. Vuelve mañana.
              </p>
            )}
            {cupo && !nadaElegido && (
              <p className="-mt-2 text-xs text-[#7D8A96]" aria-live="polite">
                Usará {fmt(caracteres)} de los {fmt(charsRestantesHoy)} caracteres que te quedan hoy; mapas: te quedan {restantes} de {cupo.maxGeneracionesDia}.
              </p>
            )}
            {embebido && !nadaElegido && <PrecioIA precio={precio} />}
          </div>
        )}

        {fase === 'generando' && (
          <ProgresoIA
            herramienta="mapa"
            estimado={segMax}
            fases={conTablas && !porTemas ? ['leyendo', 'estructura', 'tablas', 'ordenando'] : ['leyendo', 'estructura', 'ordenando']}
            fase={faseIA}
            lineas={lineas}
            segundos={segundos}
            {...(porTemas
              ? {
                  arbol: arbolLibro(lineas, progresoTemas.map((t) => t.titulo)),
                  temas: progresoTemas,
                  detalle: progresoTemas.length
                    ? `Temas: ${temasListos} de ${progresoTemas.length} listos${temasFallidos ? ` · ${temasFallidos} no salieron` : ''}`
                    : undefined,
                }
              : {})}
          />
        )}

        {fase === 'hecho' && (
          <div className="rounded-2xl bg-white px-4 pb-4 pt-3" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
            <div className="flex items-center gap-3">
              <Image src="/img/mascota/celebracion.png" alt="" width={64} height={64} className="shrink-0 object-contain" />
              <p className="text-base font-extrabold text-[#2C3E50]">
                {creados.length === 1 && porTemas && guardarComo === 'uno'
                  ? `Mapa creado con ${fmt(progresoTemas.length - fallidos.length)} temas`
                  : creados.length === 1
                    ? 'Mapa creado'
                    : `${fmt(creados.length)} mapas creados`}
                <span className="block text-sm font-semibold text-[#7D8A96]">{fmt(creados.reduce((n, c) => n + c.nodos, 0))} nodos</span>
              </p>
            </div>
            <ul className="mt-3 max-h-[16rem] space-y-1 overflow-y-auto">
              {creados.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/mapas/${c.id}?ia=1`}
                    {...(embebido ? { target: '_blank', rel: 'noopener' } : {})}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[0.82rem] font-bold text-[#2C3E50] hover:bg-[#FAF7F4]"
                  >
                    <span className="min-w-0 truncate">{c.titulo}</span>
                    <span className="shrink-0 text-[0.72rem] font-semibold text-[#7D8A96]">{fmt(c.nodos)} nodos</span>
                  </a>
                </li>
              ))}
            </ul>
            {fallidos.length > 0 && (
              <div className="mt-3 rounded-xl bg-[#FAEAED] px-3 py-2 text-[0.78rem] text-[#B04A5E]">
                <p className="font-extrabold">No salieron {fallidos.length === 1 ? 'este tema' : `estos ${fallidos.length} temas`}:</p>
                <ul className="mt-1 list-disc pl-5">
                  {fallidos.map((f) => (
                    <li key={f.titulo}>
                      {f.titulo}: {f.motivo}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">Puedes generarlos aparte: vuelve a elegir el archivo y marca solo ese tema.</p>
              </div>
            )}
            <p className="mt-3 text-[0.75rem] text-[#7D8A96]">Cada nodo lleva la página de donde sale: la revisión guiada te lleva a lo dudoso.</p>
          </div>
        )}
      </div>

      {fase === 'hecho' && (
        <footer className="flex flex-wrap justify-end gap-3 bg-white px-5 py-4" style={{ borderTop: `2px solid ${INK}` }}>
          {!embebido && porTemas && fcEstado && extraido && archivo && temasLibro && (
            <button
              type="button"
              onClick={() => setAFlashcards(true)}
              className="mr-auto flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-[#2C3E50]"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              <span aria-hidden className="inline-block" style={{ color: 'var(--cia-acc-d)' }}>
                <span className="material-symbols-outlined text-[1.1rem] leading-none">style</span>
              </span>
              Hacer también las flashcards de estos temas
            </button>
          )}
          {creados.length === 1 ? (
            <button
              type="button"
              onClick={() => (embebido ? window.open(`/mapas/${creados[0].id}?ia=1`, '_blank', 'noopener') : router.push(`/mapas/${creados[0].id}?ia=1`))}
              className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: 'var(--cia-acc)', border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              Abrir el mapa
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
            Cerrar
          </button>
        </footer>
      )}

      {fase === 'ajustes' && !embebido && extraido && (
        <PieCrear
          precio={
            nadaElegido ? null : (
              <PrecioIA
                precio={precio}
                alternativas={[
                  porTemas ? 'Desmarca algún tema: el precio baja al momento.' : 'Marca menos partes del documento: el precio baja al momento.',
                  ...(conTablas ? ['Quita las tablas comparativas (casi duplican el precio).'] : []),
                  ...(modo === 'detalle' ? ['Pasa a «Esquemático».'] : []),
                ]}
              />
            )
          }
          boton={porTemas ? 'Generar los temas' : 'Generar mapa'}
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
      <div data-cia="mapa" className={visible ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
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
        aria-labelledby="crear-ia-titulo"
        data-cia="mapa"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-[#FAF7F4]"
        style={{ border: `2px solid ${INK}`, boxShadow: `8px 8px 0 0 ${INK}` }}
      >
        {cuerpo}
      </div>
      {estilos}
    </div>
  )
}
