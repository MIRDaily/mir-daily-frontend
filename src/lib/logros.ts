import type { ProgressResponse } from '@/services/progressService'
import { rankForLevel } from '@/lib/levels'

/* ════════════════════════════════════════════════════════════════════════
   Detección de metas cumplidas.

   El backend no manda "has subido de nivel": manda el estado. Así que el
   logro se deduce comparando el estado nuevo con el último que vimos. Eso
   tiene una ventaja que no es menor: no hace falta ningún endpoint nuevo ni
   ninguna tabla de "notificaciones de logro" que mantener sincronizada.

   La referencia anterior se guarda en localStorage y NO en memoria, para que
   un logro conseguido justo antes de recargar no se pierda por el camino.
═══════════════════════════════════════════════════════════════════════════ */

/* Cada logro lleva identidad propia. No es burocracia: sin ella, dos avisos
   seguidos comparten clave de React, que reutiliza el nodo y cambia el texto
   sin animar nada. Se veía como si el aviso no tuviera entrada. */
export type Logro = { id: string } & (
  | { tipo: 'rango'; nivel: number; rango: string; color: string }
  | { tipo: 'nivel'; nivel: number; color: string }
  | { tipo: 'racha'; dias: number }
  | { tipo: 'desafio'; titulo: string; xp: number; scope: 'daily' | 'weekly' }
)

let contador = 0
/** Identificador único dentro de la pestaña. */
export function nuevoId(): string {
  contador += 1
  return `${Date.now().toString(36)}-${contador}`
}

/** Lo que hay que recordar entre visitas para poder comparar. */
export type Referencia = {
  nivel: number
  racha: number
  /** Códigos de desafío ya completados, por periodo, para no repetir el aviso. */
  hechos: string[]
}

const CLAVE = 'mirdaily.logros.referencia'
const CLAVE_COLA = 'mirdaily.logros.pendientes'

// Los hitos de racha se celebran, los días sueltos no: felicitar cada día
// convierte la celebración en ruido y deja de significar nada.
const HITOS_RACHA = [3, 7, 15, 30, 50, 100, 200, 365]

export function leerReferencia(): Referencia | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const r = JSON.parse(crudo) as Partial<Referencia>
    if (typeof r?.nivel !== 'number' || typeof r?.racha !== 'number') return null
    return { nivel: r.nivel, racha: r.racha, hechos: Array.isArray(r.hechos) ? r.hechos : [] }
  } catch {
    return null
  }
}

export function guardarReferencia(ref: Referencia) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ref))
  } catch {
    /* Modo privado: se pierde la referencia entre recargas y como mucho se
       deja de celebrar algo. Nunca al revés. */
  }
}

/* ─── La cola de pendientes también se guarda ─────────────────────────────
   Y no es un detalle. La referencia avanza en cuanto se detecta el logro, así
   que si la cola viviera solo en memoria, subir de nivel y recargar la página
   antes de verlo haría desaparecer el logro para siempre: la comparación
   siguiente ya no encontraría diferencia. Se descubrió en la primera prueba,
   navegando entre pantallas con recarga completa. */

export function leerPendientes(): Logro[] {
  try {
    const crudo = localStorage.getItem(CLAVE_COLA)
    if (!crudo) return []
    const l = JSON.parse(crudo)
    return Array.isArray(l) ? (l as Logro[]) : []
  } catch {
    return []
  }
}

export function guardarPendientes(logros: Logro[]) {
  try {
    if (logros.length === 0) localStorage.removeItem(CLAVE_COLA)
    else localStorage.setItem(CLAVE_COLA, JSON.stringify(logros))
  } catch {
    /* Igual que arriba: si no se puede guardar, se celebra en esta sesión y ya. */
  }
}

/** Foto del estado actual, para guardarla como referencia. */
export function referenciaDe(datos: ProgressResponse): Referencia {
  return {
    nivel: datos.progress.level,
    racha: datos.progress.currentStreak,
    hechos: [...datos.daily, ...datos.weekly].filter((c) => c.completed).map((c) => c.code),
  }
}

/**
 * Qué ha cambiado a mejor entre la referencia y el estado nuevo.
 *
 * Solo mira hacia arriba: si el nivel baja (una reconstrucción del ledger, por
 * ejemplo) no se celebra nada, faltaría más.
 */
export function detectarLogros(ref: Referencia, datos: ProgressResponse): Logro[] {
  const out: Logro[] = []
  const { level, currentStreak } = datos.progress

  if (level > ref.nivel) {
    const rangoNuevo = rankForLevel(level)
    const rangoViejo = rankForLevel(ref.nivel)
    // Cambiar de rango pesa más que subir un nivel, así que se anuncia como
    // rango y no se duplica el aviso.
    if (rangoNuevo.name !== rangoViejo.name) {
      out.push({
        id: nuevoId(),
        tipo: 'rango',
        nivel: level,
        rango: rangoNuevo.name,
        color: rangoNuevo.color,
      })
    } else {
      out.push({ id: nuevoId(), tipo: 'nivel', nivel: level, color: rangoNuevo.color })
    }
  }

  if (currentStreak > ref.racha && HITOS_RACHA.includes(currentStreak)) {
    out.push({ id: nuevoId(), tipo: 'racha', dias: currentStreak })
  }

  const yaVistos = new Set(ref.hechos)
  for (const c of [...datos.daily, ...datos.weekly]) {
    if (c.completed && !yaVistos.has(c.code)) {
      out.push({
        id: nuevoId(),
        tipo: 'desafio',
        titulo: c.title,
        xp: c.xpReward,
        scope: c.scope,
      })
    }
  }

  return out
}

/** El más importante manda: es el que da titular a la celebración. */
const PESO: Record<Logro['tipo'], number> = { rango: 4, nivel: 3, racha: 2, desafio: 1 }

export function ordenarPorPeso(logros: Logro[]): Logro[] {
  return [...logros].sort((a, b) => PESO[b.tipo] - PESO[a.tipo])
}
