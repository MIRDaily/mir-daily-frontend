'use client'

import { useId } from 'react'

const INK = '#2C3E50'

// La moneda de los créditos de IA: la cabeza del fago (el icosaedro de la mascota) acuñada en oro.
// Con profundidad, como las tarjetas del kit «sticker»: borde de tinta, el canto de la moneda asomando
// por debajo y una sombra dura desplazada.
// La misma figura está en public/brand/moneda-ia.svg (para usarla fuera de React). Por debajo de
// 1,4 rem se quitan la carita y el destello: a ese tamaño solo ensucian.

export function MonedaIA({ tam = '1.25rem', cara, className = '', titulo }: { tam?: string | number; cara?: boolean; className?: string; titulo?: string }) {
  const id = useId().replace(/:/g, '')
  const px = typeof tam === 'number' ? tam : tam.endsWith('rem') ? parseFloat(tam) * 16 : parseFloat(tam)
  const conCara = cara ?? px >= 22
  return (
    <svg
      viewBox="0 0 67 67"
      width={tam}
      height={tam}
      className={`inline-block shrink-0 ${className}`}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE68F" />
          <stop offset="0.55" stopColor="#E9AE2E" />
          <stop offset="1" stopColor="#B37310" />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF4C4" />
          <stop offset="0.45" stopColor="#F8CD52" />
          <stop offset="0.85" stopColor="#E2A52A" />
          <stop offset="1" stopColor="#C58615" />
        </radialGradient>
      </defs>
      {/* Sombra dura (como las tarjetas) y el canto, que asoma por debajo de la cara. */}
      <circle cx="34.4" cy="36" r="30" fill={INK} />
      <circle cx="32" cy="34.4" r="30" fill="#B37310" stroke={INK} strokeWidth="2" />
      <circle cx="32" cy="32" r="30" fill={`url(#${id}c)`} stroke={INK} strokeWidth="2" />
      {px >= 22 && <circle cx="32" cy="32" r="27.6" fill="none" stroke="#9A6508" strokeWidth="1.6" strokeDasharray="1.1 1.7" opacity="0.55" />}
      <circle cx="32" cy="32" r="25.4" fill={`url(#${id}f)`} stroke="#A86F0C" strokeWidth="1.2" />
      <g strokeLinejoin="round">
        <polygon points="32,16.5 19,24 30.5,30" fill="#FFE99E" />
        <polygon points="32,16.5 45,24 30.5,30" fill="#FFD866" />
        <polygon points="45,24 45,39 30.5,30" fill="#F1B53A" />
        <polygon points="45,39 32,46.5 30.5,30" fill="#D8961F" />
        <polygon points="32,46.5 19,39 30.5,30" fill="#E6A82D" />
        <polygon points="19,39 19,24 30.5,30" fill="#FBCF63" />
        {px >= 22 && (
          <path d="M30.5 30 L32 16.5 M30.5 30 L45 24 M30.5 30 L45 39 M30.5 30 L32 46.5 M30.5 30 L19 39 M30.5 30 L19 24" stroke="#C08214" strokeWidth="0.6" opacity="0.7" fill="none" />
        )}
        <polygon points="32,16.5 45,24 45,39 32,46.5 19,39 19,24" fill="none" stroke="#7A4E05" strokeWidth={px >= 22 ? 1.7 : 2.4} />
      </g>
      <path d="M23.6 23.6 L28.4 20.9" stroke="#FFFBEA" strokeWidth="2" strokeLinecap="round" />
      {conCara && (
        <g>
          <ellipse cx="27.6" cy="33" rx="1.55" ry="1.95" fill="#5A3602" />
          <ellipse cx="35.4" cy="33" rx="1.55" ry="1.95" fill="#5A3602" />
          <circle cx="28.1" cy="32.3" r="0.5" fill="#FFF6D6" />
          <circle cx="35.9" cy="32.3" r="0.5" fill="#FFF6D6" />
          <path d="M29.2 37.2 Q31.5 39.3 33.8 37.2" fill="none" stroke="#5A3602" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      )}
      {conCara && <path d="M50 11.5 L51 14.5 L54 15.5 L51 16.5 L50 19.5 L49 16.5 L46 15.5 L49 14.5 Z" fill="#FFF6CF" stroke="#C88A12" strokeWidth="0.5" />}
    </svg>
  )
}
