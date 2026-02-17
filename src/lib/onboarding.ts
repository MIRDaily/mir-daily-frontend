export const ONBOARDING_DEFERRED_STORAGE_KEY = 'onboarding.deferred'

export function getOnboardingDeferredFlag(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ONBOARDING_DEFERRED_STORAGE_KEY) === '1'
}

export function setOnboardingDeferredFlag(value: boolean) {
  if (typeof window === 'undefined') return
  if (value) {
    window.localStorage.setItem(ONBOARDING_DEFERRED_STORAGE_KEY, '1')
    return
  }
  window.localStorage.removeItem(ONBOARDING_DEFERRED_STORAGE_KEY)
}
