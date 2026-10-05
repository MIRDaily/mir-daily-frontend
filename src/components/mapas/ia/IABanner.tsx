'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Aviso al abrir un mapa recién generado con IA (`?ia=1`). Es un recordatorio de
 * revisar, no un dato del mapa: se quita al cerrarlo o al recargar sin el
 * parámetro. Va en estilos en línea (como el resto del editor) para no
 * depender de que Tailwind regenere clases en caliente.
 */
export default function IABanner() {
  const params = useSearchParams()
  const [cerrado, setCerrado] = useState(false)
  if (params.get('ia') !== '1' || cerrado) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        maxWidth: 'min(560px, calc(100vw - 32px))',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 16,
        background: '#FFF8E6',
        border: '1px solid #F0D9A0',
        boxShadow: '0 6px 20px rgba(44,62,80,0.12)',
        color: '#6B4E0E',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#D9A441' }}>
        auto_awesome
      </span>
      <span>Mapa generado con IA a partir de tu documento. Revisa los datos antes de estudiar con él.</span>
      <button
        type="button"
        onClick={() => setCerrado(true)}
        aria-label="Cerrar aviso"
        style={{ background: 'none', border: 0, cursor: 'pointer', color: '#6B4E0E', padding: 2, display: 'flex' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          close
        </span>
      </button>
    </div>
  )
}
