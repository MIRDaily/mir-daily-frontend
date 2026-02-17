import { parseApiError } from '@/lib/profile'

export type University = {
  id: number
  name: string
  country: string
}

export type MainGoal = 'prepare_mir' | 'reinforce_degree' | 'explore'

export type MirSpecialty = {
  id: number
  name: string
}

export type OnboardingPayload = {
  displayName: string
  username: string
  medicalYear: number | null
  mirSpecialtyId: number | null
  mainGoal: MainGoal | null
  universityId: number | null
  customUniversity: string | null
  profilePublic: boolean
}

type AuthenticatedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export async function fetchUniversities(
  apiUrl: string,
  authenticatedFetch: AuthenticatedFetch,
): Promise<University[]> {
  const response = await authenticatedFetch(`${apiUrl}/api/profile/universities`)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json().catch(() => null)) as
    | { universities?: unknown }
    | null
  if (!payload || !Array.isArray(payload.universities)) return []

  return payload.universities
    .filter(
      (item): item is University =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as University).id === 'number' &&
        typeof (item as University).name === 'string' &&
        typeof (item as University).country === 'string',
    )
    .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
}

export async function submitOnboarding(
  apiUrl: string,
  authenticatedFetch: AuthenticatedFetch,
  body: OnboardingPayload,
) {
  const response = await authenticatedFetch(`${apiUrl}/api/profile/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  return response
}

export async function fetchMirSpecialties(
  apiUrl: string,
  authenticatedFetch: AuthenticatedFetch,
): Promise<MirSpecialty[]> {
  const response = await authenticatedFetch(`${apiUrl}/api/profile/mir-specialties`)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json().catch(() => null)) as
    | { specialties?: unknown }
    | null
  if (!payload || !Array.isArray(payload.specialties)) return []

  return payload.specialties
    .filter(
      (item): item is MirSpecialty =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as MirSpecialty).id === 'number' &&
        typeof (item as MirSpecialty).name === 'string',
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function updateAvatarRealtime(
  apiUrl: string,
  authenticatedFetch: AuthenticatedFetch,
  avatarId: number,
) {
  const avatarUrl = `${apiUrl}/api/profile/avatar`
  const requestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ avatarId }),
  } as const

  let response = await authenticatedFetch(avatarUrl, {
    method: 'POST',
    ...requestInit,
  })

  if (response.status === 404) {
    response = await authenticatedFetch(avatarUrl, {
      method: 'PATCH',
      ...requestInit,
    })
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  return response
}

export async function checkUsernameAvailability(
  apiUrl: string,
  authenticatedFetch: AuthenticatedFetch,
  username: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const response = await authenticatedFetch(`${apiUrl}/api/profile/check-username`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
    signal,
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json().catch(() => null)) as { available?: unknown } | null
  return payload?.available === true
}
