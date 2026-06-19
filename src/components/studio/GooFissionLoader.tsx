import { useId } from 'react'

type GooFissionLoaderProps = {
  size?: number
  label?: string
  className?: string
  showGlow?: boolean
}

export default function GooFissionLoader({
  size = 220,
  label = 'Cargando',
  className = '',
  showGlow = true,
}: GooFissionLoaderProps) {
  const rawId = useId()
  const safeId = rawId.replace(/:/g, '')
  const filterId = `goo-fission-${safeId}`

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {showGlow ? (
        <>
          <div
            className="pointer-events-none absolute h-80 w-80 rounded-full blur-3xl"
            style={{ backgroundColor: '#E8A598', opacity: 0.24 }}
          />
          <div
            className="pointer-events-none absolute h-64 w-64 rounded-full blur-2xl"
            style={{ backgroundColor: '#E8A598', opacity: 0.18 }}
          />
        </>
      ) : null}

      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 200 200">
        <defs>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%">
            <feTurbulence baseFrequency=".016" numOctaves="2" result="n">
              <animate attributeName="seed" values="8;48;8" dur="10s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="12" result="w" />
            <feGaussianBlur in="w" stdDeviation="11" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 26 -12"
            />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <circle cx="100" cy="100" r="28" fill="#E8A598">
            <animate
              attributeName="cx"
              values="100;72;100;128;100"
              dur="4s"
              calcMode="spline"
              keySplines=".6 0 .4 1;.6 0 .4 1;.6 0 .4 1;.6 0 .4 1"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="100;90;100;90;100"
              dur="4s"
              calcMode="spline"
              keySplines=".6 0 .4 1;.6 0 .4 1;.6 0 .4 1;.6 0 .4 1"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="100" cy="100" r="28" fill="#E8A598">
            <animate
              attributeName="cx"
              values="100;128;100;72;100"
              dur="4s"
              calcMode="spline"
              keySplines=".6 0 .4 1;.6 0 .4 1;.6 0 .4 1;.6 0 .4 1"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="100;110;100;110;100"
              dur="4s"
              calcMode="spline"
              keySplines=".6 0 .4 1;.6 0 .4 1;.6 0 .4 1;.6 0 .4 1"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>

      <span className="sr-only">{label}</span>
    </div>
  )
}
