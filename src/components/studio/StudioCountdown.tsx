'use client'

import { useSyncExternalStore } from 'react'
import { NEXT_MIR_DATE, VISPERA_MIR } from '@/lib/examDate'

/* ════════════════════════════════════════════════════════════════════════
   Los días que quedan para el MIR, junto al buscador y el calendario.

   La fecha sale de `examDate.ts`, la misma de la que beben el botón de
   calendario y la landing: una sola fuente, y así las tres no pueden decir
   cosas distintas.

   Cuenta hasta la VÍSPERA, no hasta el examen: el último día que se puede
   estudiar es el de antes, y así no aparece «queda 1 día» la mañana del
   propio examen. El rótulo lo dice, para que nadie tenga que deducirlo.
═══════════════════════════════════════════════════════════════════════════ */

const UN_DIA = 86_400_000

function diasQueFaltan(): number {
  return Math.max(0, Math.ceil((VISPERA_MIR.getTime() - Date.now()) / UN_DIA))
}

/* El valor se lee SOLO en el navegador.

   Calcularlo durante el render del servidor es pedir un desajuste de
   hidratación: el servidor pinta con su reloj y el navegador con el suyo, y
   basta con que el render caiga a caballo de la medianoche para que salgan
   números distintos. `useSyncExternalStore` con instantánea de servidor
   `null` es la forma de React de decir "esto es del cliente"; el `subscribe`
   está vacío porque no hay nada a lo que suscribirse: no cambia mientras la
   pantalla está abierta.

   Y evita el `setState` dentro de un efecto, que en este proyecto es un
   error de lint, no un aviso. */
const SIN_SUSCRIPCION = () => () => {}

export default function StudioCountdown() {
  const dias = useSyncExternalStore(SIN_SUSCRIPCION, diasQueFaltan, () => null)

  const fecha = NEXT_MIR_DATE.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      title={`MIR: ${fecha}. La cuenta termina la víspera.`}
      aria-label={dias === null ? undefined : `Quedan ${dias} días para la víspera del MIR`}
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-white bg-white/90 px-3.5 shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)]"
    >
      {/* El icono va envuelto: el `display` propio de Material Symbols pisa
          al `flex` de Tailwind si se le cuelgan las clases directamente. */}
      {/* `aria-hidden`: Material Symbols dibuja el icono a partir del
          texto de la ligadura, asi que sin esto un lector de pantalla lee
          literalmente "hourglass_top". El rotulo bueno va en el
          `aria-label` del contenedor. */}
      <span aria-hidden className="flex items-center text-[#d18d80]">
        <span className="material-symbols-outlined text-[18px] leading-none">hourglass_top</span>
      </span>

      {/* Ancho reservado aunque todavía no haya número: si no, el resto de la
          cabecera pega un salto en cuanto hidrata. `tabular-nums` para que no
          baile al pasar de 130 a 129. */}
      <span className="min-w-[4.5ch] text-sm font-black leading-none tabular-nums text-[#2c3e50]">
        {dias ?? ' '}
      </span>
      <span className="text-[11px] font-semibold leading-none text-[#7D8A96]">días</span>
    </div>
  )
}
