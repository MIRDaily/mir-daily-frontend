import Link from 'next/link'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'

/**
 * Lo único que queda de la cabecera de la web dentro del editor: el logo y el nombre,
 * en una esquina, como salida al resto de MIRDaily. Sin fondo ni barra: que no estorbe.
 */
export function BrandCorner() {
  const t = useTheme()
  return (
    <Link
      href="/dashboard"
      title="Ir a MIRDaily"
      aria-label="MIRDaily"
      className="mapa-brand"
      style={{
        position: 'absolute',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 10,
        textDecoration: 'none',
        transition: 'opacity 200ms ease',
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 48 48"
        fill={t.accent}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" />
      </svg>
      <span
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: t.textSecondary,
          transition: 'color 400ms ease',
        }}
      >
        MIR<span style={{ color: t.accent }}>Daily</span>
      </span>
    </Link>
  )
}
