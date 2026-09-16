'use client'

import { useEffect, useRef } from 'react'
import type { AnimationItem } from 'lottie-web'

const sourceConfig = [
  { src: '/img/2.png', weight: 60 },
  { src: '/img/1.png', weight: 30 },
  { src: '/img/3.png', weight: 10 },
]

type FallLayer = {
  sizeMin: number
  sizeMax: number
  blur: number
  speedMin: number
  speedMax: number
  zIndex: number
}

/* `count` son las imágenes de cada capa y `bacteria`, las bacterias animadas
   (ver más abajo). Las bacterias se concentran en la capa enfocada, que es
   donde se aprecia su movimiento; en el primer plano no hay ninguna porque a
   ese tamaño y con ese desenfoque era una mancha azul que se lo comía todo. */
const layersConfig: (FallLayer & { count: number; bacteria: number })[] = [
  { count: 1, bacteria: 0, sizeMin: 350, sizeMax: 500, blur: 10, speedMin: 12, speedMax: 18, zIndex: 5 },
  { count: 3, bacteria: 1, sizeMin: 200, sizeMax: 300, blur: 5, speedMin: 20, speedMax: 30, zIndex: 4 },
  { count: 15, bacteria: 3, sizeMin: 120, sizeMax: 180, blur: 0, speedMin: 35, speedMax: 50, zIndex: 3 },
  { count: 25, bacteria: 1, sizeMin: 70, sizeMax: 110, blur: 3, speedMin: 55, speedMax: 75, zIndex: 2 },
  { count: 40, bacteria: 1, sizeMin: 30, sizeMax: 60, blur: 6, speedMin: 80, speedMax: 120, zIndex: 1 },
]

/** Transparencia de la capa enfocada (la única sin desenfoque). */
const FOCUSED_OPACITY = 0.92

/* ── Las bacterias ─────────────────────────────────────────────────────────
   Caen con la velocidad y el desenfoque de su capa, para ir a la misma
   profundidad que las demás células, pero más pequeñas que ellas
   (BACTERIA_SCALE): a tamaño de célula destacaban demasiado. Van aparte del
   sorteo de las imágenes y son pocas a propósito: una imagen que cae no
   cuesta nada, pero una animación Lottie se redibuja a cada fotograma, y
   metidas en el sorteo habrían salido decenas.

   El JSON trae la bacteria en un lienzo de 596 × 842 del que solo ocupa
   400 × 408 (medido en todos los fotogramas: x 94–494, y 218–626). El
   viewBox la recorta a un cuadrado de 420 centrado en ella; sin él saldría
   pequeña y rodeada de vacío.

   Su bucle dura 5 s y a esa velocidad apenas se notaba que se movía; va a
   ×5, un ciclo por segundo. */
const BACTERIA_SRC = '/lottie/bacteria.json'
const BACTERIA_VIEWBOX = '84 212 420 420'
const BACTERIA_SPEED = 5
/** Tamaño de una bacteria respecto a las células de su misma capa. */
const BACTERIA_SCALE = 0.6

const easingOptions = [
  'linear',
  'cubic-bezier(0.2,0.6,0.3,1)',
  'cubic-bezier(0.4,0.0,0.2,1)',
  'cubic-bezier(0.25,0.8,0.25,1)',
]

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min

const pickOne = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

const buildWeightedImages = () => {
  const weighted: string[] = []
  sourceConfig.forEach((item) => {
    for (let k = 0; k < item.weight; k += 1) {
      weighted.push(item.src)
    }
  })
  return weighted
}

/**
 * Tamaño, posición, deriva, giro, desenfoque y caída de un elemento.
 * Devuelve la duración de la caída para quien quiera calcular su desfase.
 */
function applyFall(el: HTMLElement, layer: FallLayer) {
  el.classList.add('falling-item')

  const size = randomBetween(layer.sizeMin, layer.sizeMax)
  el.style.width = `${size}px`
  el.style.left = `${randomBetween(-10, 110)}%`
  el.style.zIndex = String(layer.zIndex)
  el.style.setProperty('--drift', `${randomBetween(-140, 140).toFixed(1)}px`)
  el.style.setProperty('--rot', `${randomBetween(-540, 540).toFixed(0)}deg`)

  /* Ojo con `opacity`: la animación `falling` también la anima, y una
     animación CSS manda sobre el estilo en línea. Los 0.6 y 0.8 de aquí
     abajo no se aplican mientras cae (medido: 11 de 69 desenfocadas se
     veían por encima de su valor). Por eso la transparencia de la capa
     enfocada va en `filter`, que la animación no toca y que se multiplica
     con el fundido de entrada y salida en vez de pisarlo. */
  if (layer.blur > 0) {
    el.style.filter = `blur(${layer.blur}px)`
    el.style.opacity = layer.zIndex === 5 ? '0.6' : '0.8'
  } else {
    el.style.filter = `opacity(${FOCUSED_OPACITY})`
    el.style.opacity = '1'
  }

  const duration = randomBetween(layer.speedMin, layer.speedMax)
  el.style.animation = `falling ${duration}s linear infinite`
  el.style.animationTimingFunction = pickOne(easingOptions)
  el.style.animationDelay = `-${randomBetween(0, 160)}s`
  return { size, duration }
}

export default function FallingBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const weightedImages = buildWeightedImages()

    layersConfig.forEach((layer) => {
      for (let i = 0; i < layer.count; i += 1) {
        const img = document.createElement('img')
        img.src = pickOne(weightedImages)
        img.onerror = function () {
          this.style.display = 'none'
        }
        applyFall(img, layer)
        container.appendChild(img)
      }
    })

    /* Las bacterias llegan después: el reproductor se carga bajo demanda
       para no engordar la pantalla de login, y el JSON se pide aparte. Si
       algo de eso falla, el fondo se queda como estaba y nadie lo nota. */
    let cancelled = false
    const animations: AnimationItem[] = []
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    void (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import('lottie-web/build/player/lottie_light'),
        fetch(BACTERIA_SRC).then((r) => (r.ok ? r.json() : null)),
      ])
      if (cancelled || !data) return

      layersConfig.forEach((layer) => {
        const bacteriaLayer = {
          ...layer,
          sizeMin: layer.sizeMin * BACTERIA_SCALE,
          sizeMax: layer.sizeMax * BACTERIA_SCALE,
        }
        /* Con tan pocas, un desfase al azar puede dejar las de una capa
           juntas o todas fuera de la pantalla durante medio minuto. Dentro
           de cada capa se reparten a lo largo del recorrido; el punto de
           partida de cada capa sí es al azar, para que no arranquen todas
           arriba a la vez. */
        const layerOffset = Math.random()

        for (let i = 0; i < layer.bacteria; i += 1) {
          const el = document.createElement('div')
          el.setAttribute('aria-hidden', 'true')
          const { size, duration } = applyFall(el, bacteriaLayer)
          el.style.height = `${size}px`

          const phase = (layerOffset + (i + Math.random() * 0.3) / layer.bacteria) % 1
          el.style.animationDelay = `-${(phase * duration).toFixed(2)}s`

          container.appendChild(el)

          const animation = lottie.loadAnimation({
            container: el,
            renderer: 'svg',
            loop: true,
            // Con "reducir movimiento" se queda quieta en su primer fotograma.
            autoplay: !reduceMotion,
            // Una copia por instancia: el reproductor modifica el objeto.
            animationData: structuredClone(data),
            rendererSettings: { viewBoxSize: BACTERIA_VIEWBOX },
          })
          animation.setSpeed(BACTERIA_SPEED)
          animations.push(animation)
        }
      })
    })().catch(() => {})

    return () => {
      cancelled = true
      // destroy() para su bucle de fotogramas; vaciar el contenedor no lo hace.
      animations.forEach((a) => a.destroy())
      container.innerHTML = ''
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full pointer-events-none z-0"
    />
  )
}
