'use client'

import { useEffect, useRef, useState } from 'react'

type TrashTimerProps = {
  purgeAt?: string | null
  onExpire?: () => void
}

function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'Expirada'

  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000))
  if (totalMinutes <= 0) return 'Expira en <1m'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `Expira en ${hours}h ${minutes}m`
}

export default function TrashTimer({ purgeAt, onExpire }: TrashTimerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const notifiedRef = useRef(false)
  const purgeMs = Date.parse(purgeAt ?? '')
  const isPurgeValid = Number.isFinite(purgeMs)
  const remainingMs = isPurgeValid ? purgeMs - nowMs : 0

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!onExpire || !isPurgeValid || remainingMs > 0 || notifiedRef.current) return
    notifiedRef.current = true
    onExpire()
  }, [isPurgeValid, onExpire, remainingMs])

  if (!isPurgeValid) {
    return <span className="text-xs text-slate-500">Expiracion no disponible</span>
  }

  return <span className="text-xs text-slate-500">{formatRemaining(remainingMs)}</span>
}

