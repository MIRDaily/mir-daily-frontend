'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  asegurarCreditos,
  estadoCreditos,
  estadoCreditosServidor,
  refrescarCreditos,
  suscribirCreditos,
  type EstadoCreditos,
} from '@/lib/ia/creditos'

/**
 * Saldo y tarifa de los créditos de IA, compartidos por todos los diálogos (un solo pedido). Se
 * refresca tras cada generación con `refrescar()`. Con los créditos apagados en el servidor,
 * `activo` es false y los diálogos siguen con el cupo de hoy. El objeto es estable mientras no
 * cambie el estado (se puede usar en dependencias de efectos).
 */
export function useCreditosIA(): EstadoCreditos & { refrescar: () => Promise<void> } {
  const e = useSyncExternalStore(suscribirCreditos, estadoCreditos, estadoCreditosServidor)
  useEffect(() => {
    asegurarCreditos()
  }, [])
  return useMemo(() => ({ ...e, refrescar: refrescarCreditos }), [e])
}

/** Lo que un diálogo necesita del precio: si se puede pagar y qué decir si no. */
export function useCobroIA(precio: number | null) {
  const c = useCreditosIA()
  const total = c.saldo?.total ?? 0
  const ilimitado = !!c.saldo?.ilimitado
  // Mientras no se sabe (o sin créditos), no se bloquea nada: decide el servidor.
  const suficiente = !c.activo || precio === null || ilimitado || precio <= total
  const sinPlan = c.activo && !!c.saldo && !c.saldo.puede_usar
  return {
    creditos: c,
    activo: c.activo,
    suficiente: suficiente && !sinPlan,
    sinPlan,
    falta: !c.activo ? undefined : sinPlan ? 'Necesitas un plan con IA.' : !suficiente ? 'No te quedan créditos suficientes.' : undefined,
  }
}
