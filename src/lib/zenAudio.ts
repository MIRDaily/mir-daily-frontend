/**
 * Singleton Web Audio context for Zen Room phase-change bells.
 *
 * Rules enforced here:
 *  1. AudioContext is created lazily and reused (browsers limit the number).
 *  2. Sound may only play after the user has clicked "Iniciar" at least once.
 *     Call primeAudio() synchronously inside that click handler to unlock.
 *  3. Before each playback attempt we call ctx.resume() in case the browser
 *     suspended the context automatically.
 */

let _ctx: AudioContext | null = null
let _audioUnlocked            = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AudioCtx) return null
      _ctx = new AudioCtx()
    }
    return _ctx
  } catch {
    return null
  }
}

/**
 * Call this synchronously inside a user-gesture handler (e.g. the "Iniciar"
 * button onClick). It creates — or resumes — the AudioContext so that
 * subsequent playBell() calls work without browser restrictions.
 */
export async function primeAudio(): Promise<void> {
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    _audioUnlocked = true
  } catch {
    // silently ignore — audio simply won't play
  }
}

/**
 * Play a short phase-change bell.
 * No-ops silently if primeAudio() has not been called yet.
 */
export async function playBell(phase: 'study' | 'break'): Promise<void> {
  if (!_audioUnlocked) return
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') await ctx.resume()

    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // Study start → bright A5 (880 Hz), break → softer E5 (659 Hz)
    osc.type            = 'sine'
    osc.frequency.value = phase === 'study' ? 880 : 659

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02)   // fast attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9) // slow fade

    osc.start(now)
    osc.stop(now + 0.9)
  } catch {
    // silently ignore
  }
}
