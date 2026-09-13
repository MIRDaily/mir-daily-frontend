/* ════════════════════════════════════════════════════════════════════════
   Los "blips" de la mascota mientras escribe.

   Sintetizados, no ficheros: el proyecto no tiene un solo audio en public/, y
   un oscilador con el pitch moviéndose suena a Animal Crossing igual de bien
   sin pesar nada ni arrastrar licencias. Mismo patrón que zenAudio.ts.

   Regla del navegador que manda en el diseño: sin un gesto previo del usuario
   no hay sonido. El primer cuadro del tutorial sale solo, sin que nadie haya
   tocado nada, así que ESE va mudo por definición. No se pelea: se desbloquea
   en el primer "Siguiente" y a partir de ahí suena.
═══════════════════════════════════════════════════════════════════════════ */

let _ctx: AudioContext | null = null
let _desbloqueado = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      _ctx = new AudioCtx()
    }
    return _ctx
  } catch {
    return null
  }
}

/** Llamar de forma síncrona dentro del onClick que avanza el tutorial. */
export async function desbloquearVoz(): Promise<void> {
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    _desbloqueado = true
  } catch {
    /* sin sonido, el tutorial funciona igual */
  }
}

/**
 * Un blip por carácter. `semilla` mueve el tono para que la frase no suene a
 * pitido plano: es lo que hace que se lea como una voz y no como un contador.
 */
export function blip(semilla: number, volumen = 0.05): void {
  if (!_desbloqueado) return
  const ctx = getCtx()
  if (!ctx || ctx.state !== 'running') return

  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // Pentatónica alrededor de un do agudo: cualquier secuencia suena bien,
    // que es justo lo que hace falta cuando el orden lo decide el texto.
    const grados = [0, 2, 4, 7, 9]
    const semitono = grados[Math.abs(Math.trunc(semilla)) % grados.length]
    osc.type = 'triangle'
    osc.frequency.value = 523.25 * Math.pow(2, semitono / 12)

    const ahora = ctx.currentTime
    gain.gain.setValueAtTime(0, ahora)
    gain.gain.linearRampToValueAtTime(volumen, ahora + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.08)

    osc.start(ahora)
    osc.stop(ahora + 0.09)
  } catch {
    /* silencio */
  }
}
