'use client'

import { useEffect, useRef } from 'react'

const sourceConfig = [
  { src: '/img/2.png', weight: 60 },
  { src: '/img/1.png', weight: 30 },
  { src: '/img/3.png', weight: 10 },
]

const layersConfig = [
  { count: 1, sizeMin: 350, sizeMax: 500, blur: 10, speedMin: 12, speedMax: 18, zIndex: 5 },
  { count: 3, sizeMin: 200, sizeMax: 300, blur: 5, speedMin: 20, speedMax: 30, zIndex: 4 },
  { count: 15, sizeMin: 120, sizeMax: 180, blur: 0, speedMin: 35, speedMax: 50, zIndex: 3 },
  { count: 25, sizeMin: 70, sizeMax: 110, blur: 3, speedMin: 55, speedMax: 75, zIndex: 2 },
  { count: 40, sizeMin: 30, sizeMax: 60, blur: 6, speedMin: 80, speedMax: 120, zIndex: 1 },
]

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min

const buildWeightedImages = () => {
  const weighted: string[] = []
  sourceConfig.forEach((item) => {
    for (let k = 0; k < item.weight; k += 1) {
      weighted.push(item.src)
    }
  })
  return weighted
}

export default function FallingBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const weightedImages = buildWeightedImages()
    const easingOptions = [
      'linear',
      'cubic-bezier(0.2,0.6,0.3,1)',
      'cubic-bezier(0.4,0.0,0.2,1)',
      'cubic-bezier(0.25,0.8,0.25,1)',
    ]

    layersConfig.forEach((layer) => {
      for (let i = 0; i < layer.count; i += 1) {
        const img = document.createElement('img')
        const randomSrc =
          weightedImages[
            Math.floor(Math.random() * weightedImages.length)
          ]
        img.src = randomSrc
        img.classList.add('falling-item')
        img.onerror = function () {
          this.style.display = 'none'
        }

        const size = randomBetween(layer.sizeMin, layer.sizeMax)
        img.style.width = `${size}px`
        img.style.left = `${randomBetween(-10, 110)}%`
        img.style.zIndex = String(layer.zIndex)
        img.style.setProperty(
          '--drift',
          `${randomBetween(-140, 140).toFixed(1)}px`
        )
        img.style.setProperty(
          '--rot',
          `${randomBetween(-540, 540).toFixed(0)}deg`
        )

        if (layer.blur > 0) {
          img.style.filter = `blur(${layer.blur}px)`
          img.style.opacity = layer.zIndex === 5 ? '0.6' : '0.8'
        } else {
          img.style.filter = 'none'
          img.style.opacity = '1'
        }

        const duration = randomBetween(layer.speedMin, layer.speedMax)
        img.style.animation = `falling ${duration}s linear infinite`
        img.style.animationTimingFunction =
          easingOptions[
            Math.floor(Math.random() * easingOptions.length)
          ]
        img.style.animationDelay = `-${randomBetween(0, 160)}s`

        container.appendChild(img)
      }
    })

    return () => {
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
