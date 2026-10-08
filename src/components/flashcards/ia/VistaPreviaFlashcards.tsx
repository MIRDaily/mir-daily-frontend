'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseBrowser'
import {
  createFlashcardDeck,
  createFlashcardsBulk,
  fetchFlashcardDecks,
  FLASHCARD_LEVELS,
  LEVEL_INFO,
  type FlashcardDeck,
  type FlashcardLevel,
} from '@/lib/studioFlashcards'
import { DEFAULT_COLOR_KEY, DEFAULT_ICON } from '@/lib/flashcardTheme'
import {
  agrupar,
  CANTIDAD_MAS_DEFECTO,
  CANTIDADES_MAS,
  contarNiveles,
  insertarNuevas,
  nivelesParaEmpezar,
  OPCIONES_MAS,
  origenTexto,
  paginasDeTema,
  paraGuardar,
  tarjetasDeTema,
  type Borrador,
  type FuenteGuardar,
  type OpcionMas,
} from '@/lib/flashcards/ia/tarjetas'
import type { MasGeneradas } from '@/lib/flashcards/ia/api'
import { NivelBadge } from './NivelBadge'

// Vista previa de las flashcards con IA (documento o rama de un mapa): por tema (plegable) y, dentro,
// de fácil a demencial. Pensada para revisar RÁPIDO: si hay dudosas se abre en ellas y el resto se
// da por bueno; las tarjetas son texto (solo la que se edita es un cuadro de texto: con 300 tarjetas
// sigue fluida) y todo se hace con el teclado (↑/↓, Espacio, 1-4, E, Esc). Cada cambio se guarda
// como borrador en este navegador (`persistir`), y al guardar las tarjetas se borra (`alGuardar`).
// Luego, un clic para empezar a estudiarlas por lo fácil.
//
// «Más» en la cabecera de cada tema (paquete 2): pide a la IA tarjetas NUEVAS solo de ese tema (de
// todos los niveles, más difíciles o más fáciles; 5, 10 o 20) y las mete en su sitio, marcadas como
// nuevas hasta que se tocan. Quién la llama (documento o mapa) decide qué fragmento viaja (`mas`).

const INK = '#2C3E50'
const MAX_POR_GRUPO = 500
const RETARDO_BORRADOR = 600

type Destino = 'nuevo' | 'existente' | 'porTema'

/** «Más de este tema»: lo pone quien abre la vista previa (sabe de dónde salen las tarjetas). */
export type MasConfig = {
  pedir: (
    p: { tema: string; niveles: FlashcardLevel[]; cantidad: number; existentes: { pregunta: string; respuesta: string }[]; paginas: number[] },
    signal: AbortSignal,
  ) => Promise<MasGeneradas>
  /** Si ahora no se puede (falta el texto del documento): la explicación y cómo arreglarlo. */
  bloqueo?: React.ReactNode
  /** Cuántas veces quedan hoy (si se sabe). */
  restantes?: number
}
type EstadoMas = { tema: string; cargando: boolean; mensaje?: string; error?: string }
type Hecho = { id: string; nombre: string; creadas: number; duplicadas: number; niveles: FlashcardLevel[] }

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Inicia sesión para guardar las flashcards.')
  return session.access_token
}

const filas = (s: string) => Math.min(4, Math.max(1, Math.ceil(s.length / 46)))
const esCampo = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)

export function VistaPreviaFlashcards({
  inicial,
  nombreGrupo,
  fuente = {},
  persistir,
  alGuardar,
  onVolver,
  onCerrar,
  mas,
}: {
  inicial: Borrador[]
  /** Nombre propuesto para un grupo nuevo. */
  nombreGrupo: string
  /** Origen común de las tarjetas (archivo, rama del mapa): se guarda con cada una. */
  fuente?: FuenteGuardar
  /** Guardar el borrador (con un pequeño retardo tras cada cambio). */
  persistir?: (lista: Borrador[]) => void
  /** Las tarjetas se han guardado bien (el borrador ya sobra). */
  alGuardar?: () => void
  /** Volver a los ajustes (generar otra vez). */
  onVolver?: () => void
  onCerrar: () => void
  /** «Más de este tema» (sin esto, no se ofrece). */
  mas?: MasConfig
}) {
  const [lista, setLista] = useState<Borrador[]>(inicial)
  const dudosasIniciales = inicial.filter((b) => b.ia?.dudoso).length
  const [soloDudosas, setSoloDudosas] = useState(dudosasIniciales > 0)
  const [plegados, setPlegados] = useState<Set<string>>(new Set())
  const [activo, setActivo] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  // Documento tema a tema: cada borrador lleva su tema del libro (`grupo`).
  const temasLibro = new Set(inicial.map((b) => b.grupo).filter(Boolean)).size
  const porTemaDisponible = temasLibro > 1
  const [destino, setDestino] = useState<Destino>(porTemaDisponible ? 'porTema' : 'nuevo')
  const [nombre, setNombre] = useState(nombreGrupo.slice(0, 80))
  const [decks, setDecks] = useState<FlashcardDeck[] | null>(null)
  const [deckId, setDeckId] = useState('')
  const [guardando, setGuardando] = useState<{ hecho: number; total: number } | null>(null)
  const [hechos, setHechos] = useState<Hecho[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Grupos ya creados en un intento anterior (si algo falla a medias, no se crean dos veces).
  const creados = useRef(new Map<string, FlashcardDeck>())
  const tarjetasRef = useRef(new Map<string, HTMLDivElement>())
  const contenedor = useRef<HTMLDivElement>(null)
  // «Más de este tema»: el tema con el panel abierto, lo elegido y en qué está.
  const [masAbierto, setMasAbierto] = useState<string | null>(null)
  const [masOpcion, setMasOpcion] = useState<OpcionMas>('mas')
  const [masCantidad, setMasCantidad] = useState<number>(CANTIDAD_MAS_DEFECTO)
  const [masEstado, setMasEstado] = useState<EstadoMas | null>(null)
  const masAbort = useRef<AbortController | null>(null)
  const irA = useRef<string | null>(null)
  useEffect(() => () => masAbort.current?.abort(), [])

  useEffect(() => {
    let vivo = true
    token()
      .then(fetchFlashcardDecks)
      .then((d) => vivo && setDecks(d))
      .catch(() => vivo && setDecks([]))
    return () => {
      vivo = false
    }
  }, [])

  // Borrador: cada cambio, con un pequeño retardo (y no después de guardar).
  const primero = useRef(true)
  useEffect(() => {
    if (primero.current) {
      primero.current = false
      return
    }
    if (!persistir || hechos) return
    const t = setTimeout(() => persistir(lista), RETARDO_BORRADOR)
    return () => clearTimeout(t)
  }, [lista, persistir, hechos])

  const grupoDe = useCallback((b: Borrador) => b.grupo || nombreGrupo, [nombreGrupo])
  const elegidas = useMemo(() => lista.filter((b) => b.incluir && b.pregunta.trim() && b.respuesta.trim()), [lista])
  const niveles = contarNiveles(lista)
  const dudosas = lista.filter((b) => b.ia?.dudoso).length
  const secciones = useMemo(() => agrupar(lista), [lista])
  const destinoDeck = decks?.find((d) => d.id === deckId)

  // Lo que se ve, en orden (para moverse con ↑/↓): sin los temas plegados y, si toca, solo dudosas.
  const visibles = useMemo(
    () =>
      secciones
        .filter((s) => !plegados.has(s.tema))
        .flatMap((s) => s.niveles.flatMap((g) => g.indices))
        .filter((i) => !soloDudosas || lista[i].ia?.dudoso),
    [secciones, plegados, soloDudosas, lista],
  )
  const indiceDe = useMemo(() => new Map(lista.map((b, i) => [b.key, i])), [lista])

  // Cuántas van a cada grupo (para el tope de 500).
  const reparto = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of elegidas) {
      const g = destino === 'porTema' ? grupoDe(b) : nombre
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [elegidas, destino, nombre, grupoDe])
  const excede =
    destino === 'existente'
      ? !!destinoDeck && destinoDeck.totalCards + elegidas.length > MAX_POR_GRUPO
      : [...reparto.values()].some((n) => n > MAX_POR_GRUPO)
  const nombreOk = destino !== 'nuevo' || nombre.trim().length >= 3
  const puede = elegidas.length > 0 && !excede && nombreOk && (destino !== 'existente' || !!destinoDeck) && !guardando

  // Manejadores ESTABLES (con la clave como argumento): con FilaTarjeta en memo, una tecla solo
  // repinta las tarjetas que cambian (con 300, cada flecha repintaba las 300: ~60 ms en desarrollo).
  // Tocar una tarjeta nueva («Más de este tema») le quita la marca.
  const cambiar = useCallback(
    (key: string, p: Partial<Borrador>) => setLista((l) => l.map((b) => (b.key === key ? { ...b, ...p, nueva: undefined } : b))),
    [],
  )
  const editarTarjeta = useCallback((key: string) => {
    setActivo(key)
    setEditando(key)
  }, [])
  const registrar = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) tarjetasRef.current.set(key, el)
    else tarjetasRef.current.delete(key)
  }, [])
  const alternarNivel = (n: FlashcardLevel) => {
    const todas = lista.filter((b) => b.nivel === n).every((b) => b.incluir)
    setLista((l) => l.map((b) => (b.nivel === n ? { ...b, incluir: !todas } : b)))
  }
  const alternarPlegado = (tema: string) =>
    setPlegados((p) => {
      const n = new Set(p)
      if (n.has(tema)) n.delete(tema)
      else n.add(tema)
      return n
    })

  // La tarjeta activa siempre a la vista (y, si era nueva, ya se ha tocado).
  useEffect(() => {
    if (!activo) return
    tarjetasRef.current.get(activo)?.scrollIntoView({ block: 'nearest' })
    setLista((l) => (l.some((b) => b.key === activo && b.nueva) ? l.map((b) => (b.key === activo ? { ...b, nueva: undefined } : b)) : l))
  }, [activo])

  // Tras añadir las de «Más», la primera a la vista (sin activarla: seguiría siendo nueva).
  useEffect(() => {
    if (!irA.current) return
    tarjetasRef.current.get(irA.current)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    irA.current = null
  }, [lista])

  const pedirMas = async (tema: string) => {
    if (!mas || masEstado?.cargando) return
    const opcion = OPCIONES_MAS.find((o) => o.id === masOpcion) ?? OPCIONES_MAS[0]
    masAbort.current?.abort()
    const ctl = new AbortController()
    masAbort.current = ctl
    setMasEstado({ tema, cargando: true })
    try {
      const r = await mas.pedir(
        { tema, niveles: opcion.niveles, cantidad: masCantidad, existentes: tarjetasDeTema(lista, tema), paginas: paginasDeTema(lista, tema) },
        ctl.signal,
      )
      if (ctl.signal.aborted) return
      const repetidas = r.repetidas ? ` · ${r.repetidas} ${r.repetidas === 1 ? 'quitada por repetir' : 'quitadas por repetir'} una que ya tenías` : ''
      if (!r.tarjetas.length) {
        setMasEstado({ tema, cargando: false, error: `No han salido tarjetas nuevas de este tema${repetidas}.` })
        return
      }
      setLista((l) => {
        const nueva = insertarNuevas(l, tema, r.tarjetas)
        irA.current = nueva.find((b) => b.nueva && b.tema === tema && !l.some((x) => x.key === b.key))?.key ?? null
        return nueva
      })
      setPlegados((p) => {
        if (!p.has(tema)) return p
        const n = new Set(p)
        n.delete(tema)
        return n
      })
      setSoloDudosas(false)
      setMasEstado({ tema, cargando: false, mensaje: `+${r.tarjetas.length} ${r.tarjetas.length === 1 ? 'nueva' : 'nuevas'}${repetidas}` })
      setMasAbierto(null)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMasEstado({ tema, cargando: false, error: e instanceof Error ? e.message : 'No se pudieron generar más tarjetas' })
    }
  }

  // Teclado. En captura y parando la propagación: dentro del editor de mapas, sus atajos (borrar
  // nodo, mover…) no deben actuar mientras se revisa.
  useEffect(() => {
    if (hechos || guardando) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Dentro del panel «Más» manda el panel (Espacio y Enter pulsan sus botones).
      if (e.target instanceof HTMLElement && e.target.closest('[data-mas-panel]')) {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setMasAbierto(null)
        }
        return
      }
      if (esCampo(e.target)) {
        if (e.key === 'Escape' && editando) {
          e.preventDefault()
          e.stopPropagation()
          setEditando(null)
          contenedor.current?.focus()
        }
        return
      }
      e.stopPropagation()
      if (!visibles.length) return
      const pos = activo ? visibles.indexOf(indiceDe.get(activo) ?? -1) : -1
      const mover = (d: number) => {
        e.preventDefault()
        const sig = visibles[Math.min(visibles.length - 1, Math.max(0, pos < 0 ? 0 : pos + d))]
        setActivo(lista[sig].key)
      }
      if (e.key === 'ArrowDown' || e.key === 'j') return mover(1)
      if (e.key === 'ArrowUp' || e.key === 'k') return mover(-1)
      if (!activo) return
      const b = lista[indiceDe.get(activo) ?? -1]
      if (!b) return
      if (e.key === ' ') {
        e.preventDefault()
        cambiar(b.key, { incluir: !b.incluir })
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        cambiar(b.key, { nivel: Number(e.key) as FlashcardLevel })
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        e.preventDefault()
        setEditando(b.key)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setActivo(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [hechos, guardando, visibles, activo, editando, lista, indiceDe, cambiar])

  const guardar = async () => {
    if (!puede) return
    setError(null)
    setEditando(null)
    try {
      const tk = await token()
      const lotes: { nombre: string; deck?: FlashcardDeck; tarjetas: Borrador[] }[] = []
      if (destino === 'existente') lotes.push({ nombre: destinoDeck!.name, deck: destinoDeck!, tarjetas: elegidas })
      else if (destino === 'nuevo') lotes.push({ nombre: nombre.trim(), tarjetas: elegidas })
      else {
        const m = new Map<string, Borrador[]>()
        for (const b of elegidas) (m.get(grupoDe(b)) ?? m.set(grupoDe(b), []).get(grupoDe(b))!).push(b)
        for (const [n, ts] of m) lotes.push({ nombre: n, tarjetas: ts })
      }
      const total = elegidas.length
      let hecho = 0
      setGuardando({ hecho, total })
      const resultado: Hecho[] = []
      for (const lote of lotes) {
        let deck = lote.deck ?? creados.current.get(lote.nombre)
        if (!deck) {
          // El backend exige 3 caracteres y no admite dos grupos con el mismo nombre.
          const n = lote.nombre.length >= 3 ? lote.nombre.slice(0, 80) : `${lote.nombre} (IA)`
          deck = await createFlashcardDeck(tk, { name: n, color: DEFAULT_COLOR_KEY, icon: DEFAULT_ICON })
          creados.current.set(lote.nombre, deck)
        }
        const r = await createFlashcardsBulk(tk, deck.id, paraGuardar(lote.tarjetas, fuente), {
          aiGenerated: true,
          onProgress: (d) => setGuardando({ hecho: hecho + d, total }),
        })
        hecho += lote.tarjetas.length
        resultado.push({ id: deck.id, nombre: deck.name, creadas: r.created, duplicadas: r.duplicates, niveles: nivelesParaEmpezar(lote.tarjetas) })
      }
      setHechos(resultado)
      alGuardar?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar las flashcards')
    } finally {
      setGuardando(null)
    }
  }

  // Con la escalera de dificultad (activada por defecto) no hace falta filtrar niveles: la sesión
  // empieza por lo más fácil de cada tema y abre cada nivel al dominar el anterior.
  const estudiar = (h: Hecho) => `/flashcards/${h.id}?study=1`

  if (hechos) {
    const creadas = hechos.reduce((n, h) => n + h.creadas, 0)
    const duplicadas = hechos.reduce((n, h) => n + h.duplicadas, 0)
    return (
      <div className="px-6 pb-6">
        <div className="rounded-2xl bg-white px-4 py-4" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
          <p className="flex items-center gap-2 text-base font-extrabold text-[#2C3E50]">
            <span aria-hidden className="inline-block text-[#8BA888]">
              <span className="material-symbols-outlined text-[1.4rem] leading-none">task_alt</span>
            </span>
            {creadas} {creadas === 1 ? 'flashcard guardada' : 'flashcards guardadas'}
          </p>
          {duplicadas > 0 && (
            <p className="mt-1 text-[0.8rem] text-[#7D8A96]">
              {duplicadas} ya {duplicadas === 1 ? 'estaba' : 'estaban'} en el grupo y no se {duplicadas === 1 ? 'ha' : 'han'} repetido.
            </p>
          )}
          <ul className="mt-3 max-h-[14rem] space-y-1 overflow-y-auto">
            {hechos.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 hover:bg-[#FAF7F4]">
                <Link href={`/flashcards/${h.id}`} className="min-w-0 truncate text-[0.82rem] font-bold text-[#2C3E50]">
                  {h.nombre}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-[#7D8A96]">{h.creadas} tarjetas</span>
                  {hechos.length > 1 && (
                    <Link href={estudiar(h)} className="rounded-lg px-2 py-0.5 text-[0.72rem] font-extrabold text-[#C4655A] hover:bg-[#FCEFEC]">
                      Estudiar
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {hechos.length === 1 && hechos[0].niveles.length > 1 && (
            <p className="mt-2 text-[0.75rem] text-[#7D8A96]">
              Empiezas por lo más fácil de cada tema: la escalera abre cada nivel cuando dominas el 80 % de lo anterior. En el grupo puedes
              quitarla o elegir niveles.
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          {hechos.length === 1 && (
            <Link
              href={estudiar(hechos[0])}
              className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              <span aria-hidden className="inline-block">
                <span className="material-symbols-outlined text-[1.1rem] leading-none">play_arrow</span>
              </span>
              Empezar a estudiar
            </Link>
          )}
          <button type="button" onClick={onCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  const todasIncluidas = elegidas.length === lista.length

  return (
    <>
      <div ref={contenedor} tabIndex={-1} className="overflow-y-auto px-6 pb-4 outline-none">
        {error && (
          <div role="alert" className="mb-3 rounded-2xl border border-[#D4667A]/30 bg-[#FAEAED] px-4 py-3 text-sm font-medium text-[#B04A5E]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-[#2C3E50]">
            {elegidas.length} de {lista.length} tarjetas · {secciones.length} {secciones.length === 1 ? 'tema' : 'temas'}
          </span>
          <span className="rounded-full bg-[#2C3E50] px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-white">Generado por IA</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Incluir por nivel">
          {FLASHCARD_LEVELS.map((n) => {
            const total = lista.filter((b) => b.nivel === n).length
            if (!total) return null
            const on = lista.filter((b) => b.nivel === n).some((b) => b.incluir)
            return (
              <button
                key={n}
                type="button"
                onClick={() => alternarNivel(n)}
                aria-pressed={on}
                title={on ? `Quitar todas las de nivel ${LEVEL_INFO[n].name.toLowerCase()}` : `Volver a incluir las de nivel ${LEVEL_INFO[n].name.toLowerCase()}`}
                className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold"
                style={{
                  border: `1.5px solid ${on ? LEVEL_INFO[n].color : '#D4C8BE'}`,
                  background: on ? LEVEL_INFO[n].soft : '#FFFFFF',
                  color: on ? LEVEL_INFO[n].color : '#7D8A96',
                  textDecoration: on ? undefined : 'line-through',
                }}
              >
                {LEVEL_INFO[n].name} · {niveles[n]}/{total}
              </button>
            )
          })}
          {dudosas > 0 && (
            <button
              type="button"
              onClick={() => setSoloDudosas((v) => !v)}
              aria-pressed={soloDudosas}
              className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold"
              style={{ border: '1.5px solid #D9A441', background: soloDudosas ? '#D9A441' : '#FBF3E1', color: soloDudosas ? '#FFFFFF' : '#8A6418' }}
            >
              {soloDudosas ? 'Ver todas' : `Revisar ${dudosas} ${dudosas === 1 ? 'dudosa' : 'dudosas'}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlegados(plegados.size ? new Set() : new Set(secciones.map((s) => s.tema)))}
            className="rounded-full px-2.5 py-1 text-[0.72rem] font-bold text-[#7D8A96] underline"
          >
            {plegados.size ? 'Desplegar todo' : 'Plegar todo'}
          </button>
        </div>
        {soloDudosas ? (
          <p className="mt-2 rounded-xl bg-[#FBF3E1] px-3 py-2 text-[0.75rem] font-semibold text-[#8A6418]">
            Solo las dudosas: tienen un dato que el documento no dice igual o lejos de su tema. Las demás se guardan tal cual; si quieres verlas, «Ver todas».
          </p>
        ) : (
          <p className="mt-2 text-[0.75rem] text-[#7D8A96]">La IA puede equivocarse. Las de borde ámbar tienen un dato que el documento no dice igual o lejos de su tema.</p>
        )}
        <p className="mt-1 text-[0.7rem] text-[#7D8A96]" aria-label="Atajos de teclado">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> moverse · <Kbd>Espacio</Kbd> incluir o quitar · <Kbd>1</Kbd>–<Kbd>4</Kbd> nivel · <Kbd>E</Kbd> editar · <Kbd>Esc</Kbd> salir
        </p>

        <div className="mt-3 space-y-3">
          {secciones.map((s) => {
            const indices = s.niveles.flatMap((g) => g.indices).filter((i) => !soloDudosas || lista[i].ia?.dudoso)
            if (!indices.length) return null
            const plegado = plegados.has(s.tema)
            const porNivel = contarNiveles(s.niveles.flatMap((g) => g.indices).map((i) => lista[i]))
            return (
              <section key={s.tema}>
                <div className="mb-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alternarPlegado(s.tema)}
                    aria-expanded={!plegado}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span aria-hidden className="inline-block text-[#7D8A96]">
                      <span className="material-symbols-outlined text-[1.1rem] leading-none">{plegado ? 'chevron_right' : 'expand_more'}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.8rem] font-extrabold uppercase tracking-wide text-[#2C3E50]">{s.tema}</span>
                    <span className="flex shrink-0 gap-1">
                      {FLASHCARD_LEVELS.filter((n) => porNivel[n]).map((n) => (
                        <span key={n} className="rounded-full px-1.5 text-[0.65rem] font-extrabold" style={{ background: LEVEL_INFO[n].soft, color: LEVEL_INFO[n].color }}>
                          {porNivel[n]}
                        </span>
                      ))}
                    </span>
                  </button>
                  {mas && (
                    <button
                      type="button"
                      onClick={() => setMasAbierto((t) => (t === s.tema ? null : s.tema))}
                      aria-expanded={masAbierto === s.tema}
                      disabled={!!guardando}
                      title="Pedir a la IA más tarjetas de este tema"
                      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[0.7rem] font-extrabold text-[#C4655A] hover:bg-[#FCEFEC] disabled:opacity-40"
                      style={{ border: '1.5px solid #E8A598' }}
                    >
                      <span aria-hidden className="inline-block">
                        <span className="material-symbols-outlined text-[0.95rem] leading-none">add</span>
                      </span>
                      Más
                    </button>
                  )}
                </div>
                {mas && masAbierto === s.tema && (
                  <PanelMas
                    tema={s.tema}
                    mas={mas}
                    opcion={masOpcion}
                    setOpcion={setMasOpcion}
                    cantidad={masCantidad}
                    setCantidad={setMasCantidad}
                    cargando={masEstado?.tema === s.tema && masEstado.cargando}
                    error={masEstado?.tema === s.tema ? masEstado.error : undefined}
                    onPedir={() => void pedirMas(s.tema)}
                    onCerrar={() => {
                      masAbort.current?.abort()
                      setMasEstado(null)
                      setMasAbierto(null)
                    }}
                  />
                )}
                {masEstado?.tema === s.tema && masEstado.mensaje && masAbierto !== s.tema && (
                  <p role="status" className="mb-1.5 text-[0.72rem] font-bold text-[#5E8C5A]">
                    {masEstado.mensaje}
                  </p>
                )}
                {!plegado && (
                  <div className="space-y-1.5">
                    {indices.map((i) => {
                      const b = lista[i]
                      return (
                        <FilaTarjeta
                          key={b.key}
                          b={b}
                          activa={activo === b.key}
                          editando={editando === b.key}
                          bloqueada={!!guardando}
                          registrar={registrar}
                          activar={setActivo}
                          editar={editarTarjeta}
                          cambiar={cambiar}
                        />
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dónde guardarlas">
          {(
            [
              ...(porTemaDisponible ? [['porTema', `Un grupo por tema (${temasLibro})`] as const] : []),
              ['nuevo', 'Grupo nuevo'] as const,
              ['existente', 'Añadir a un grupo'] as const,
            ] as const
          ).map(([id, txt]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={destino === id}
              disabled={!!guardando || (id === 'existente' && !decks?.length)}
              onClick={() => setDestino(id)}
              className="rounded-xl px-3 py-1.5 text-xs font-extrabold disabled:opacity-40"
              style={{ border: `2px solid ${destino === id ? '#E8A598' : '#EDE6DE'}`, color: destino === id ? '#2C3E50' : '#7D8A96', background: '#FFFFFF' }}
            >
              {id === 'existente' && decks === null ? 'Cargando grupos…' : txt}
            </button>
          ))}
        </div>
        <div className="mt-2">
          {destino === 'nuevo' && (
            <input
              value={nombre}
              disabled={!!guardando}
              maxLength={80}
              onChange={(e) => setNombre(e.target.value)}
              aria-label="Nombre del grupo nuevo"
              className="w-full rounded-xl border border-[#7D8A96]/25 bg-white px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
            />
          )}
          {destino === 'existente' && (
            <select
              value={deckId}
              disabled={!!guardando}
              onChange={(e) => setDeckId(e.target.value)}
              aria-label="Grupo de destino"
              className="w-full rounded-xl border border-[#7D8A96]/25 bg-white px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
            >
              <option value="">Elige un grupo…</option>
              {(decks ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.totalCards})
                </option>
              ))}
            </select>
          )}
          {destino === 'porTema' && <p className="text-xs text-[#7D8A96]">Cada tema del documento, en su propio grupo con su nombre.</p>}
          {!nombreOk && <p className="mt-1 text-xs font-bold text-[#B04A5E]">El nombre necesita al menos 3 caracteres.</p>}
          {excede && <p className="mt-1 text-xs font-bold text-[#B04A5E]">Un grupo admite como mucho {MAX_POR_GRUPO} tarjetas: quita algunas o guárdalas por temas.</p>}
          {destino === 'existente' && destinoDeck && (
            <p className="mt-1 text-xs text-[#7D8A96]">Las que ya estén en «{destinoDeck.name}» con el mismo anverso y reverso no se repiten.</p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-end gap-3">
          {guardando ? (
            <span role="status" className="mr-auto text-xs font-bold text-[#7D8A96]">
              Guardando {guardando.hecho} de {guardando.total}…
            </span>
          ) : persistir ? (
            <span className="mr-auto text-[0.7rem] text-[#7D8A96]">Se guarda solo como borrador en este navegador.</span>
          ) : null}
          {onVolver && (
            <button type="button" onClick={onVolver} disabled={!!guardando} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40">
              Volver a generar
            </button>
          )}
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!puede}
            className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
          >
            <span aria-hidden className="inline-block">
              <span className="material-symbols-outlined text-[1.1rem] leading-none">style</span>
            </span>
            {creados.current.size ? 'Reintentar' : todasIncluidas ? `Guardar todo (${elegidas.length})` : `Guardar ${elegidas.length} ${elegidas.length === 1 ? 'flashcard' : 'flashcards'}`}
          </button>
        </div>
      </footer>
    </>
  )
}

function PanelMas({
  tema,
  mas,
  opcion,
  setOpcion,
  cantidad,
  setCantidad,
  cargando,
  error,
  onPedir,
  onCerrar,
}: {
  tema: string
  mas: MasConfig
  opcion: OpcionMas
  setOpcion: (o: OpcionMas) => void
  cantidad: number
  setCantidad: (n: number) => void
  cargando: boolean
  error?: string
  onPedir: () => void
  onCerrar: () => void
}) {
  const sinCupo = mas.restantes !== undefined && mas.restantes <= 0
  return (
    <div data-mas-panel className="mb-2 rounded-xl bg-white p-3" style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}>
      {mas.bloqueo ? (
        <div className="text-[0.78rem] text-[#2C3E50]">{mas.bloqueo}</div>
      ) : (
        <>
          <div className="grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label={`Qué tarjetas añadir a ${tema}`}>
            {OPCIONES_MAS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={opcion === o.id}
                disabled={cargando}
                onClick={() => setOpcion(o.id)}
                className="rounded-lg px-2.5 py-1.5 text-left"
                style={{ border: `2px solid ${opcion === o.id ? '#E8A598' : '#EDE6DE'}`, background: opcion === o.id ? '#FCEFEC' : '#FFFFFF' }}
              >
                <span className="block text-[0.76rem] font-extrabold text-[#2C3E50]">{o.titulo}</span>
                <span className="block text-[0.68rem] text-[#7D8A96]">{o.descripcion}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[0.72rem] font-bold text-[#7D8A96]">Cuántas</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Cuántas tarjetas">
              {CANTIDADES_MAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={cantidad === n}
                  disabled={cargando}
                  onClick={() => setCantidad(n)}
                  className="min-w-[2.2rem] rounded-lg px-2 py-0.5 text-[0.76rem] font-extrabold"
                  style={{ border: `2px solid ${cantidad === n ? '#E8A598' : '#EDE6DE'}`, color: cantidad === n ? '#2C3E50' : '#7D8A96' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={onCerrar} className="rounded-lg px-2 py-1 text-[0.74rem] font-bold text-[#7D8A96] hover:text-[#2C3E50]">
                {cargando ? 'Cancelar' : 'Cerrar'}
              </button>
              <button
                type="button"
                onClick={onPedir}
                disabled={cargando || sinCupo}
                className="flex items-center gap-1 rounded-lg bg-[#E8A598] px-3 py-1 text-[0.76rem] font-extrabold text-white disabled:opacity-60"
                style={{ border: `2px solid ${INK}` }}
              >
                <span aria-hidden className={`inline-block ${cargando ? 'animate-spin' : ''}`}>
                  <span className="material-symbols-outlined text-[0.95rem] leading-none">{cargando ? 'progress_activity' : 'auto_awesome'}</span>
                </span>
                {cargando ? 'Generando…' : 'Generar'}
              </button>
            </span>
          </div>
          <p className="mt-1.5 text-[0.68rem] text-[#7D8A96]">
            Solo de este tema y sin repetir las que ya hay. Viaja el texto de este tema, no el documento entero.
            {mas.restantes !== undefined ? ` Hoy te quedan ${Math.max(0, mas.restantes)}.` : ''}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[0.74rem] font-bold text-[#B04A5E]">
          {error}
        </p>
      )}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-[1px] inline-block rounded border border-[#D9D0CB] bg-[#FBF8F6] px-1 text-[0.65rem] font-bold text-[#8A7F79]">{children}</kbd>
}

const FilaTarjeta = memo(function FilaTarjeta({
  b,
  activa,
  editando,
  bloqueada,
  registrar,
  activar,
  editar,
  cambiar,
}: {
  b: Borrador
  activa: boolean
  editando: boolean
  bloqueada: boolean
  registrar: (key: string, el: HTMLDivElement | null) => void
  activar: (key: string) => void
  editar: (key: string) => void
  cambiar: (key: string, p: Partial<Borrador>) => void
}) {
  const refEl = useCallback((el: HTMLDivElement | null) => registrar(b.key, el), [registrar, b.key])
  const onActivar = () => activar(b.key)
  const onEditar = () => editar(b.key)
  const onCambio = (p: Partial<Borrador>) => cambiar(b.key, p)
  const origen = origenTexto(b.ia)
  const campo = 'w-full resize-y rounded-lg border border-[#7D8A96]/20 bg-white px-2 py-1 text-[0.82rem] leading-snug text-[#2C3E50] outline-none focus:border-[#E8A598]'
  const borde = activa ? '#E8A598' : b.nueva ? '#5E8C5A' : b.ia?.dudoso ? '#D9A441' : b.incluir ? INK : '#E5DED6'
  return (
    <div
      ref={refEl}
      onClick={onActivar}
      onDoubleClick={onEditar}
      data-activa={activa || undefined}
      className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-xl bg-white p-2 sm:grid-cols-[auto_1fr_1fr]"
      style={{ border: `${activa ? 2.5 : 1.5}px solid ${borde}`, opacity: b.incluir ? 1 : 0.55, boxShadow: activa ? `2px 2px 0 0 ${INK}` : undefined }}
    >
      <input
        type="checkbox"
        checked={b.incluir}
        disabled={bloqueada}
        onChange={(e) => onCambio({ incluir: e.target.checked })}
        onClick={(e) => e.stopPropagation()}
        aria-label="Incluir esta tarjeta"
        style={{ accentColor: '#E8A598', width: 16, height: 16, marginTop: 4 }}
      />
      {editando ? (
        <>
          <textarea
            autoFocus
            value={b.pregunta}
            disabled={bloqueada}
            rows={filas(b.pregunta)}
            maxLength={300}
            onChange={(e) => onCambio({ pregunta: e.target.value })}
            aria-label="Pregunta (anverso)"
            className={`${campo} font-bold`}
          />
          <textarea
            value={b.respuesta}
            disabled={bloqueada}
            rows={filas(b.respuesta)}
            maxLength={200}
            onChange={(e) => onCambio({ respuesta: e.target.value })}
            aria-label="Respuesta (reverso)"
            className={`${campo} col-start-2 sm:col-start-auto`}
          />
        </>
      ) : (
        <>
          <p className="min-w-0 break-words py-0.5 text-[0.82rem] font-bold leading-snug text-[#2C3E50]">{b.pregunta}</p>
          <p className="col-start-2 min-w-0 break-words py-0.5 text-[0.82rem] leading-snug text-[#2C3E50] sm:col-start-auto">{b.respuesta}</p>
        </>
      )}
      <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-span-2">
        {b.nueva && (
          <span className="rounded-full bg-[#E7F0E5] px-2 py-0.5 text-[0.66rem] font-extrabold uppercase tracking-wide text-[#5E8C5A]">Nueva</span>
        )}
        <NivelBadge nivel={b.nivel} />
        <select
          value={b.nivel}
          disabled={bloqueada}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onCambio({ nivel: Number(e.target.value) as FlashcardLevel })}
          aria-label="Cambiar el nivel"
          className="rounded-md border border-[#7D8A96]/25 bg-white px-1 py-0.5 text-[0.7rem] font-bold text-[#7D8A96]"
        >
          {FLASHCARD_LEVELS.map((n) => (
            <option key={n} value={n}>
              {LEVEL_INFO[n].name}
            </option>
          ))}
        </select>
        {!editando && (
          <button
            type="button"
            disabled={bloqueada}
            onClick={(e) => {
              e.stopPropagation()
              onEditar()
            }}
            className="rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#2C3E50]"
          >
            Editar
          </button>
        )}
        {origen && <span className="text-[0.7rem] font-semibold text-[#7D8A96]">{origen}</span>}
        {b.ia?.dudoso && (
          <span className="rounded-full bg-[#FBF3E1] px-2 py-0.5 text-[0.68rem] font-extrabold text-[#8A6418]">
            {b.ia.dudoso === 'tratamiento' ? 'Revisa: tratamiento lejos de su tema' : 'Revisa: el documento no lo dice igual'}
          </span>
        )}
      </div>
    </div>
  )
})
