'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useReducedMotion } from 'framer-motion'

/* ════════════════════════════════════════════════════════════════════════
   Las chispas del salto de nivel.

   POR QUÉ UN CANVAS Y NO MÁS NODOS ANIMADOS. El confeti de antes eran catorce
   <span> con fotogramas escritos a mano: caían desde arriba, no sabían dónde
   estaba la barra y no podían chocar con nada. Para que las chispas TOQUEN la
   barra hacen falta dos cosas que el DOM no da barato: varias decenas de
   piezas moviéndose a la vez, y una posición que se recalcula en cada
   fotograma en vez de interpolarse entre dos valores. Aquí son objetos en un
   array y un solo elemento en la página.

   QUÉ LAS HACE SENTIRSE FÍSICAS. No es el número de partículas, son cuatro
   detalles: (1) la gravedad las curva, así que suben frenando y bajan
   acelerando; (2) el rozamiento del aire mata la velocidad inicial rápido, que
   es lo que distingue una chispa de un cohete; (3) las que caen sobre la barra
   REBOTAN en ella, pierden velocidad y acaban posándose encima; y (4) se
   pintan como trazos entre la posición anterior y la actual, no como puntos,
   así que la estela sale de la velocidad real y no de un desenfoque falso.

   El bucle se apaga solo cuando muere la última chispa. Nada de rAF eterno.

   La simulación vive FUERA del componente, en un "motor" que React solo
   guarda. Así el bucle puede llamarse a sí mismo sin que el componente tenga
   que sostener una función recursiva, y sobre todo: una salva nueva no
   reinicia nada, se suma a lo que ya está volando.
═══════════════════════════════════════════════════════════════════════════ */

/** Píxeles por segundo al cuadrado. Alta a propósito: una gravedad "real"
    (~980) dentro de una caja de 300 px se ve flotante, como en la Luna. */
const GRAVEDAD = 1600

/** Rozamiento del aire, por fotograma a 60 fps. */
const ROZAMIENTO = 0.9

/** Velocidad que conserva al rebotar en la barra. Un tercio: son brasas, no
    pelotas de goma. */
const REBOTE = 0.34

/** Frenada tangencial al tocar la barra: es lo que las hace rodar y pararse. */
const ROCE = 0.74

/** Cuánto se borra de lo pintado en el fotograma anterior. Bajo = estela
    larga. Es el truco de siempre para tener rastro sin guardar historial. */
const BORRADO = 0.17

type Chispa = {
  x: number
  y: number
  /** Posición del fotograma anterior: de ahí sale el trazo. */
  px: number
  py: number
  vx: number
  vy: number
  edad: number
  vida: number
  color: string
  grosor: number
  rebotes: number
  /** Ya no se mueve: se ha posado sobre la barra. */
  posada: boolean
}

type Barra = { x0: number; x1: number; y: number }

type Motor = {
  lienzo: HTMLCanvasElement | null
  chispas: Chispa[]
  /** Identificador del rAF en curso, o null si el bucle está parado. */
  bucle: number | null
  anterior: number
  dpr: number
  barra: Barra | null
  /** Intensidad del fogonazo, de 1 a 0. */
  fogonazo: number
}

function crearSalva(barra: Barra, colores: string[]): Chispa[] {
  const fuera: Chispa[] = []

  const nueva = (x: number, y: number, ang: number, vel: number, vida: number): Chispa => ({
    x,
    y,
    px: x,
    py: y,
    vx: Math.cos(ang) * vel,
    vy: Math.sin(ang) * vel,
    edad: 0,
    vida,
    color: colores[Math.floor(Math.random() * colores.length)],
    grosor: 1.3 + Math.random() * 2.1,
    rebotes: 0,
    posada: false,
  })

  /* La salva principal sale del extremo donde la barra ACABA de llenarse. Ese
     es el punto exacto del salto y por eso es de donde tiene que reventar: la
     barra llega al tope y estalla. */
  const foco = barra.x1 - 6

  /* EL CONO APUNTA ARRIBA Y HACIA DENTRO, no en círculo completo.

     Con el círculo entero —que es lo primero que sale— más de la mitad de las
     chispas salían disparadas por FUERA del extremo de la barra y caían al
     vacío sin tocar nada: quedaba bonito, pero no contaba con la barra, que
     era justo el encargo. Apuntando arriba y hacia el interior, suben, la
     gravedad las devuelve y LLUEVEN SOBRE LA BARRA, donde rebotan. Además se
     lee como el retroceso de algo que choca contra un tope, así que la
     desviación no es una trampa: es lo que haría de verdad. */
  const CENTRO = -Math.PI / 2 - 0.35
  const APERTURA = 2.6

  for (let i = 0; i < 58; i += 1) {
    const ang = CENTRO + (Math.random() - 0.5) * APERTURA
    // Cáscara con grosor: una explosión no manda todo a la misma velocidad,
    // pero tampoco reparte uniforme.
    const vel = 260 + Math.random() * 380
    const c = nueva(
      foco + (Math.random() - 0.5) * 6,
      barra.y + (Math.random() - 0.5) * 4,
      ang,
      vel,
      0.75 + Math.random() * 0.75,
    )
    c.vx -= 60
    fuera.push(c)
  }

  /* Y una lluvia corta a lo largo de toda la barra: es lo que hace que el
     efecto se lea como "la barra entera ha reaccionado" y no como un petardo
     colgado de la punta. */
  const ancho = Math.max(1, barra.x1 - barra.x0)
  for (let i = 0; i < 26; i += 1) {
    const x = barra.x0 + Math.random() * ancho
    // Hacia arriba y con poca apertura: son salpicaduras del impacto. La
    // velocidad está elegida para que suban entre 30 y 70 px y VUELVAN a caer
    // sobre la barra dentro de su vida: el rebote se ve, que es el objetivo.
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5
    fuera.push(nueva(x, barra.y, ang, 150 + Math.random() * 210, 0.6 + Math.random() * 0.7))
  }

  return fuera
}

/** Un fotograma de simulación y pintura. Se reprograma a sí mismo mientras
    quede algo vivo. */
function paso(m: Motor, ahora: number): void {
  const lienzo = m.lienzo
  const ctx = lienzo ? lienzo.getContext('2d') : null
  const barra = m.barra
  if (!lienzo || !ctx || !barra) {
    m.bucle = null
    return
  }

  // Acotado: si la pestaña estuvo en segundo plano, dt sería enorme y las
  // chispas darían un salto teletransportado.
  const dt = Math.min(0.034, (ahora - m.anterior) / 1000)
  m.anterior = ahora

  const w = lienzo.width / m.dpr
  const h = lienzo.height / m.dpr

  // Borrado parcial: deja medio vivo el rastro del fotograma anterior.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = `rgba(0,0,0,${BORRADO})`
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  if (m.fogonazo > 0.01) {
    const f = m.fogonazo
    const cx = barra.x1 - 6
    const cy = barra.y
    const r = 26 + (1 - f) * 26
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(255,255,255,${0.85 * f})`)
    g.addColorStop(0.45, `rgba(237,181,63,${0.45 * f})`)
    g.addColorStop(1, 'rgba(237,181,63,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    m.fogonazo = f - dt * 6
  }

  const frenada = Math.pow(ROZAMIENTO, dt * 60)
  const vivas: Chispa[] = []

  for (const c of m.chispas) {
    c.edad += dt
    if (c.edad >= c.vida) continue

    c.px = c.x
    c.py = c.y

    if (!c.posada) {
      c.vy += GRAVEDAD * dt
      c.vx *= frenada
      c.vy *= frenada
      c.x += c.vx * dt
      c.y += c.vy * dt

      /* El contacto con la barra. Se comprueba el CRUCE (dónde estaba y dónde
         está), no si acabó dentro: a 500 px/s una chispa se salta una barra de
         16 px entre dos fotogramas y la atravesaría sin enterarse. */
      const cruza = c.py <= barra.y && c.y >= barra.y && c.vy > 0
      if (cruza && c.x >= barra.x0 && c.x <= barra.x1) {
        c.y = barra.y
        c.vy = -c.vy * REBOTE
        c.vx *= ROCE
        c.rebotes += 1
        // Ya sin fuerza: se queda encima y se apaga ahí. Esto es lo que remata
        // la sensación de que la barra es un objeto sólido.
        if (c.rebotes >= 2 && Math.abs(c.vy) < 60) {
          c.posada = true
          c.vy = 0
          c.y = barra.y
        }
      }
    } else {
      // Posada: solo rueda un poco y se apaga antes que las demás.
      c.vx *= Math.pow(0.86, dt * 60)
      c.x += c.vx * dt
      c.edad += dt * 1.6
    }

    const q = 1 - c.edad / c.vida
    ctx.globalAlpha = Math.max(0, Math.min(1, q * 1.5))
    ctx.strokeStyle = c.color
    ctx.lineWidth = c.grosor * (0.45 + q * 0.55)
    ctx.beginPath()
    ctx.moveTo(c.px, c.py)
    ctx.lineTo(c.x, c.y)
    ctx.stroke()

    vivas.push(c)
  }

  ctx.globalAlpha = 1
  m.chispas = vivas

  if (vivas.length > 0 || m.fogonazo > 0.01) {
    m.bucle = requestAnimationFrame((t) => paso(m, t))
  } else {
    m.bucle = null
    ctx.clearRect(0, 0, w, h)
  }
}

export default function ChispasDeNivel({
  salva,
  barraRef,
  colores,
}: {
  /** Cada incremento dispara una salva nueva. En 0 no hay nada que pintar. */
  salva: number
  /** La barra con la que chocan. Se mide en vivo: si cambia de sitio o de
      ancho, las chispas chocan donde esté de verdad. */
  barraRef: RefObject<HTMLElement | null>
  colores: string[]
}) {
  const reduceMotion = useReducedMotion()
  const lienzoRef = useRef<HTMLCanvasElement | null>(null)
  const motorRef = useRef<Motor>({
    lienzo: null,
    chispas: [],
    bucle: null,
    anterior: 0,
    dpr: 1,
    barra: null,
    fogonazo: 0,
  })

  // Los colores se leen al disparar, no en las dependencias: el padre pasa un
  // array nuevo en cada render suyo.
  const coloresRef = useRef(colores)
  useEffect(() => {
    coloresRef.current = colores
  }, [colores])

  const disparar = useCallback(() => {
    const lienzo = lienzoRef.current
    const barraEl = barraRef.current
    if (!lienzo || !barraEl) return

    const rectoLienzo = lienzo.getBoundingClientRect()
    const rectoBarra = barraEl.getBoundingClientRect()
    if (rectoLienzo.width === 0 || rectoLienzo.height === 0) return

    /* El canvas se dimensiona en píxeles de verdad: sin esto, en una pantalla
       de retina los trazos de 1 px salen borrosos. OJO: tocar width/height
       BORRA el lienzo, así que solo se cambia cuando de verdad cambia de
       medida; si no, la segunda salva se llevaría por delante a la primera. */
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.round(rectoLienzo.width * dpr)
    const h = Math.round(rectoLienzo.height * dpr)
    if (lienzo.width !== w || lienzo.height !== h) {
      lienzo.width = w
      lienzo.height = h
    }

    const ctx = lienzo.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'

    // La barra, en coordenadas del canvas.
    const barra: Barra = {
      x0: rectoBarra.left - rectoLienzo.left,
      x1: rectoBarra.right - rectoLienzo.left,
      y: rectoBarra.top - rectoLienzo.top,
    }

    const m = motorRef.current
    m.lienzo = lienzo
    m.dpr = dpr
    m.barra = barra
    m.chispas = m.chispas.concat(crearSalva(barra, coloresRef.current))
    // Fogonazo en el punto del impacto. Dura un suspiro y es lo que lleva el
    // ojo ahí justo cuando salen las chispas.
    m.fogonazo = 1

    if (m.bucle === null) {
      m.anterior = performance.now()
      m.bucle = requestAnimationFrame((t) => paso(m, t))
    }
  }, [barraRef])

  useEffect(() => {
    if (salva <= 0 || reduceMotion) return
    disparar()
  }, [salva, reduceMotion, disparar])

  // Lo único que para el bucle es el desmontaje.
  useEffect(() => {
    const m = motorRef.current
    return () => {
      if (m.bucle !== null) cancelAnimationFrame(m.bucle)
      m.bucle = null
      m.chispas = []
    }
  }, [])

  if (reduceMotion) return null

  /* Se sale del ancho de la columna a propósito: las chispas tienen que poder
     volar por encima de la insignia y por los lados. La tarjeta recorta lo que
     sobre, que es justo el encuadre que queremos.

     OJO CON EL TAMAÑO: va con `width`/`height` explícitos y NO con los cuatro
     lados (left/right/top/bottom). Un <canvas> es un elemento reemplazado, y
     en posición absoluta con la medida en `auto` manda su tamaño intrínseco
     —300 × 150— y se ignora el lado opuesto. Puesto así se quedaba a 300 × 150
     en una esquina, con la barra fuera del lienzo: se pintaba todo, pero
     literalmente fuera de plano. */
  return (
    <canvas
      ref={lienzoRef}
      aria-hidden
      className="pointer-events-none absolute z-10"
      style={{
        left: -104,
        top: -132,
        width: 'calc(100% + 208px)',
        height: 'calc(100% + 188px)',
      }}
    />
  )
}
