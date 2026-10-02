'use client'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Analítica de visitas y rendimiento de Vercel: sin cookies y agregada
// (descrita en /privacidad). Lo que no sirva para medir no sale de aquí.
const RUTAS_SIN_MEDIR = ['/admin']

function limpiarUrl(url: string): string | null {
  const u = new URL(url)
  if (RUTAS_SIN_MEDIR.some((r) => u.pathname === r || u.pathname.startsWith(`${r}/`))) return null
  // Solo se conservan los utm_* (procedencia); el resto de parámetros puede
  // llevar códigos de login o datos de la sesión.
  for (const clave of [...u.searchParams.keys()]) {
    if (!clave.startsWith('utm_')) u.searchParams.delete(clave)
  }
  u.hash = ''
  return u.toString()
}

function beforeSend<T extends { url: string }>(event: T): T | null {
  const url = limpiarUrl(event.url)
  return url ? { ...event, url } : null
}

export default function WebAnalytics() {
  return (
    <>
      <Analytics beforeSend={beforeSend} />
      <SpeedInsights beforeSend={beforeSend} />
    </>
  )
}
