'use client'

import type { ReactNode } from 'react'
import { useProgressContext } from '@/providers/ProgressProvider'
import { rankForLevel } from '@/lib/levels'

/* ════════════════════════════════════════════════════════════════════════
   El nivel, montado sobre el avatar de la cabecera.

   Antes vivía en un botón propio, que competía por sitio con las
   notificaciones y con la racha. Aquí gana dos cosas: deja de ocupar un hueco
   en una barra ya llena, y pega el nivel a la identidad del usuario, que es
   justo lo que un rango significa.

   El aro es el avance dentro del nivel actual. Va como conic-gradient sobre el
   contenedor y no como SVG: es un aro de 2,5 px, no necesita más.

   El avatar se encoge para que el aro quepa DENTRO de los 40 px que ya ocupaba,
   en vez de crecer por fuera: si creciera, subiría el alto de toda la cabecera.
═══════════════════════════════════════════════════════════════════════════ */

export default function AvatarLevelRing({ children }: { children: ReactNode }) {
  const { data } = useProgressContext()
  const progress = data?.progress

  // Sin progreso (sesión recién abierta, o error) el avatar se pinta tal cual:
  // mejor sin aro que con un aro a cero, que se leería como "vas por 0".
  if (!progress) {
    return <div className="size-10 overflow-hidden rounded-full">{children}</div>
  }

  const rank = rankForLevel(progress.level)
  const pct = Math.max(
    0,
    Math.min(100, Math.round((progress.xpIntoLevel / Math.max(1, progress.xpForNext)) * 100)),
  )

  const restante = Math.max(0, progress.xpForNext - progress.xpIntoLevel)
  const titulo =
    progress.level >= progress.maxLevel
      ? `${rank.name} · nivel máximo`
      : `${rank.name} · nivel ${progress.level} · ${restante} XP para el ${progress.level + 1}`

  return (
    <div className="relative size-10 shrink-0" title={titulo}>
      <div
        className="size-10 rounded-full p-[2.5px]"
        style={{
          background: `conic-gradient(${rank.color} ${pct * 3.6}deg, #EAE4E2 ${pct * 3.6}deg)`,
        }}
      >
        <div className="size-full overflow-hidden rounded-full bg-white p-[1.5px]">
          <div className="size-full overflow-hidden rounded-full">{children}</div>
        </div>
      </div>

      {/* El número, pegado al aro. Con borde blanco para que se despegue tanto
          del avatar como del aro, sea cual sea el color del rango. */}
      <span
        className="absolute -bottom-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white px-[3px] text-[10px] font-black leading-none text-white"
        style={{ backgroundColor: rank.color }}
      >
        {progress.level}
      </span>
    </div>
  )
}
