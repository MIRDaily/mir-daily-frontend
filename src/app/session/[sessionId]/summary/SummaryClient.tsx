"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import { fetchStudioDecks } from '@/lib/studioDecks'
import GooFissionLoader from '@/components/studio/GooFissionLoader'
import {
  DeckProgressArt,
  GhostButton,
  Hero,
  SectionLabel,
  STATUS_TONE,
  StickerButton,
  StickerCard,
  trackerBackdropStyle,
} from '@/components/studio/deckUi'

const API_URL = process.env.NEXT_PUBLIC_API_URL

type SessionFinalMetrics = {
  duration_seconds?: number | null
  answered?: number | null
  correct?: number | null
  wrong?: number | null
  end_reason?: string | null
  items_served?: number | null
}

type SessionTopicMetric = {
  topic_id?: number | null
  topic?: string | null
  subject?: string | null
  answered?: number | null
  correct?: number | null
  accuracy?: number | null
}

type SessionSubjectMetric = {
  subject?: string | null
  answered?: number | null
  accuracy?: number | null
}

type TopicPerformance = {
  key: string
  topic: string
  accuracy: number
}

type SubjectPerformance = {
  subject: string
  accuracy: number
}

type SessionPayload = {
  success?: boolean
  status?: string
  session?: {
    status?: string
    final_metrics?: SessionFinalMetrics | null
  } | null
  final_metrics?: SessionFinalMetrics | null
  topics?: SessionTopicMetric[] | null
  subjects?: SessionSubjectMetric[] | null
}

type SummaryClientProps = {
  deckId: string
  sessionId: string
  filterExhausted?: boolean
}

function toSafeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes <= 0) return `${rest}s`
  return `${minutes}m ${rest}s`
}

// Traduce el end_reason en bruto que devuelve el backend a algo legible.
// Cubrimos los valores conocidos ('done', 'manual', 'limitReached') y
// dejamos un genérico decente para cualquier otro que llegue.
const END_REASON_INFO: Record<string, { label: string; icon: string; tone: keyof typeof STATUS_TONE }> = {
  done: { label: 'Completaste todo el mazo', icon: 'verified', tone: 'mastered' },
  limitReached: { label: 'Llegaste al número de preguntas que pediste', icon: 'flag', tone: 'new' },
  manual: { label: 'Saliste antes de terminar la sesión', icon: 'logout', tone: 'learning' },
  expired: { label: 'La sesión expiró por inactividad', icon: 'schedule', tone: 'failed' },
}
const DEFAULT_END_REASON_INFO = { label: 'Sesión finalizada', icon: 'task_alt', tone: 'new' as const }

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-70" style={trackerBackdropStyle()} />
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/12 blur-3xl" />
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-6">{children}</main>
    </div>
  )
}

function SummaryErrorState({ deckId, message }: { deckId: string; message: string }) {
  const router = useRouter()
  return (
    <PageShell>
      <StickerCard as="section" className="p-6" depth={5}>
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C99A8D]">
          Resumen de sesión
        </span>
        <h1 className="mt-1 text-xl font-black text-[#2C3E50]">No se pudo cargar el resumen</h1>
        <p className="mt-2 text-sm font-semibold text-[#7D8A96]">{message}</p>
        <div className="mt-5">
          <GhostButton icon="arrow_back" onClick={() => router.push(deckId ? `/decks/${deckId}` : '/decks')}>
            Volver al mazo
          </GhostButton>
        </div>
      </StickerCard>
    </PageShell>
  )
}

export default function SummaryClient({ deckId, sessionId, filterExhausted }: SummaryClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [finalMetrics, setFinalMetrics] = useState<SessionFinalMetrics | null>(null)
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([])
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([])
  const [deckName, setDeckName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!API_URL) {
        if (!cancelled) {
          setErrorMessage('NEXT_PUBLIC_API_URL no definida.')
          setLoading(false)
        }
        return
      }

      if (!deckId || !sessionId) {
        if (!cancelled) {
          setErrorMessage('No fue posible obtener el resumen de la sesión. Intenta de nuevo desde el mazo.')
          setLoading(false)
        }
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        if (!cancelled) {
          setErrorMessage('No encontramos tu sesión activa. Inicia sesión otra vez e intenta de nuevo.')
          setLoading(false)
        }
        return
      }

      const token = session.access_token

      const [summaryRes, decks] = await Promise.all([
        fetch(`${API_URL}/api/studio/sessions/${sessionId}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchStudioDecks(token).catch(() => []),
      ])

      if (cancelled) return

      const matchedDeck = decks.find((deck) => String(deck.id) === String(deckId))
      if (matchedDeck?.name) setDeckName(matchedDeck.name)

      if (summaryRes.status === 401) {
        setErrorMessage('Tu sesión de autenticación expiró. Vuelve al mazo para iniciar una nueva sesión.')
        setLoading(false)
        return
      }

      if (summaryRes.status === 404) {
        setErrorMessage('La sesión de estudio no existe o ya no está disponible.')
        setLoading(false)
        return
      }

      const data = (await summaryRes.json().catch(() => null)) as SessionPayload | null

      if (!data || data.success !== true) {
        setErrorMessage('No fue posible obtener el resumen de la sesión. Intenta de nuevo desde el mazo.')
        setLoading(false)
        return
      }

      const metrics = data.session?.final_metrics ?? data.final_metrics

      if (!metrics) {
        setErrorMessage('No fue posible obtener el resumen de la sesión. Intenta de nuevo desde el mazo.')
        setLoading(false)
        return
      }

      setFinalMetrics(metrics)

      const normalizedTopics = (Array.isArray(data.topics) ? data.topics : [])
        .map((topic, index) => {
          const label =
            typeof topic?.topic === 'string' && topic.topic.trim().length > 0 ? topic.topic.trim() : 'Sin tema'
          const topicId = Number(topic?.topic_id)
          const key = Number.isFinite(topicId)
            ? `topic-${Math.trunc(topicId)}`
            : `topic-${index}-${label.toLowerCase()}`
          const accuracy = Math.max(0, Math.min(100, Math.round(toSafeNumber(topic?.accuracy))))
          return { key, topic: label, accuracy }
        })
        .sort((a, b) => a.accuracy - b.accuracy || a.topic.localeCompare(b.topic))

      const normalizedSubjects = (Array.isArray(data.subjects) ? data.subjects : [])
        .map((subject) => {
          const label =
            typeof subject?.subject === 'string' && subject.subject.trim().length > 0
              ? subject.subject.trim()
              : 'Sin asignatura'
          const accuracy = Math.max(0, Math.min(100, Math.round(toSafeNumber(subject?.accuracy))))
          return { subject: label, accuracy }
        })
        .sort((a, b) => a.subject.localeCompare(b.subject))

      setTopicPerformance(normalizedTopics)
      setSubjectPerformance(normalizedSubjects)
      setLoading(false)
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [deckId, sessionId])

  if (loading) {
    return (
      <PageShell>
        <StickerCard
          as="section"
          className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-10 text-center"
          depth={5}
        >
          <GooFissionLoader size={100} label="Cargando resumen" showGlow={false} />
          <p className="text-sm font-bold text-[#2C3E50]">Preparando tu resumen…</p>
        </StickerCard>
      </PageShell>
    )
  }

  if (errorMessage || !finalMetrics) {
    return (
      <SummaryErrorState
        deckId={deckId}
        message={errorMessage ?? 'No fue posible obtener el resumen de la sesión. Intenta de nuevo desde el mazo.'}
      />
    )
  }

  const durationSeconds = toSafeNumber(finalMetrics.duration_seconds)
  const answered = toSafeNumber(finalMetrics.answered)
  const correct = toSafeNumber(finalMetrics.correct)
  const wrong = toSafeNumber(finalMetrics.wrong)
  const itemsServed = toSafeNumber(finalMetrics.items_served)
  const accuracyPercent = answered > 0 ? Math.round((correct / answered) * 100) : null
  const endReasonInfo = (finalMetrics.end_reason && END_REASON_INFO[finalMetrics.end_reason]) || DEFAULT_END_REASON_INFO
  const endReasonTone = STATUS_TONE[endReasonInfo.tone]

  const STAT_TILES: Array<{ key: keyof typeof STATUS_TONE; label: string; value: number; icon: string }> = [
    { key: 'mastered', label: 'Correctas', value: correct, icon: 'check_circle' },
    { key: 'failed', label: 'Falladas', value: wrong, icon: 'cancel' },
    { key: 'new', label: 'Respondidas', value: answered, icon: 'quiz' },
    { key: 'learning', label: 'Duración', value: durationSeconds, icon: 'schedule' },
  ]

  return (
    <PageShell>
      <Hero
        badge="Resumen de sesión"
        badgeIcon="military_tech"
        title={deckName ?? 'Sesión de estudio'}
        aside={
          <div className="flex flex-col items-center gap-1">
            <DeckProgressArt percent={accuracyPercent} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">Precisión</span>
          </div>
        }
        actions={
          <StickerButton icon="arrow_back" onClick={() => router.push(deckId ? `/decks/${deckId}` : '/decks')}>
            Volver al mazo
          </StickerButton>
        }
      >
        <div
          className="mt-4 flex w-fit items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-bold"
          style={{ borderColor: endReasonTone.border, backgroundColor: endReasonTone.bg, color: endReasonTone.fg }}
        >
          <span className="material-symbols-outlined text-sm">{endReasonInfo.icon}</span>
          {endReasonInfo.label}
        </div>
      </Hero>

      {filterExhausted ? (
        <div
          className="rounded-2xl border-2 px-4 py-3 text-sm font-semibold"
          style={{
            borderColor: STATUS_TONE.learning.border,
            backgroundColor: STATUS_TONE.learning.bg,
            color: STATUS_TONE.learning.fg,
          }}
        >
          <p className="font-black">Sesión terminada antes de lo pedido</p>
          <p className="mt-1">
            Se agotaron las {itemsServed} preguntas que coinciden con el filtro de asignatura o estado que
            elegiste. No se completó la sesión con preguntas de otras asignaturas o estados.
          </p>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_TILES.map((stat) => {
          const tone = STATUS_TONE[stat.key]
          return (
            <div
              key={stat.key}
              className="rounded-2xl border-2 p-4 text-center"
              style={{ borderColor: tone.border, backgroundColor: tone.bg, boxShadow: `3px 3px 0 0 ${tone.border}` }}
            >
              <span className="material-symbols-outlined text-xl" style={{ color: tone.fg }}>
                {stat.icon}
              </span>
              <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: tone.fg }}>
                {stat.key === 'learning' ? formatDuration(stat.value) : stat.value}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tone.fg }}>
                {stat.label}
              </p>
            </div>
          )
        })}
      </section>

      {subjectPerformance.length > 0 ? (
        <StickerCard as="section" className="p-5" depth={4}>
          <SectionLabel>Acierto por asignatura</SectionLabel>
          <div className="space-y-3">
            {subjectPerformance.map((subject) => (
              <div
                key={subject.subject}
                className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
              >
                <span className="truncate font-semibold text-[#2C3E50]">{subject.subject}</span>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-[#EAE4E2] bg-[#F5F1EF]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${subject.accuracy}%`, backgroundColor: '#E8A598' }}
                  />
                </div>
                <span className="font-black text-[#2C3E50] sm:w-12 sm:text-right">{subject.accuracy}%</span>
              </div>
            ))}
          </div>
        </StickerCard>
      ) : null}

      {topicPerformance.length > 0 ? (
        <StickerCard as="section" className="p-5" depth={4}>
          <SectionLabel>Acierto por tema</SectionLabel>
          <div className="space-y-3">
            {topicPerformance.map((topic) => (
              <div
                key={topic.key}
                className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
              >
                <span className="truncate font-semibold text-[#2C3E50]">{topic.topic}</span>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-[#EAE4E2] bg-[#F5F1EF]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${topic.accuracy}%`, backgroundColor: '#E8A598' }}
                  />
                </div>
                <span className="font-black text-[#2C3E50] sm:w-12 sm:text-right">{topic.accuracy}%</span>
              </div>
            ))}
          </div>
        </StickerCard>
      ) : null}
    </PageShell>
  )
}
