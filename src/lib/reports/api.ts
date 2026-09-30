import { supabase } from '@/lib/supabaseBrowser'
import type { ImageSubcategory, ReportCategory } from './categories'

export type ReportOrigin =
  | 'daily'
  | 'daily_review'
  | 'simulacro'
  | 'simulacro_review'
  | 'deck'
  | 'versus'
  | 'guide'

export type ReportTarget =
  | { type: 'question'; questionId: number | string }
  /** guideRef = `<guía>/<ref>`, p. ej. `neurologia/q70`. La foto la manda el cliente: la guía vive en el código. */
  | { type: 'guide'; guideRef: string; snapshot?: Record<string, unknown> }

export type ReportContext = {
  origin: ReportOrigin
  sessionRef?: string | null
  /** Si ya había respondido. Antes de responder se ocultan las categorías que lo exigen. */
  answered: boolean
  /** Opción elegida, 1-based. */
  userAnswer?: number | null
  isCorrect?: boolean | null
}

export type MyReport = {
  category: ReportCategory
  subcategory: ImageSubcategory | null
  suggested_answer: number | null
  message: string | null
  updated_at: string
}

export function contentKeyOf(target: ReportTarget): string {
  return target.type === 'question' ? `q:${target.questionId}` : `g:${target.guideRef}`
}

async function authFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Inicia sesión para reportar')

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || 'No se pudo enviar el reporte')
  return body
}

export async function getMyReports(target: ReportTarget): Promise<MyReport[]> {
  const body = await authFetch(
    `/api/reports/mine?contentKey=${encodeURIComponent(contentKeyOf(target))}`,
  )
  return Array.isArray(body?.reports) ? body.reports : []
}

export async function submitReport(input: {
  target: ReportTarget
  context: ReportContext
  category: ReportCategory
  subcategory?: ImageSubcategory | null
  suggestedAnswer?: number | null
  message?: string
}): Promise<{ updated: boolean }> {
  const { target, context } = input
  const body = await authFetch('/api/reports', {
    method: 'POST',
    body: JSON.stringify({
      contentType: target.type,
      questionId: target.type === 'question' ? Number(target.questionId) : undefined,
      guideRef: target.type === 'guide' ? target.guideRef : undefined,
      snapshot: target.type === 'guide' ? target.snapshot : undefined,
      category: input.category,
      subcategory: input.subcategory ?? null,
      suggestedAnswer: input.suggestedAnswer ?? null,
      message: input.message ?? '',
      origin: context.origin,
      sessionRef: context.sessionRef ?? null,
      answered: context.answered,
      userAnswer: context.userAnswer ?? null,
      isCorrect: context.isCorrect ?? null,
      platform: 'web',
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  })
  return { updated: !!body?.updated }
}

// Qué contenidos ha reportado ya el usuario en esta pestaña, para pintar la
// bandera rellena sin preguntar al servidor por cada pregunta.
const reported = new Set<string>()
const listeners = new Set<() => void>()

export function markReported(key: string) {
  reported.add(key)
  listeners.forEach((l) => l())
}

export function isReported(key: string) {
  return reported.has(key)
}

export function subscribeReported(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
