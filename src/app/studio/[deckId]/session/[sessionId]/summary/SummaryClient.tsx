"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseBrowser'

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
}

function toSafeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function BackToDeckButton({ deckId, className }: { deckId: string; className?: string }) {
  return (
    <Link
      href={`/studio/${deckId}`}
      aria-label="Volver al mazo"
      title="Volver al mazo"
      className={`inline-flex h-9 min-w-[52px] items-center justify-center rounded-lg bg-[#E8A598] text-white transition hover:bg-[#D98C7D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A598]/60 ${className ?? ''}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="M19 12H5" />
        <path d="M11 18l-6-6 6-6" />
      </svg>
    </Link>
  )
}

function SummaryErrorState({ deckId, message }: { deckId: string; message: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="relative">
          <BackToDeckButton deckId={deckId} className="absolute -left-32 top-2" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">No se pudo cargar el resumen</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </div>
        </div>
      </div>
    </main>
  )
}

export default function SummaryClient({ deckId, sessionId }: SummaryClientProps) {
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [finalMetrics, setFinalMetrics] = useState<SessionFinalMetrics | null>(null)
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([])
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      const backendUrl = 'https://mir-daily-backend-production.up.railway.app'

      if (!deckId || !sessionId) {
        if (!cancelled) {
          setErrorMessage('No fue posible obtener el resumen de la sesion. Intenta de nuevo desde el mazo.')
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
          setErrorMessage('No encontramos tu sesion activa. Inicia sesion otra vez e intenta nuevamente.')
          setLoading(false)
        }
        return
      }

      const response = await fetch(`${backendUrl}/api/studio/sessions/${sessionId}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.status === 401) {
        if (!cancelled) {
          setErrorMessage('Tu sesion de autenticacion expiro. Vuelve al mazo para iniciar una nueva sesion.')
          setLoading(false)
        }
        return
      }

      if (response.status === 404) {
        if (!cancelled) {
          setErrorMessage('La sesion de estudio no existe o ya no esta disponible.')
          setLoading(false)
        }
        return
      }

      const data = (await response.json().catch(() => null)) as SessionPayload | null

      if (!data || data.success !== true) {
        if (!cancelled) {
          setErrorMessage('No fue posible obtener el resumen de la sesion. Intenta de nuevo desde el mazo.')
          setLoading(false)
        }
        return
      }

      const metrics = data.session?.final_metrics ?? data.final_metrics

      if (!metrics) {
        if (!cancelled) {
          setErrorMessage('No fue posible obtener el resumen de la sesion. Intenta de nuevo desde el mazo.')
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setFinalMetrics(metrics)
        const normalizedTopics = (Array.isArray(data.topics) ? data.topics : [])
          .map((topic, index) => {
            const label =
              typeof topic?.topic === 'string' && topic.topic.trim().length > 0
                ? topic.topic.trim()
                : 'Sin tema'
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
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [deckId, sessionId])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <BackToDeckButton deckId={deckId} className="absolute -left-32 top-2" />
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Cargando resumen</h1>
            <p className="mt-2 text-sm text-slate-600">Obteniendo metricas de la sesion...</p>
          </div>
          </div>
        </div>
      </main>
    )
  }

  if (errorMessage || !finalMetrics) {
    return (
      <SummaryErrorState
        deckId={deckId}
        message={errorMessage ?? 'No fue posible obtener el resumen de la sesion. Intenta de nuevo desde el mazo.'}
      />
    )
  }

  const durationSeconds = toSafeNumber(finalMetrics.duration_seconds)
  const answered = toSafeNumber(finalMetrics.answered)
  const correct = toSafeNumber(finalMetrics.correct)
  const wrong = toSafeNumber(finalMetrics.wrong)
  const endReason = finalMetrics.end_reason ?? 'unknown'
  const itemsServed = toSafeNumber(finalMetrics.items_served)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="relative">
          <BackToDeckButton deckId={deckId} className="absolute -left-32 top-2" />
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Studio Session
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Resumen de sesion</h1>
          <p className="mt-2 text-sm text-slate-600">Session ID: {sessionId}</p>
          </header>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">duration_seconds</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{durationSeconds}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">items_served</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{itemsServed}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">answered</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{answered}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">correct</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{correct}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">wrong</p>
            <p className="mt-1 text-2xl font-bold text-rose-700">{wrong}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">end_reason</p>
            <p className="mt-1 text-lg font-semibold capitalize text-slate-900">{endReason}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Topics performance</h2>
          {topicPerformance.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {topicPerformance.map((topic) => (
                <li
                  key={topic.key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">{topic.topic}</span>
                  <span className="text-sm font-semibold text-slate-900">{topic.accuracy}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No topic metrics available yet</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Subject performance</h2>
          {subjectPerformance.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {subjectPerformance.map((subject) => (
                <li
                  key={subject.subject}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">{subject.subject}</span>
                  <span className="text-sm font-semibold text-slate-900">{subject.accuracy}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No subject metrics available yet</p>
          )}
        </section>
      </div>
    </main>
  )
}
