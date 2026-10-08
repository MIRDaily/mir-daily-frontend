'use client'

// Flashcards: Hub -> Asignaturas -> Temas -> Tarjetas.
//
// Las ASIGNATURAS van en lista (SubjectList), no en el mapa radial: el radial
// reparte los nodos en un círculo de radio fijo, así que pasadas ~15 asignaturas
// se solapan y el resto se sale del lienzo recortado. Los TEMAS, que suelen ser
// pocos, siguen pudiendo verse como mapa con el conmutador Lista/Mapa. Las
// tarjetas, como rejilla.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseBrowser'
import SubjectModal from '@/components/studio/SubjectModal'
import FlashcardCreateModal from '@/components/studio/FlashcardCreateModal'
import CrearFlashcardsIA from '@/components/flashcards/ia/CrearFlashcardsIA'
import { flashcardsIAEstado } from '@/lib/flashcards/ia/api'
import type { EstadoFlashcardsIA } from '@/lib/flashcards/ia/tarjetas'
import { borrarBorrador, haceCuanto, listarBorradores, type BorradorGuardado } from '@/lib/flashcards/ia/borrador'
import { DEFAULT_COLOR_KEY, MAX_FLASHCARD_CHARS, SUBJECT_COLORS, resolveColor, resolveIcon } from '@/lib/flashcardTheme'
import CharCounter from '@/components/studio/CharCounter'
import {
  CardStackArt,
  GhostButton,
  Hero,
  StatChip,
  StickerButton,
  tintedPaper,
} from '@/components/flashcards/ui'
import SubjectList, { SORT_LABEL, type SubjectSort } from '@/components/flashcards/SubjectList'
import ProgressPanel from '@/components/flashcards/ProgressPanel'
import SubjectIndex from '@/components/flashcards/SubjectIndex'
import TopicList, { groupTopics, type TopicRow } from '@/components/flashcards/TopicList'
import SubjectSummary from '@/components/flashcards/SubjectSummary'
import { CATEGORY_ORDER, type SubjectCategory } from '@/lib/subjectVisuals'
import {
  bulkDeleteFlashcards,
  copyFlashcards,
  createFlashcardDeck,
  deleteFlashcard,
  deleteFlashcardDeck,
  fetchFlashcardDecks,
  fetchFlashcardForecast,
  fetchFlashcardStats,
  fetchFlashcards,
  moveFlashcards,
  updateFlashcard,
  type Flashcard,
  type FlashcardDeck,
  type FlashcardForecast,
  type FlashcardStats,
} from '@/lib/studioFlashcards'

const NO_TOPIC = '__none__'

// Preferencias de la lista de asignaturas. Si se pliega una categoría, se espera
// encontrarla plegada al volver.
const PREFS_KEY = 'mirdaily.flashcards.listPrefs'

// `useSearchParams` obliga a un límite de Suspense en una página que Next
// prerrenderiza. El envoltorio es solo para eso.
export default function FlashcardsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF7F4] text-[#7D8A96]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
        </div>
      }
    >
      <FlashcardsMindMap />
    </Suspense>
  )
}

function FlashcardsMindMap() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setBackAction } = useHeaderUI()
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'loading' | 'no-session' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)

  const [subjects, setSubjects] = useState<FlashcardDeck[]>([])
  const [forecast, setForecast] = useState<FlashcardForecast | null>(null)
  const [stats, setStats] = useState<FlashcardStats | null>(null)
  const [cardsBySubject, setCardsBySubject] = useState<Record<string, Flashcard[]>>({})
  const [loadingSubject, setLoadingSubject] = useState(false)

  // Ruta de navegación: [] raíz, [subjectId] asignatura, [subjectId, topicKey]
  // tema. Vive en la URL, no en el estado: así el botón de atrás del navegador
  // y el "volver" de la cabecera global funcionan, y una asignatura concreta se
  // puede enlazar y recargar.
  const subjectParam = searchParams.get('asignatura')
  const topicParam = searchParams.get('tema')
  const path = useMemo(() => {
    if (!subjectParam) return []
    return topicParam !== null ? [subjectParam, topicParam] : [subjectParam]
  }, [subjectParam, topicParam])

  const navegar = useCallback(
    (next: string[]) => {
      const qs = new URLSearchParams()
      if (next[0]) qs.set('asignatura', next[0])
      if (next.length > 1) qs.set('tema', next[1])
      const query = qs.toString()
      router.push(query ? `/flashcards?${query}` : '/flashcards', { scroll: false })
    },
    [router],
  )

  const [subjectModal, setSubjectModal] = useState<null | { existing?: FlashcardDeck }>(null)
  // Flashcards con IA: solo se ofrece si el backend dice que está disponible para esta cuenta.
  const [ia, setIa] = useState<EstadoFlashcardsIA | null>(null)
  const [iaAbierto, setIaAbierto] = useState(false)
  // Borradores de flashcards con IA sin revisar (en este navegador): se avisa y se retoman.
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [borradores, setBorradores] = useState<BorradorGuardado[]>([])
  const [borradorAbierto, setBorradorAbierto] = useState<BorradorGuardado | null>(null)
  const cargarBorradores = useCallback((uid: string | null) => {
    if (uid) void listarBorradores(uid).then(setBorradores)
  }, [])
  const [createCtx, setCreateCtx] = useState<null | { deckId: string; topic?: string }>(null)
  const [detailCard, setDetailCard] = useState<Flashcard | null>(null)

  // Selección múltiple (tipo galería)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [destCtx, setDestCtx] = useState<null | { mode: 'move' | 'copy' }>(null)
  const [notice, setNotice] = useState<null | { title: string; message: string }>(null)

  // Lista de asignaturas: búsqueda, orden y secciones plegadas.
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SubjectSort>('due')
  const [collapsed, setCollapsed] = useState<Set<SubjectCategory>>(new Set())
  // Vista de los temas dentro de una asignatura. La lista manda; el mapa mental
  // se conserva como alternativa porque con pocos temas se lee bien.
  const [topicView, setTopicView] = useState<'list' | 'map'>('list')
  // Asignatura desplegada en el índice lateral. Solo una a la vez: con veinte
  // asignaturas, varias abiertas convierten el índice en otra pared de texto.
  const [expandedIndexId, setExpandedIndexId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 900, h: 560 })

  // --- Carga inicial --------------------------------------------------------
  const loadSubjects = useCallback(async (authToken: string) => {
    try {
      setSubjects(await fetchFlashcardDecks(authToken))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las asignaturas.')
    }
  }, [])

  // El panel es informativo: si falla, la página sigue siendo usable y no se
  // le enseña un error al usuario por un gráfico.
  const loadPanel = useCallback(async (authToken: string) => {
    const [f, s] = await Promise.allSettled([
      fetchFlashcardForecast(authToken, 30),
      fetchFlashcardStats(authToken),
    ])
    if (f.status === 'fulfilled') setForecast(f.value)
    if (s.status === 'fulfilled') setStats(s.value)
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      const accessToken = session?.access_token ?? ''
      if (!accessToken) {
        setStatus('no-session')
        return
      }
      setToken(accessToken)
      await loadSubjects(accessToken)
      if (mounted) setStatus('ready')
      void loadPanel(accessToken)
      void flashcardsIAEstado().then((e) => mounted && setIa(e))
      const uid = session?.user.id ?? null
      setUsuarioId(uid)
      cargarBorradores(uid)
    })()
    return () => {
      mounted = false
    }
  }, [loadSubjects, loadPanel, cargarBorradores])

  // Preferencias de la lista. Se leen una vez y solo entonces se empiezan a
  // guardar, para no sobrescribirlas con los valores por defecto del montaje.
  const prefsLoaded = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { sort?: string; collapsed?: string[]; topicView?: string }
        if (saved.sort && saved.sort in SORT_LABEL) setSort(saved.sort as SubjectSort)
        if (saved.topicView === 'map' || saved.topicView === 'list') setTopicView(saved.topicView)
        if (Array.isArray(saved.collapsed)) {
          setCollapsed(
            new Set(
              saved.collapsed.filter((c): c is SubjectCategory =>
                (CATEGORY_ORDER as string[]).includes(c),
              ),
            ),
          )
        }
      }
    } catch {
      // Un localStorage bloqueado o unas preferencias viejas no deben tumbar la
      // página: se sigue con los valores por defecto.
    }
    prefsLoaded.current = true
  }, [])

  useEffect(() => {
    if (!prefsLoaded.current) return
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ sort, collapsed: [...collapsed], topicView }),
      )
    } catch {
      // Sin almacenamiento, las preferencias duran lo que la pestaña.
    }
  }, [sort, collapsed, topicView])

  const toggleCategory = useCallback((category: SubjectCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }, [])

  // Medir el lienzo
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
    // El lienzo se monta y desmonta al cambiar de nivel y al conmutar Lista /
    // Mapa. Si no se vuelve a medir, el ResizeObserver se queda observando el
    // elemento viejo y los nodos se colocan con un tamaño que ya no existe.
    // (`path.length` es el nivel, que aún no está declarado a esta altura.)
  }, [status, path.length, topicView])

  const loadCardsFor = useCallback(
    async (subjectId: string) => {
      if (cardsBySubject[subjectId]) return
      setLoadingSubject(true)
      try {
        const { cards } = await fetchFlashcards(token, subjectId)
        setCardsBySubject((prev) => ({ ...prev, [subjectId]: cards }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las tarjetas.')
      } finally {
        setLoadingSubject(false)
      }
    },
    [token, cardsBySubject],
  )

  // --- Estado derivado ------------------------------------------------------
  const currentSubject = path[0] ? subjects.find((s) => s.id === path[0]) ?? null : null
  const currentCards = useMemo(
    () => (path[0] ? cardsBySubject[path[0]] ?? [] : []),
    [path, cardsBySubject],
  )

  const topicRows = useMemo(() => groupTopics(currentCards), [currentCards])

  // Un solo grupo "Sin tema" no es una clasificación: en ese caso se salta
  // directo a la rejilla de tarjetas, como se hacía antes.
  const hasRealTopics = topicRows.some((t) => t.key !== null)
  const level = path.length

  // ¿Mostramos rejilla de tarjetas (hoja) o nodos radiales?
  const atLeaf = level === 2 || (level === 1 && !hasRealTopics)

  const leafCards = useMemo(() => {
    if (!atLeaf) return []
    if (level === 2) {
      const key = path[1]
      return currentCards.filter((c) =>
        key === NO_TOPIC ? !c.topic?.trim() : c.topic?.trim() === key,
      )
    }
    return currentCards
  }, [atLeaf, level, path, currentCards])

  // --- Navegación -----------------------------------------------------------
  const enterSubject = (s: FlashcardDeck) => navegar([s.id])
  const enterTopic = (key: string) => navegar([path[0], key])
  const goUp = () => navegar(path.slice(0, -1))
  const goRoot = () => navegar([])

  // Las tarjetas se cargan al llegar a una asignatura, venga de donde venga:
  // de un clic, del botón de atrás o de un enlace pegado.
  useEffect(() => {
    if (!token || !subjectParam) return
    void loadCardsFor(subjectParam)
  }, [token, subjectParam, loadCardsFor])

  // El índice sigue a la navegación: al entrar en una asignatura se despliega
  // sola, que es lo que se espera encontrar abierto.
  useEffect(() => {
    if (subjectParam) setExpandedIndexId(subjectParam)
  }, [subjectParam])

  const toggleIndexExpand = useCallback(
    (deckId: string) => {
      setExpandedIndexId((prev) => (prev === deckId ? null : deckId))
      // Los temas salen de las tarjetas, que puede que aún no estén cargadas si
      // esa asignatura no se ha visitado en esta sesión.
      void loadCardsFor(deckId)
    },
    [loadCardsFor],
  )

  // Barra de "volver" de la cabecera global, el mismo mecanismo que los mazos.
  // Sustituye a las migas que llevaba la portada: tenerlas en los dos sitios
  // era decir lo mismo dos veces.
  useEffect(() => {
    // La ruta se lee entera desde arriba, sin saltarse escalones: Estudio es de
    // donde se entra, y desde cualquier nivel se puede subir a cualquier padre.
    if (level === 0) {
      setBackAction({ label: 'Estudio', href: '/studio', current: 'Mis flashcards' })
    } else if (level === 1) {
      setBackAction({
        label: 'Estudio',
        href: '/studio',
        trail: [{ label: 'Mis flashcards', href: '/flashcards' }],
        current: currentSubject?.name,
      })
    } else {
      setBackAction({
        label: 'Estudio',
        href: '/studio',
        trail: [
          { label: 'Mis flashcards', href: '/flashcards' },
          ...(currentSubject
            ? [
                {
                  label: currentSubject.name,
                  href: `/flashcards?asignatura=${encodeURIComponent(currentSubject.id)}`,
                },
              ]
            : []),
        ],
        current: humanizeTopic(path[1]),
      })
    }
    return () => setBackAction(null)
  }, [level, currentSubject, path, setBackAction])

  // --- Acciones sobre tarjetas ----------------------------------------------
  const applyCardCreated = (subjectId: string, card: Flashcard) => {
    setCardsBySubject((prev) => ({ ...prev, [subjectId]: [card, ...(prev[subjectId] ?? [])] }))
    // Una tarjeta recién creada nace nueva y pendiente. Sin mover el cubo, la
    // fila de la lista seguiría enseñando el recuento viejo hasta recargar.
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              totalCards: s.totalCards + 1,
              dueCards: s.dueCards + 1,
              summary: { ...s.summary, new: s.summary.new + 1 },
            }
          : s,
      ),
    )
  }

  const handleDeleteCard = async (card: Flashcard) => {
    if (!currentSubject) return
    if (!window.confirm('¿Eliminar esta tarjeta? (recuperable 24h)')) return
    const subjectId = currentSubject.id
    setCardsBySubject((prev) => ({
      ...prev,
      [subjectId]: (prev[subjectId] ?? []).filter((c) => c.itemId !== card.itemId),
    }))
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, totalCards: Math.max(0, s.totalCards - 1) } : s)),
    )
    setDetailCard(null)
    try {
      await deleteFlashcard(token, subjectId, card.itemId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la tarjeta.')
    }
    // Los cubos de la fila dependen del estado SRS de la tarjeta que se fue, así
    // que se recuentan en el servidor en vez de adivinar aquí cuál bajaba.
    await loadSubjects(token)
  }

  const handleDeleteSubject = async (s: FlashcardDeck) => {
    if (!window.confirm(`¿Enviar la asignatura "${s.name}" a la papelera? (recuperable 24h)`)) return
    setSubjects((prev) => prev.filter((x) => x.id !== s.id))
    if (path[0] === s.id) goRoot()
    try {
      await deleteFlashcardDeck(token, s.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la asignatura.')
      await loadSubjects(token)
    }
  }

  // --- Selección múltiple ---------------------------------------------------
  // Limpiar la selección al cambiar de nivel/rama.
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setDestCtx(null)
  }, [path])

  const toggleSelect = (itemId: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })

  const selectAll = () => setSelectedIds(new Set(leafCards.map((c) => c.itemId)))
  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const removeFromCurrent = (ids: Set<number>) => {
    if (!currentSubject) return
    const sid = currentSubject.id
    setCardsBySubject((prev) => ({
      ...prev,
      [sid]: (prev[sid] ?? []).filter((c) => !ids.has(c.itemId)),
    }))
    setSubjects((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, totalCards: Math.max(0, s.totalCards - ids.size) } : s)),
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`¿Eliminar ${selectedIds.size} tarjeta(s)? (recuperable 24h)`)) return
    const ids = new Set(selectedIds)
    removeFromCurrent(ids)
    clearSelection()
    try {
      await bulkDeleteFlashcards(token, Array.from(ids))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron eliminar las tarjetas.')
      if (currentSubject) {
        setCardsBySubject((prev) => {
          const copy = { ...prev }
          delete copy[currentSubject.id]
          return copy
        })
        void loadCardsFor(currentSubject.id)
      }
    }
    await loadSubjects(token)
  }

  const performDestination = async (target: FlashcardDeck, mode: 'move' | 'copy') => {
    if (selectedIds.size === 0 || !currentSubject) return
    const ids = new Set(selectedIds)
    setDestCtx(null)
    try {
      const { done, alreadyThere } =
        mode === 'move'
          ? await moveFlashcards(token, Array.from(ids), target.id)
          : await copyFlashcards(token, Array.from(ids), target.id)

      // Mover saca las tarjetas del grupo actual; copiar las deja donde están.
      if (mode === 'move' && done > 0) removeFromCurrent(ids)

      if (done > 0) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === target.id ? { ...s, totalCards: s.totalCards + done } : s)),
        )
        setCardsBySubject((prev) => {
          const copy = { ...prev }
          delete copy[target.id]
          return copy
        })
      }
      clearSelection()

      // Aviso si alguna ya estaba en el destino
      if (alreadyThere > 0) {
        const verb = mode === 'move' ? 'estaban' : 'existían'
        setNotice({
          title:
            done === 0
              ? 'Nada que ' + (mode === 'move' ? 'mover' : 'copiar')
              : mode === 'move'
                ? 'Movidas parcialmente'
                : 'Copiadas parcialmente',
          message:
            (done > 0
              ? `${done} ${mode === 'move' ? 'movida' : 'copiada'}${done === 1 ? '' : 's'}. `
              : '') +
            `${alreadyThere} ${alreadyThere === 1 ? 'ya' : 'ya'} ${verb} en «${target.name}»${
              mode === 'copy' ? ' y no se duplicaron' : ''
            }.`,
        })
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudieron ${mode === 'move' ? 'mover' : 'copiar'} las tarjetas.`,
      )
    }
    await loadSubjects(token)
  }

  // --- Layout radial (solo temas) -------------------------------------------
  const center = { x: size.w / 2, y: size.h / 2 }
  const radialCount = topicRows.length
  const radius = Math.max(140, Math.min(Math.min(size.w, size.h) / 2 - 96, 300))

  // Pasados doce nodos el arco por nodo se queda tan corto que se solapan, así
  // que a partir de ahí se reparten en dos anillos. El interior NO lleva la
  // mitad: lleva su parte proporcional a la circunferencia, o sus nodos se
  // apiñan mientras el de fuera va holgado.
  const RING_RATIO = 0.62
  const twoRings = radialCount > 12
  const innerCount = twoRings
    ? Math.max(1, Math.round((radialCount * RING_RATIO) / (1 + RING_RATIO)))
    : 0

  const positionFor = (i: number, n: number) => {
    if (n <= 0) return center
    if (!twoRings) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
      return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
    }

    const isInner = i < innerCount
    const countInRing = isInner ? innerCount : n - innerCount
    const indexInRing = isInner ? i : i - innerCount
    const ringRadius = isInner ? radius * RING_RATIO : radius
    // El anillo de fuera va girado medio hueco: así cada nodo cae entre dos del
    // de dentro y no quedan alineados en radios.
    const offset = isInner ? 0 : Math.PI / countInRing
    const angle = -Math.PI / 2 + offset + (2 * Math.PI * indexInRing) / countInRing
    return {
      x: center.x + ringRadius * Math.cos(angle),
      y: center.y + ringRadius * Math.sin(angle),
    }
  }

  // Lo que choca no es el círculo: es la caja del nodo, que lleva la etiqueta
  // debajo. El hueco disponible lo marcan la cuerda entre dos vecinos del mismo
  // anillo (a lo ancho) y la separación entre anillos (a lo alto).
  const chordFor = (ringRadius: number, count: number) =>
    2 * ringRadius * Math.sin(Math.PI / Math.max(count, 2))

  const LABEL_HEIGHT = 38
  const slot = twoRings
    ? Math.min(
        chordFor(radius * RING_RATIO, innerCount),
        chordFor(radius, radialCount - innerCount),
      )
    : Number.POSITIVE_INFINITY
  const ringGap = radius * (1 - RING_RATIO)

  const nodeBox = twoRings ? Math.max(72, Math.min(slot - 8, 128)) : 128
  const nodeMax = twoRings
    ? Math.max(44, Math.min(nodeBox, ringGap - LABEL_HEIGHT))
    : 124
  const nodeMin = Math.min(twoRings ? 44 : 64, nodeMax)

  // --- Render de nodos ------------------------------------------------------
  const centerColor = currentSubject ? resolveColor(currentSubject.color) : null

  // El mapa solo se pinta dentro de una asignatura con temas, así que el centro
  // es siempre la asignatura y siempre sirve para subir un nivel.
  const renderCenter = () => (
    <button
      type="button"
      onClick={goUp}
      style={{
        left: center.x,
        top: center.y,
        background: centerColor?.bg ?? '#2c3e50',
        boxShadow: '5px 5px 0 0 #2c3e50',
      }}
      className="absolute z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full border-[3px] border-[#2c3e50] text-white transition-transform hover:scale-105"
    >
      <span className="flex items-center justify-center">
        <span className="material-symbols-outlined" style={{ fontSize: 30 }}>
          {resolveIcon(currentSubject?.icon)}
        </span>
      </span>
      <span className="max-w-[7rem] truncate px-2 text-center text-xs font-black">
        {currentSubject?.name ?? ''}
      </span>
      <span className="text-[10px] font-bold opacity-75">volver ↑</span>
    </button>
  )

  const renderConnectors = (n: number) => (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
      {Array.from({ length: n }).map((_, i) => {
        const p = positionFor(i, n)
        return (
          <line
            key={i}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            stroke="#CFC5BF"
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )

  const totalCards = subjects.reduce((n, s) => n + s.totalCards, 0)
  const totalDue = subjects.reduce((n, s) => n + s.dueCards, 0)
  const heroAccent = currentSubject ? resolveColor(currentSubject.color).bg : '#E8A598'

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Ambiente: renglones muy tenues y halos de marca, como en la Academia */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)',
        }}
      />
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/12 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-12%] left-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#8BA888]/12 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
        <Hero
          badge={level === 0 ? 'Repaso espaciado' : level === 1 ? 'Asignatura' : 'Tema'}
          badgeIcon={level === 0 ? 'style' : level === 1 ? resolveIcon(currentSubject?.icon) : 'sell'}
          accent={heroAccent}
          title={level === 0 ? 'Mis flashcards' : level === 1 ? currentSubject?.name ?? '' : humanizeTopic(path[1])}
          subtitle={
            level === 0
              ? 'Tus propias tarjetas, organizadas por asignatura y tema. Cada repaso las reprograma para que vuelvan justo cuando toca.'
              : undefined
          }
          aside={level === 0 ? <CardStackArt accent={heroAccent} /> : undefined}
          actions={
            <>
              {level === 0 ? (
                <>
                  <StickerButton icon="add" onClick={() => setSubjectModal({})}>
                    Nueva asignatura
                  </StickerButton>
                  {ia ? (
                    <GhostButton icon="auto_awesome" onClick={() => setIaAbierto(true)}>
                      Crear con IA
                    </GhostButton>
                  ) : null}
                </>
              ) : currentSubject ? (
                <>
                  <StickerButton
                    icon="bolt"
                    color={resolveColor(currentSubject.color).bg}
                    onClick={() =>
                      setCreateCtx({
                        deckId: currentSubject.id,
                        topic: level === 2 && path[1] !== NO_TOPIC ? path[1] : undefined,
                      })
                    }
                  >
                    Crear tarjetas
                  </StickerButton>
                  <GhostButton
                    icon="play_arrow"
                    // Desde un tema, los ajustes de la sesión llegan con ese tema elegido ('' = sin tema).
                    onClick={() =>
                      router.push(
                        `/flashcards/${currentSubject.id}?study=1${level === 2 ? `&tema=${encodeURIComponent(path[1] === NO_TOPIC ? '' : path[1])}` : ''}`,
                      )
                    }
                  >
                    Estudiar
                  </GhostButton>
                </>
              ) : null}
            </>
          }
        >
          {level === 0 && subjects.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <StatChip value={subjects.length} label={subjects.length === 1 ? 'asignatura' : 'asignaturas'} />
              <StatChip value={totalCards} label="tarjetas" color="#7BA7C4" />
              <StatChip value={totalDue} label="para hoy" color="#8BA888" />
            </div>
          ) : null}
        </Hero>

        {error ? (
          <p className="rounded-2xl border-2 border-[#E8A598]/40 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
            {error}
          </p>
        ) : null}

        {level === 0 && borradores.length > 0 ? (
          <section aria-label="Flashcards con IA sin revisar" className="space-y-2">
            {borradores.map((b) => {
              const n = b.lista.filter((t) => t.incluir).length
              return (
                <div
                  key={b.clave}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-[#FBF3E1] px-4 py-3"
                  style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
                >
                  <span aria-hidden className="inline-block text-[#B07A1E]">
                    <span className="material-symbols-outlined text-[1.4rem] leading-none">auto_awesome</span>
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-semibold text-[#2C3E50]">
                    Tienes <b>{n} {n === 1 ? 'tarjeta' : 'tarjetas'} sin revisar</b> de «{b.titulo}»
                    {b.origen.tipo === 'mapa' ? ' (de un mapa)' : ''} <span className="text-[#7D8A96]">({haceCuanto(b.actualizado)})</span>
                  </p>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setBorradorAbierto(b)}
                      className="rounded-xl border-2 border-[#2c3e50] bg-[#E8A598] px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      Revisar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`¿Descartar las ${n} tarjetas sin revisar de «${b.titulo}»? No se pueden recuperar.`)) return
                        void borrarBorrador(b.clave).then(() => cargarBorradores(usuarioId))
                      }}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold text-[#7D8A96] hover:text-[#B04A5E]"
                    >
                      Descartar
                    </button>
                  </span>
                </div>
              )
            })}
          </section>
        ) : null}

        {status === 'loading' ? (
          <div className="flex h-[60vh] items-center justify-center gap-3 text-[#7D8A96]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
            Cargando…
          </div>
        ) : status === 'no-session' ? (
          <p className="rounded-2xl border-2 border-[#E8A598]/40 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
            No hay sesión activa. Inicia sesión para ver tus flashcards.
          </p>
        ) : level === 0 ? (
          <>
            {subjects.length > 0 ? (
              <ProgressPanel forecast={forecast} stats={stats} accent={heroAccent} />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex min-w-[14rem] flex-1 items-center">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 text-lg text-[#B0B8BF]">
                  search
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar asignatura…"
                  className="w-full rounded-2xl border-2 border-[#E4DCD8] bg-white py-2.5 pl-10 pr-3 text-sm font-semibold text-[#2C3E50] outline-none transition-colors placeholder:font-medium placeholder:text-[#B0B8BF] focus:border-[#2c3e50]"
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#7D8A96]/70">
                Orden
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SubjectSort)}
                  className="rounded-2xl border-2 border-[#E4DCD8] bg-white px-3 py-2.5 text-sm font-bold tracking-normal text-[#2C3E50] outline-none transition-colors focus:border-[#2c3e50]"
                >
                  {(Object.keys(SORT_LABEL) as SubjectSort[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABEL[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {subjects.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#E0D8D4] bg-white/60 px-6 py-14 text-center">
                <p className="max-w-sm text-sm font-semibold text-[#7D8A96]">
                  Cada asignatura es un mazo de tarjetas tuyas. Crea la primera y empieza a
                  alimentarla.
                </p>
                <StickerButton icon="add" onClick={() => setSubjectModal({})}>
                  Crea tu primera asignatura
                </StickerButton>
              </div>
            ) : (
              <SubjectList
                decks={subjects}
                query={query}
                sort={sort}
                collapsed={collapsed}
                onToggleCategory={toggleCategory}
                onOpen={enterSubject}
                onStudy={(deck) => router.push(`/flashcards/${deck.id}?study=1`)}
                onEdit={(deck) => setSubjectModal({ existing: deck })}
                onDelete={(deck) => void handleDeleteSubject(deck)}
              />
            )}
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
            {/* Índice lateral: solo dentro de una asignatura. En la raíz sería
                repetir la lista principal. Se oculta en pantallas estrechas,
                donde no cabe sin comerse el contenido. */}
            <aside className="hidden lg:block">
              <SubjectIndex
                decks={subjects}
                cardsBySubject={cardsBySubject}
                activeSubjectId={path[0] ?? null}
                activeTopicKey={path[1] ?? null}
                expandedId={expandedIndexId}
                onToggleExpand={toggleIndexExpand}
                onOpenSubject={enterSubject}
                onOpenTopic={(deck, topicKey) => navegar([deck.id, topicKey ?? NO_TOPIC])}
              />
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
            {level === 1 && currentSubject ? (
              <SubjectSummary summary={currentSubject.summary} total={currentSubject.totalCards} />
            ) : null}

            {level === 1 && hasRealTopics ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7D8A96]/70">
                  {topicRows.length} {topicRows.length === 1 ? 'tema' : 'temas'}
                </span>
                <div className="flex items-center gap-1 rounded-2xl border-2 border-[#E4DCD8] bg-white p-1">
                  {(['list', 'map'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTopicView(mode)}
                      aria-pressed={topicView === mode}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
                        topicView === mode
                          ? 'bg-[#2c3e50] text-white'
                          : 'text-[#7D8A96] hover:text-[#2C3E50]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {mode === 'list' ? 'format_list_bulleted' : 'hub'}
                      </span>
                      {mode === 'list' ? 'Lista' : 'Mapa'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!atLeaf && topicView === 'list' ? (
              <TopicList
                topics={topicRows}
                color={resolveColor(currentSubject?.color)}
                onOpen={(row: TopicRow) => enterTopic(row.key ?? NO_TOPIC)}
              />
            ) : (
          <div
            ref={canvasRef}
            // Con dos anillos el lienzo crece: el radio sale de la dimensión
            // menor, y con 520 px de alto no queda separación suficiente entre
            // los anillos para que quepan las etiquetas.
            className={`relative w-full overflow-hidden rounded-3xl border-2 border-[#2c3e50] ${
              twoRings ? 'h-[80vh] min-h-[720px]' : 'h-[64vh] min-h-[520px]'
            }`}
            style={{
              background: 'radial-gradient(circle at 50% 42%, #ffffff 0%, #F8F3EF 100%)',
              boxShadow: '6px 6px 0 0 #2c3e50',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={path.join('/') + '::' + (atLeaf ? 'leaf' : 'map')}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                {atLeaf ? (
                  <LeafGrid
                    cards={leafCards}
                    loading={loadingSubject}
                    color={resolveColor(currentSubject?.color)}
                    onBack={goUp}
                    backLabel={level === 2 ? humanizeTopic(path[1]) : currentSubject?.name ?? ''}
                    onSelect={setDetailCard}
                    onCreate={() =>
                      currentSubject &&
                      setCreateCtx({
                        deckId: currentSubject.id,
                        topic: level === 2 && path[1] !== NO_TOPIC ? path[1] : undefined,
                      })
                    }
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onEnterSelect={() => setSelectMode(true)}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onClearSelect={clearSelection}
                  />
                ) : (
                  <>
                    {renderConnectors(radialCount)}
                    {renderCenter()}
                    {/* Nodos de tema. El mapa solo se usa para temas: las
                        asignaturas van en lista, que escala sin solaparse. */}
                    {topicRows.map((t, i, arr) => {
                      const p = positionFor(i, arr.length)
                      const c = resolveColor(currentSubject?.color)
                      const maxCount = Math.max(1, ...arr.map((x) => x.total))
                      // Diámetro escalado por cantidad, dentro de lo que la
                      // geometría del anillo permite sin que se toquen.
                      const size = Math.round(
                        nodeMin + (t.total / maxCount) * Math.max(0, nodeMax - nodeMin),
                      )
                      return (
                        <motion.div
                          key={t.key ?? NO_TOPIC}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.03 * i, type: 'spring', stiffness: 260, damping: 20 }}
                          style={{ left: p.x, top: p.y }}
                          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                        >
                          <TopicNode
                            label={t.label}
                            count={t.total}
                            size={size}
                            boxWidth={nodeBox}
                            color={c}
                            onOpen={() => enterTopic(t.key ?? NO_TOPIC)}
                          />
                        </motion.div>
                      )
                    })}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
            )}
            </div>
          </div>
        )}
      </main>

      {/* Modales */}
      {(iaAbierto && ia) || borradorAbierto ? (
        <CrearFlashcardsIA
          estado={ia}
          {...(borradorAbierto ? { borrador: borradorAbierto } : {})}
          onClose={() => {
            setIaAbierto(false)
            setBorradorAbierto(null)
            cargarBorradores(usuarioId)
            // Lo guardado (grupos nuevos o tarjetas en uno que ya había) aparece en la lista.
            if (token) {
              void loadSubjects(token)
              void loadPanel(token)
            }
            void flashcardsIAEstado().then(setIa)
          }}
        />
      ) : null}
      <AnimatePresence>
        {subjectModal ? (
          <SubjectModal
            token={token}
            existing={subjectModal.existing}
            onClose={() => setSubjectModal(null)}
            onSaved={(deck) => {
              setSubjects((prev) => {
                const exists = prev.some((s) => s.id === deck.id)
                return exists
                  ? prev.map((s) => (s.id === deck.id ? { ...s, ...deck } : s))
                  : [
                      ...prev,
                      {
                        ...deck,
                        totalCards: 0,
                        dueCards: 0,
                        dueReviewCards: 0,
                        summary: { new: 0, failed: 0, learning: 0, mastered: 0 },
                      },
                    ]
              })
              setSubjectModal(null)
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createCtx ? (
          <FlashcardCreateModal
            token={token}
            deckId={createCtx.deckId}
            subjectName={subjects.find((s) => s.id === createCtx.deckId)?.name}
            colorKey={subjects.find((s) => s.id === createCtx.deckId)?.color}
            initialTopic={createCtx.topic ?? ''}
            initialCount={subjects.find((s) => s.id === createCtx.deckId)?.totalCards ?? 0}
            onCreated={(card) => applyCardCreated(createCtx.deckId, card)}
            onClose={() => setCreateCtx(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {detailCard ? (
          <CardDetail
            card={detailCard}
            token={token}
            color={resolveColor(currentSubject?.color)}
            onClose={() => setDetailCard(null)}
            onDelete={() => void handleDeleteCard(detailCard)}
            onSaved={(patch) => {
              if (!currentSubject) return
              setCardsBySubject((prev) => ({
                ...prev,
                [currentSubject.id]: (prev[currentSubject.id] ?? []).map((c) =>
                  c.itemId === detailCard.itemId ? { ...c, ...patch } : c,
                ),
              }))
              setDetailCard((d) => (d ? { ...d, ...patch } : d))
            }}
          />
        ) : null}
      </AnimatePresence>

      {/* Barra de acciones de la selección (tipo galería) */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 ? (
          <motion.div
            initial={{ y: 70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 70, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-5 z-[250] flex justify-center px-4"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-[#EAE4E2] bg-white/95 px-3 py-2 shadow-2xl shadow-black/10 backdrop-blur">
              <span className="px-2 text-sm font-bold text-[#2C3E50]">
                {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setDestCtx({ mode: 'copy' })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#7BA7C4] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setDestCtx({ mode: 'move' })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#8BA888] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">drive_file_move</span>
                Mover
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C4655A] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                Eliminar
              </button>
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Cancelar selección"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#7D8A96] transition hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {destCtx ? (
          <MoveCardsModal
            mode={destCtx.mode}
            token={token}
            subjects={subjects.filter((s) => s.id !== currentSubject?.id)}
            count={selectedIds.size}
            onSubjectCreated={(deck) =>
              setSubjects((prev) => [...prev, { ...deck, totalCards: 0, dueCards: 0 }])
            }
            onPick={(deck) => void performDestination(deck, destCtx.mode)}
            onClose={() => setDestCtx(null)}
          />
        ) : null}
      </AnimatePresence>

      {/* Aviso (p. ej. tarjetas que ya estaban en el destino) */}
      <AnimatePresence>
        {notice ? (
          <motion.div
            className="fixed inset-0 z-[330] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-[#2c3e50]/45 backdrop-blur-sm" onClick={() => setNotice(null)} />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <span className="material-symbols-outlined text-4xl text-[#E0B15A]">info</span>
              <h3 className="mt-2 text-lg font-bold text-[#2C3E50]">{notice.title}</h3>
              <p className="mt-1 text-sm text-[#7D8A96]">{notice.message}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="mt-5 rounded-xl bg-[#2c3e50] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style jsx>{`
        .fc-pulse {
          animation: fcPulse 2.2s ease-in-out infinite;
        }
        @keyframes fcPulse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}

function humanizeTopic(key: string): string {
  return key === NO_TOPIC ? 'Sin tema' : key
}

// --- Sub-componentes --------------------------------------------------------

function TopicNode({
  label,
  count,
  size,
  boxWidth,
  color,
  onOpen,
}: {
  label: string
  count: number
  size: number
  boxWidth: number
  color: ReturnType<typeof resolveColor>
  onOpen: () => void
}) {
  // Burbuja cuyo diámetro refleja la cantidad de tarjetas del tema. `boxWidth`
  // es el hueco real del que dispone el nodo: la etiqueta ocupa más que el
  // círculo, así que es la caja la que decide si dos nodos se tocan.
  return (
    <div className="flex flex-col items-center" style={{ width: boxWidth }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}: ${count} tarjetas`}
        className="flex flex-col items-center justify-center rounded-full border-[3px] border-[#2c3e50] text-center transition-transform hover:-translate-y-1"
        style={{
          width: size,
          height: size,
          background: color.soft,
          color: color.text,
          boxShadow: '4px 4px 0 0 #2c3e50',
        }}
      >
        <span className="flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontSize: Math.max(16, size * 0.24) }}>
            sell
          </span>
        </span>
        <span className="font-black leading-none" style={{ fontSize: Math.max(15, size * 0.26) }}>
          {count}
        </span>
      </button>
      <span className="mt-2 line-clamp-2 w-full text-center text-xs font-black text-[#2C3E50]">
        {label}
      </span>
    </div>
  )
}

function LeafGrid({
  cards,
  loading,
  color,
  onBack,
  backLabel,
  onSelect,
  onCreate,
  selectMode,
  selectedIds,
  onEnterSelect,
  onToggleSelect,
  onSelectAll,
  onClearSelect,
}: {
  cards: Flashcard[]
  loading: boolean
  color: ReturnType<typeof resolveColor>
  onBack: () => void
  backLabel: string
  onSelect: (c: Flashcard) => void
  onCreate: () => void
  selectMode: boolean
  selectedIds: Set<number>
  onEnterSelect: () => void
  onToggleSelect: (itemId: number) => void
  onSelectAll: () => void
  onClearSelect: () => void
}) {
  const allSelected = cards.length > 0 && cards.every((c) => selectedIds.has(c.itemId))
  return (
    <div className="absolute inset-0 flex flex-col p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-full border-2 border-[#EAE4E2] bg-white px-3 py-1.5 text-xs font-bold text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {backLabel}
        </button>
        <span className="text-xs font-black uppercase tracking-wider text-[#7D8A96]/60">
          {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {cards.length > 0 && !selectMode ? (
            <button
              type="button"
              onClick={onEnterSelect}
              className="flex items-center gap-1 rounded-full border-2 border-[#EAE4E2] bg-white px-3 py-1.5 text-xs font-bold text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
            >
              <span className="material-symbols-outlined text-base">check_box</span>
              Seleccionar
            </button>
          ) : null}
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={allSelected ? onClearSelect : onSelectAll}
                className="rounded-full border-2 border-[#EAE4E2] bg-white px-3 py-1.5 text-xs font-bold text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
              >
                {allSelected ? 'Ninguna' : 'Todo'}
              </button>
              <button
                type="button"
                onClick={onClearSelect}
                className="rounded-full border-2 border-[#EAE4E2] bg-white px-3 py-1.5 text-xs font-bold text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
              >
                Cancelar
              </button>
            </>
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-[#7D8A96]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
          Cargando tarjetas…
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <CardStackArt accent={color.bg} />
          <p className="font-bold text-[#2C3E50]">No hay tarjetas aquí todavía.</p>
          <StickerButton icon="bolt" color={color.bg} onClick={onCreate}>
            Crear tarjetas
          </StickerButton>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-4 overflow-auto p-1 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c, i) => {
            const checked = selectedIds.has(c.itemId)
            return (
              <motion.button
                key={c.itemId}
                type="button"
                onClick={() => (selectMode ? onToggleSelect(c.itemId) : onSelect(c))}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.25, 0.02 * i), duration: 0.3, ease: 'easeOut' }}
                className="relative flex h-32 flex-col overflow-hidden rounded-2xl border-2 border-[#2c3e50] p-3 text-left transition-transform hover:-translate-y-1"
                style={{
                  ...tintedPaper(color.bg),
                  boxShadow: checked ? `3px 3px 0 0 ${color.bg}` : '3px 3px 0 0 #2c3e50',
                }}
              >
                {/* Margen de la ficha, el detalle que la hace reconocible */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-2.5 w-px"
                  style={{ backgroundColor: `${color.bg}66` }}
                />
                {selectMode ? (
                  <span
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 text-white"
                    style={{
                      background: checked ? color.bg : 'rgba(255,255,255,0.9)',
                      borderColor: checked ? color.bg : '#CBBFB8',
                    }}
                  >
                    {checked ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        check
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {c.topic ? (
                  <span
                    className="mb-1 ml-2 w-fit max-w-[calc(100%-1.5rem)] truncate rounded-full px-2 py-0.5 text-[10px] font-black"
                    style={{ background: color.soft, color: color.text }}
                  >
                    {c.topic}
                  </span>
                ) : null}
                <span className="ml-2 line-clamp-4 flex-1 pr-5 text-sm font-bold leading-snug text-[#2C3E50]">
                  {c.front}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardDetail({
  card,
  token,
  color,
  onClose,
  onDelete,
  onSaved,
}: {
  card: Flashcard
  token: string
  color: ReturnType<typeof resolveColor>
  onClose: () => void
  onDelete: () => void
  onSaved: (patch: { front: string; back: string; topic: string | null }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [topic, setTopic] = useState(card.topic ?? '')
  const [flipped, setFlipped] = useState(false)
  const [saving, setSaving] = useState(false)

  const frontOver = front.length > MAX_FLASHCARD_CHARS
  const backOver = back.length > MAX_FLASHCARD_CHARS

  const save = async () => {
    if (saving || !front.trim() || !back.trim() || frontOver || backOver) return
    setSaving(true)
    try {
      await updateFlashcard(token, card.flashcardId, { front, back, topic: topic.trim() || undefined })
      onSaved({ front: front.trim(), back: back.trim(), topic: topic.trim() || null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[#2c3e50]/45 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
        style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ background: color.soft }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: color.text }}>
            {topic.trim() ? topic : 'Tarjeta'}
          </span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#7D8A96] hover:bg-white/60">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          {editing ? (
            <div className="flex flex-col gap-3">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema (opcional)" className="rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:bg-white" />
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#7D8A96]/70">Anverso</span>
                  <CharCounter length={front.length} />
                </div>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  rows={3}
                  className={`w-full resize-y rounded-xl border bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:bg-white ${frontOver ? 'border-[#E8A598]' : 'border-[#EAE4E2]'}`}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#7D8A96]/70">Reverso</span>
                  <CharCounter length={back.length} />
                </div>
                <textarea
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  rows={3}
                  className={`w-full resize-y rounded-xl border bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:bg-white ${backOver ? 'border-[#E8A598]' : 'border-[#EAE4E2]'}`}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-[#EAE4E2] px-4 py-2 text-sm font-semibold text-[#7D8A96] hover:bg-[#F7F4F2]">Cancelar</button>
                <button type="button" onClick={() => void save()} disabled={saving || !front.trim() || !back.trim() || frontOver || backOver} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: color.bg }}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFlipped((v) => !v)}
                className="min-h-[160px] w-full rounded-2xl border border-[#EFE7E3] bg-[#FBF8F6] p-5 text-left transition hover:bg-white"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/70">
                  {flipped ? 'Reverso' : 'Anverso'} · toca para girar
                </span>
                <p className="mt-2 whitespace-pre-wrap text-base font-semibold text-[#2C3E50]">
                  {flipped ? card.back : card.front}
                </p>
              </button>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-[#F0D9D4] px-3 py-2 text-sm font-semibold text-[#C4655A] transition hover:bg-[#FFF1EE]">
                  <span className="material-symbols-outlined text-lg">delete</span> Eliminar
                </button>
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: color.bg }}>
                  <span className="material-symbols-outlined text-lg">edit</span> Editar
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function MoveCardsModal({
  mode,
  token,
  subjects,
  count,
  onSubjectCreated,
  onPick,
  onClose,
}: {
  mode: 'move' | 'copy'
  token: string
  subjects: FlashcardDeck[]
  count: number
  onSubjectCreated: (deck: FlashcardDeck) => void
  onPick: (deck: FlashcardDeck) => void
  onClose: () => void
}) {
  const verb = mode === 'move' ? 'Mover' : 'Copiar'
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [colorKey, setColorKey] = useState(DEFAULT_COLOR_KEY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAndMove = async () => {
    if (busy || name.trim().length < 3) return
    setBusy(true)
    setError(null)
    try {
      const deck = await createFlashcardDeck(token, { name, color: colorKey, icon: 'style' })
      onSubjectCreated(deck)
      onPick(deck)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo.')
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[320] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[#2c3e50]/45 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-black text-[#2C3E50]">
            {verb} {count} tarjeta{count === 1 ? '' : 's'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#7D8A96] hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto px-5 pb-5">
          {creating ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#EAE4E2] p-4">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void createAndMove()
                  }
                }}
                placeholder="Nombre del nuevo grupo"
                className="rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2.5 text-sm outline-none focus:bg-white"
              />
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setColorKey(c.key)}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{ background: c.bg, boxShadow: colorKey === c.key ? `0 0 0 2px #fff, 0 0 0 4px ${c.ring}` : undefined }}
                  />
                ))}
              </div>
              {error ? <p className="text-sm font-medium text-[#C4655A]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-[#EAE4E2] px-4 py-2 text-sm font-semibold text-[#7D8A96] hover:bg-[#F7F4F2]">
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => void createAndMove()}
                  disabled={busy || name.trim().length < 3}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: resolveColor(colorKey).bg }}
                >
                  {busy ? (mode === 'move' ? 'Moviendo…' : 'Copiando…') : `Crear y ${verb.toLowerCase()}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[#D8CDC7] px-4 py-3 text-sm font-bold text-[#7D8A96] transition hover:border-[#8BA888] hover:bg-[#F6F8F5]"
              >
                <span className="material-symbols-outlined text-[#8BA888]">add</span>
                Crear grupo nuevo
              </button>
              {subjects.length === 0 ? (
                <p className="px-1 py-3 text-center text-sm text-[#7D8A96]/70">No hay otras asignaturas. Crea un grupo nuevo.</p>
              ) : (
                subjects.map((s) => {
                  const c = resolveColor(s.color)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onPick(s)}
                      className="flex items-center gap-3 rounded-xl border border-[#EAE4E2] bg-white px-3 py-2.5 text-left transition hover:bg-[#F7F4F2]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: c.bg }}>
                        <span className="material-symbols-outlined text-lg">{resolveIcon(s.icon)}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2C3E50]">{s.name}</span>
                      <span className="text-xs font-semibold text-[#7D8A96]/70">{s.totalCards}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
