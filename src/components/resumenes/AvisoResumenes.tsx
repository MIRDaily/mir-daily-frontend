'use client'

// «Tienes N párrafos para repasar»: el aviso de los resúmenes activos en Studio y en el Panel. Una
// sola petición agregada (GET /api/resumenes/prevision: la base de datos cuenta, sin el corte de 1000
// filas). No sale si no hay nada que repasar, ni sin sesión, ni si falla (un aviso no rompe la página).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cargarPrevision } from '@/lib/resumenes/previsionApi'
import { textoAviso, type Prevision } from '@/lib/resumenes/prevision'
import { GRIS_AA } from '@/lib/resumenes/accesible'
import { INK } from './ui'

export function AvisoResumenes({ className = '' }: { className?: string }) {
  const [p, setP] = useState<Prevision | null>(null)

  useEffect(() => {
    let vivo = true
    cargarPrevision()
      .then((x) => vivo && setP(x))
      .catch(() => {
        /* el aviso es un extra: sin él la página sigue igual */
      })
    return () => {
      vivo = false
    }
  }, [])

  const aviso = p ? textoAviso(p) : null
  if (!aviso) return null

  return (
    <Link
      href="/resumenes"
      className={`group flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 py-3 transition-transform hover:-translate-y-0.5 ${className}`}
      style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
      data-aviso-resumenes={p?.pendientes}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBEDEA]" style={{ border: `2px solid ${INK}` }} aria-hidden>
        <span className="material-symbols-outlined text-[24px] text-[#B04A5E]">text_snippet</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black leading-tight text-[#2C3E50]">{aviso.titulo}</span>
        <span className="block text-xs" style={{ color: GRIS_AA }}>
          {aviso.detalle}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-extrabold text-[#2C3E50] sm:flex">
        Repasar
        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-0.5" aria-hidden>
          arrow_forward
        </span>
      </span>
    </Link>
  )
}
