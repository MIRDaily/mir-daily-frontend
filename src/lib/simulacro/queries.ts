'use client'

// Acceso a datos del simulacro a través del BACKEND (no directo a Supabase).
// El backend exige autenticación y nunca envía la respuesta correcta en
// /questions; la corrección se valida en el servidor vía /check.

import { supabase } from '@/lib/supabaseBrowser'
import type {
  SimulacroConfig,
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
// preguntas, la opción correcta y la explicación.
export async function checkSimulacroAnswers(
  answers: { questionId: number; selectedIndex: number | null }[],
): Promise<SimulacroResult[]> {
  if (answers.length === 0) return []
  const { results } = await apiFetch<{ results: SimulacroResult[] }>('/check', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
  return results ?? []
}
