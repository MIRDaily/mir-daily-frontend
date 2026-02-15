import { AVATAR_BASE_URL } from './constants'

export const AVATAR_CATALOG = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export function getAvatarUrl(avatarId: number): string {
  return `${AVATAR_BASE_URL}${avatarId}.webp`
}

export function getSafeAvatarId(avatarId: number): number {
  return AVATAR_CATALOG.includes(avatarId as (typeof AVATAR_CATALOG)[number]) ? avatarId : 1
}
