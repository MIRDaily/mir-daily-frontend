import { supabase } from '@/lib/supabaseBrowser'
import type { ReportCategory } from '@/lib/reports/categories'

// Panel de reportes: tipos y llamadas a /api/admin. El permiso lo valida el
// backend en cada petición (403 si no eres admin).

export type Tier = 'critica' | 'revisar' | 'espera'
export type ReportStatus = 'open' | 'accepted' | 'rejected' | 'duplicate'
export type Outcome = Exclude<ReportStatus, 'open'>

export type QueueItem = {
  content_key: string
  content_type: 'question' | 'guide'
  question_id: number | null
  guide_ref: string | null
  tier: Tier
  score: number
  n_users: number
  n_reports: number
  categories: ReportCategory[]
  year: number | null
  question_number: number | null
  subject: string | null
  statement_preview: string | null
  correct_answer: number | null
  suggested_answers: Record<string, number> | null
  anulada: boolean
  n_answers: number | null
  pct_correct: number | null
  top_option: number | null
  data_supports: boolean
  image_broken: boolean
  messages: string[]
  /** Solo guías: lo añade el backend desde la foto del reporte. */
  guide_title?: string | null
  first_at: string
  last_at: string
}

export type QuestionSnapshot = {
  year?: number | null
  question_number?: number | null
  subject?: string | null
  topic?: string | null
  statement?: string | null
  options?: string[]
  correct_answer?: number | string | null
  explanation?: string | null
  has_image?: boolean
  image_url?: string | null
  image_status?: string | null
  anulada?: boolean
  captured_at?: string
  // Guías
  guide_title?: string
  number?: number
  stem?: string
  correct?: number
  imageUrl?: string | null
  title?: string
}

export type AdminReport = {
  id: number
  content_key: string
  content_type: 'question' | 'guide'
  question_id: number | null
  guide_ref: string | null
  category: ReportCategory
  subcategory: string | null
  suggested_answer: number | null
  message: string | null
  snapshot: QuestionSnapshot
  origin: string
  session_ref: string | null
  answered: boolean
  user_answer: number | null
  user_was_correct: boolean | null
  platform: 'web' | 'app'
  app_version: string | null
  user_agent: string | null
  status: ReportStatus
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  reporter: { name: string; accepted: number; rejected: number } | null
}

export type AnswerStat = { selected_option: number | null; n: number; n_correct: number }

export type ReportDetailData = {
  key: string
  queue: QueueItem | null
  current: QuestionSnapshot | null
  stats: AnswerStat[]
  reports: AdminReport[]
}

export type SuspiciousItem = {
  question_id: number
  year: number | null
  question_number: number | null
  subject: string | null
  statement_preview: string | null
  correct_answer: number | null
  n_answers: number
  pct_correct: number
  top_option: number | null
  top_option_pct: number
  open_reports: number
  anulada: boolean
}

export type HistoryItem = {
  id: number
  content_key: string
  content_type: 'question' | 'guide'
  question_id: number | null
  guide_ref: string | null
  category: ReportCategory
  status: Outcome
  resolution_note: string | null
  resolved_at: string
  year: number | null
  question_number: number | null
  subject: string | null
  guide_title: string | null
}

export type EditableField = 'statement' | 'options' | 'correct_answer' | 'explanation' | 'image_url'

export type QuestionChanges = Partial<{
  statement: string
  options: string[]
  correct_answer: number
  explanation: string | null
  image_url: string | null
}>

export type QuestionState = {
  statement: string
  options: string[]
  correct_answer: number
  explanation: string | null
  image_url: string | null
  has_image: boolean
}

export type Revision = {
  id: number
  edited_by: string | null
  editor: string | null
  edited_at: string
  changed_fields: EditableField[]
  before: QuestionState
  after: QuestionState
  note: string | null
}

export type EditResult = {
  ok: true
  unchanged: boolean
  revisionId: number | null
  changedFields: EditableField[]
  resolved: { resolved: number; notified: number; xp_awarded: number } | null
  resolveError?: string
}

export const FIELD_LABEL: Record<EditableField, string> = {
  statement: 'enunciado',
  options: 'opciones',
  correct_answer: 'clave',
  explanation: 'explicación',
  image_url: 'imagen',
}

// Igual que notaAutomatica del backend: lo que leerá el usuario si no se
// escribe una nota al "corregir y aceptar".
export function autoNote(
  fields: EditableField[],
  before: { correct_answer?: unknown },
  after: { correct_answer?: unknown },
): string {
  const parts = fields.map((f) =>
    f === 'correct_answer'
      ? `clave (${letter(toAnswerNumber(before.correct_answer))} → ${letter(toAnswerNumber(after.correct_answer))})`
      : FIELD_LABEL[f],
  )
  if (parts.length === 0) return ''
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
  return `Cambios: ${list}.`
}

export class AdminError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new AdminError('Inicia sesión', 401)

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminError(body?.error || 'Error del servidor', res.status)
  return body as T
}

export const adminApi = {
  me: () => adminFetch<{ admin: boolean }>('/me'),
  queue: () => adminFetch<{ items: QueueItem[] }>('/reports/queue').then((r) => r.items),
  history: () => adminFetch<{ items: HistoryItem[] }>('/reports/history').then((r) => r.items),
  detail: (key: string) =>
    adminFetch<ReportDetailData>(`/reports/detail?key=${encodeURIComponent(key)}`),
  resolve: (key: string, outcome: Outcome, note: string, xp: number) =>
    adminFetch<{ ok: true; resolved: number; notified: number; xp_awarded: number }>(
      '/reports/resolve',
      { method: 'POST', body: JSON.stringify({ key, outcome, note, xp }) },
    ),
  setAnulada: (questionId: number, anulada: boolean) =>
    adminFetch<{ ok: true; anulada: boolean }>(`/questions/${questionId}/anulada`, {
      method: 'POST',
      body: JSON.stringify({ anulada }),
    }),
  editQuestion: (
    questionId: number,
    changes: QuestionChanges,
    note: string,
    resolve: { note: string; xp: number } | null,
  ) =>
    adminFetch<EditResult>(`/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ changes, note, resolve }),
    }),
  revisions: (questionId: number) =>
    adminFetch<{ items: Revision[] }>(`/questions/${questionId}/revisions`).then((r) => r.items),
  revertRevision: (questionId: number, revisionId: number) =>
    adminFetch<EditResult>(`/questions/${questionId}/revisions/${revisionId}/revert`, { method: 'POST' }),
  suspicious: (min: number, maxPct: number) =>
    adminFetch<{ items: SuspiciousItem[] }>(`/suspicious?min=${min}&maxPct=${maxPct}`).then(
      (r) => r.items,
    ),
}

// ---------------------------------------------------------------------------
// Utilidades de presentación
// ---------------------------------------------------------------------------

export const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function letter(n: number | null | undefined): string {
  return n != null && n >= 1 && n <= 5 ? LETTERS[n - 1] : '—'
}

export function toAnswerNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\D/g, ''))
  return Number.isInteger(n) && n > 0 ? n : null
}

export function contentTitle(item: {
  content_key: string
  year?: number | null
  question_number?: number | null
  guide_ref?: string | null
  guide_title?: string | null
}): string {
  if (item.content_key.startsWith('q:')) {
    return item.year && item.question_number
      ? `MIR ${item.year} · P${item.question_number}`
      : `Pregunta ${item.content_key.slice(2)}`
  }
  const ref = item.guide_ref ?? item.content_key.slice(2)
  const [guide, ...rest] = ref.split('/')
  const where = rest.join('/')
  const label = where === 'general' ? 'general' : where.replace(/^q/, 'P')
  return `Guía ${item.guide_title ?? guide} · ${label}`
}

export const TIER_META: Record<Tier, { label: string; color: string; soft: string }> = {
  critica: { label: 'Crítica', color: '#C4655A', soft: '#FBEDEA' },
  revisar: { label: 'Revisar', color: '#A9821F', soft: '#FFF7E0' },
  espera: { label: 'En espera', color: '#7D8A96', soft: '#F2EFED' },
}

export const STATUS_META: Record<ReportStatus, { label: string; color: string; soft: string }> = {
  open: { label: 'Abierto', color: '#A9821F', soft: '#FFF7E0' },
  accepted: { label: 'Aceptado', color: '#4F7A4B', soft: '#EAF2E9' },
  rejected: { label: 'Rechazado', color: '#7D8A96', soft: '#F2EFED' },
  duplicate: { label: 'Duplicado', color: '#5B7D99', soft: '#EAF1F7' },
}

export const ORIGIN_LABEL: Record<string, string> = {
  daily: 'Daily',
  daily_review: 'Revisión del daily',
  simulacro: 'Simulacro',
  simulacro_review: 'Resultados del simulacro',
  deck: 'Mazo',
  versus: 'Versus',
  guide: 'Guía',
}

export const SUBCATEGORY_LABEL: Record<string, string> = {
  no_carga: 'no carga',
  no_corresponde: 'no corresponde',
  no_se_ve: 'no se ve bien',
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `hace ${d} d`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Qué ha cambiado en la pregunta desde que se hizo el reporte. Si ya no
// coincide, probablemente alguien lo corrigió y solo falta cerrar el reporte.
const DIFF_FIELDS: { key: keyof QuestionSnapshot; label: string }[] = [
  { key: 'statement', label: 'enunciado' },
  { key: 'options', label: 'opciones' },
  { key: 'correct_answer', label: 'clave' },
  { key: 'explanation', label: 'explicación' },
  { key: 'image_url', label: 'imagen' },
  { key: 'anulada', label: 'anulada' },
]

export function snapshotDiff(
  snapshot: QuestionSnapshot,
  current: QuestionSnapshot | null,
): { key: keyof QuestionSnapshot; label: string }[] {
  if (!current) return []
  const norm = (v: unknown) =>
    JSON.stringify(v === undefined || v === null ? null : typeof v === 'number' ? String(v) : v)
  return DIFF_FIELDS.filter((f) => f.key in snapshot && norm(snapshot[f.key]) !== norm(current[f.key]))
}
