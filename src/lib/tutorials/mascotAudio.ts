/* ════════════════════════════════════════════════════════════════════════
   Los "blips" de la mascota mientras escribe.

   Sintetizados, no ficheros: el proyecto no tiene un solo audio en public/, y
   un oscilador con el pitch moviéndose suena a Animal Crossing igual de bien
   sin pesar nada ni arrastrar licencias. Mismo patrón que zenAudio.ts.

   Regla del navegador que manda en el diseño: sin un gesto previo del usuario
   no hay sonido. El primer cuadro del tutorial sale solo, sin que nadie haya
   tocado nada, así que ESE puede salir mudo. No se pelea con la regla: se
   desbloquea en cuanto haya un gesto —incluido el primer toque para acelerar
   el texto— y a partir de ahí suena, aunque sea a mitad de la frase.
═══════════════════════════════════════════════════════════════════════════ */

/** Todo lo que define cómo suena la mascota, en un solo sitio. */
export type VozMascota = {
  /** Forma de onda. 'triangle' es suave; 'square' suena más a consola vieja. */
  onda: OscillatorType
  /** Nota base en Hz. 523.25 = do5. Bajarla da una voz más grave. */
  baseHz: number
  /** Grados (en semitonos) entre los que salta. Pentatónica: todo casa. */
  grados: number[]
  /** Volumen de cada blip. Por encima de ~0.12 empieza a cansar. */
  volumen: number
  /** Ataque en segundos. Muy corto = percusivo. */
  ataqueS: number
  /** Cola en segundos. Alargarla hace que las sílabas se solapen. */
  colaS: number
  /** Un blip cada N caracteres a velocidad normal. 1 satura, 2 suena a voz. */
  cadencia: number
}

export const VOZ_POR_DEFECTO: VozMascota = {
  onda: 'triangle',
  baseHz: 523.25,
  grados: [0, 2, 4, 7, 9],
  volumen: 0.05,
  ataqueS: 0.005,
  colaS: 0.08,
  cadencia: 2,
}

let _voz: VozMascota = { ...VOZ_POR_DEFECTO }

/** Cambia la voz en caliente. Parcial: lo que no se pasa se queda como está. */
export function configurarVoz(ajustes: Partial<VozMascota>): void {
  _voz = { ..._voz, ...ajustes }
}

export function vozActual(): VozMascota {
  return _voz
}

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

/**
 * Deja el audio listo en cuanto el usuario toque CUALQUIER cosa de la app, sin
 * esperar al primer click del tutorial.
 *
 * Importa más de lo que parece: si se llega al Daily navegando por dentro de
 * la web —un click en "Daily" del header— es el mismo documento, el gesto ya
 * ha ocurrido y el primer cuadro puede sonar. Desbloqueando solo en el click
 * del tutorial, ese caso se perdía y el saludo salía mudo siempre.
 *
 * Los oyentes NO son `once`. Lo eran, y ese era el fallo del "a veces no se oye
 * la primera frase": si el primer gesto llegaba cuando el navegador todavía no
 * dejaba arrancar el contexto, `resume()` no lo ponía en marcha, el oyente ya
 * se había consumido y la voz se quedaba muda para el resto de la sesión. Ahora
 * se sueltan solo cuando el contexto está de verdad en `running`.
 */
export function armarDesbloqueo(): () => void {
  if (typeof window === 'undefined') return () => {}

  const eventos = ['pointerdown', 'keydown', 'touchstart'] as const
  let soltado = false

  const soltar = () => {
    if (soltado) return
    soltado = true
    for (const evento of eventos) window.removeEventListener(evento, alTocar)
  }

  const alTocar = () => {
    void desbloquearVoz().then(() => {
      if (_ctx?.state === 'running') soltar()
    })
  }

  for (const evento of eventos) {
    window.addEventListener(evento, alTocar, { passive: true })
  }

  return soltar
}

/**
 * Llamar de forma síncrona dentro del onClick que avanza el tutorial.
 *
 * `_desbloqueado` se marca ANTES del `await`: `resume()` tarda unos
 * milisegundos y la máquina de escribir ya está corriendo, así que esperar a
 * que resuelva se comía los primeros blips de la frase. `blip` comprueba de
 * todas formas que el contexto esté en `running`, de modo que adelantar la
 * bandera no puede hacer sonar nada antes de tiempo: solo evita perder los
 * caracteres que caen dentro de esa ventana.
 */
export async function desbloquearVoz(): Promise<void> {
  const ctx = getCtx()
  if (!ctx) return
  _desbloqueado = true
  try {
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    /* sin sonido, el tutorial funciona igual */
  }
}

/**
 * Un blip por carácter. `semilla` mueve el tono para que la frase no suene a
 * pitido plano: es lo que hace que se lea como una voz y no como un contador.
 */
export function blip(semilla: number, volumen = _voz.volumen): void {
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
    const { grados } = _voz
    const semitono = grados[Math.abs(Math.trunc(semilla)) % grados.length]
    osc.type = _voz.onda
    osc.frequency.value = _voz.baseHz * Math.pow(2, semitono / 12)

    const ahora = ctx.currentTime
    gain.gain.setValueAtTime(0, ahora)
    gain.gain.linearRampToValueAtTime(volumen, ahora + _voz.ataqueS)
    gain.gain.exponentialRampToValueAtTime(0.0001, ahora + _voz.colaS)

    osc.start(ahora)
    osc.stop(ahora + _voz.colaS + 0.01)
  } catch {
    /* silencio */
  }
}
