import { supabase } from '@/lib/supabaseBrowser'

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('API_URL no definida: revisa variables de entorno')
}

export type ActivityHeatmapLevel = 0 | 1 | 2

export type ActivityHeatmapDay = {
  date: string
  level: ActivityHeatmapLevel
}

export type ActivityHeatmapStats = {
  currentStreak: number
  longestStreak: number
  totalActiveDays: number
  totalDailyDays: number
}

export type ActivityHeatmapResponse = {
  range: {
    from: string
    to: string
  }
  days: ActivityHeatmapDay[]
  stats: ActivityHeatmapStats
}

async function readError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null
    if (payload?.message) return payload.message
    if (payload?.error) return payload.error
  }

  const text = await response.text().catch(() => '')
  return text || `Error al cargar actividad (${response.status})`
}

export async function fetchActivityHeatmap(
  signal?: AbortSignal,
): Promise<ActivityHeatmapResponse> {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (error || !token) {
    throw new Error('No hay sesion activa.')
  }

  const response = await fetch(`${API_URL}/api/stats/activity-heatmap`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  const payload = (await response.json()) as ActivityHeatmapResponse
  return payload
}
