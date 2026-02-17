export const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/
export const DISPLAY_NAME_REGEX = /^[A-Za-z0-9 ]{2,16}$/
export const CUSTOM_UNIVERSITY_MAX_LENGTH = 80

export function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase().slice(0, 20)
}

export function normalizeDisplayNameInput(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 16)
}

type MaybeProfilePayload = {
  username?: unknown
  displayName?: unknown
  display_name?: unknown
  profile?: {
    username?: unknown
    displayName?: unknown
    display_name?: unknown
  }
}

export function extractProfile(payload: unknown) {
  const data = (payload ?? {}) as MaybeProfilePayload
  const source = data.profile && typeof data.profile === 'object' ? data.profile : data

  const username =
    typeof source.username === 'string'
      ? source.username
      : source.username === null
        ? null
        : null

  const displayName =
    typeof source.displayName === 'string'
      ? source.displayName
      : typeof source.display_name === 'string'
        ? source.display_name
        : null

  return { username, displayName }
}

export async function parseApiError(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null)
    if (payload && typeof payload === 'object') {
      if ('error' in payload && typeof payload.error === 'string') return payload.error
      if ('message' in payload && typeof payload.message === 'string') return payload.message
    }
  }
  return (await response.text().catch(() => '')) || `Error (${response.status})`
}
