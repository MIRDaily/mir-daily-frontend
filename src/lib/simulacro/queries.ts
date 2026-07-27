'use client'

// Acceso a datos del simulacro a través del BACKEND (no directo a Supabase).
// El backend exige autenticación y nunca envía la respuesta correcta en
// /questions; la corrección se valida en el servidor vía /check.

import { supabase } from '@/lib/supabaseBrowser'
import type {
  SimulacroCalendarDay,
  SimulacroConfig,
  SimulacroHistoryDetail,
  SimulacroHistorySession,
  SimulacroMode,
  SimulacroQuestion,
  SimulacroResult,
  Subject,
  Topic,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL no definida: revisa variables de entorno')
}

async function getToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (error || !token) throw new Error('No hay sesión activa.')
  return token
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const response = await fetch(`${API_URL}/api/simulacro${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new Error(payload?.error || `Error de red (${response.status})`)
  }

  return (await response.json()) as T
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { subjects } = await apiFetch<{ subjects: Subject[] }>('/subjects')
  return subjects ?? []
}

export async function fetchTopics(subjectIds: number[]): Promise<Topic[]> {
  if (subjectIds.length === 0) return []
  const { topics } = await apiFetch<{ topics: Topic[] }>(
    `/topics?subjects=${subjectIds.join(',')}`,
  )
  return topics ?? []
}

export async function fetchSimulacroQuestions(
  config: SimulacroConfig,
): Promise<SimulacroQuestion[]> {
  if (config.subjectIds.length === 0) return []
  const { questions } = await apiFetch<{ questions: SimulacroQuestion[] }>(
    '/questions',
    {
      method: 'POST',
      body: JSON.stringify({
        subjectIds: config.subjectIds,
        topicIds: config.topicIds,
        count: config.count,
      }),
    },
  )
  return questions ?? []
}

// Corrige en el servidor las respuestas indicadas y devuelve, solo para esas
// preguntas, la opción correcta y la explicación. `selectedIndex: null` =
// pregunta dejada en blanco. Si se pasa `sessionId`, el backend persiste cada
// respuesta para la analítica de rendimiento (idempotente por sesión+pregunta).
export async function checkSimulacroAnswers(
  answers: { questionId: number; selectedIndex: number | null; timeSpent?: number }[],
  sessionId?: string,
): Promise<SimulacroResult[]> {
  if (answers.length === 0) return []
  const { results } = await apiFetch<{ results: SimulacroResult[] }>('/check', {
    method: 'POST',
    body: JSON.stringify({ answers, sessionId }),
  })
  return results ?? []
}

// Marca la sesión como terminada. El backend solo la guarda en el historial
// si de verdad hay >=50 respuestas persistidas para ese sessionId; si el
// simulacro se dejó a medias, esta llamada no crea nada. Best-effort: un
// fallo aquí no debe romper la pantalla de resultados.
export async function finishSimulacroSession(
  sessionId: string,
  mode: SimulacroMode,
): Promise<{ saved: boolean; total: number }> {
  return apiFetch<{ saved: boolean; total: number }>('/finish', {
    method: 'POST',
    body: JSON.stringify({ sessionId, mode }),
  })
}

export async function fetchSimulacroHistory(
  limit = 20,
  offset = 0,
): Promise<SimulacroHistorySession[]> {
  const { sessions } = await apiFetch<{ sessions: SimulacroHistorySession[] }>(
    `/history?limit=${limit}&offset=${offset}`,
  )
  return sessions ?? []
}

export async function fetchSimulacroHistoryDetail(
  sessionId: string,
): Promise<SimulacroHistoryDetail> {
  return apiFetch<SimulacroHistoryDetail>(`/history/${sessionId}`)
}

// from/to en formato YYYY-MM-DD (año natural elegido en el heatmap-calendario).
export async function fetchSimulacroCalendar(
  from: string,
  to: string,
): Promise<SimulacroCalendarDay[]> {
  const { days } = await apiFetch<{ days: SimulacroCalendarDay[] }>(
    `/calendar?from=${from}&to=${to}`,
  )
  return days ?? []
}
