/**
 * Rangos del sistema de niveles.
 *
 * El nombre importa tanto como el número: "Nivel 22" no dice nada, "R1" sitúa
 * al usuario en una carrera que ya conoce y que es exactamente la que está
 * preparando. Es gratis y hace mucho más por la motivación que la cifra.
 *
 * OJO: esto es un rótulo de constancia, no de conocimiento. El nivel dice
 * cuántos días has aparecido; el porcentaje de precisión del panel dice si vas
 * a aprobar. No deben mezclarse nunca en la misma tarjeta.
 *
 * Reparto sobre 100 niveles (el tope subió de 50 a 100 el 07-09-2026):
 * los cuatro primeros rangos se agolpan en las tres primeras semanas, que es
 * el onboarding, y la residencia (R1-R5) ocupa del 20 al 70, que es el grueso
 * del camino. Para un usuario normal eso es un rango nuevo cada dos o tres
 * meses en la parte media, y varios en los primeros días.
 */

export type Rank = {
  name: string
  minLevel: number
  /** Color del texto y del anillo */
  color: string
  /** Fondo suave a juego */
  soft: string
}

export const MAX_LEVEL = 100

export const RANKS: ReadonlyArray<Rank> = [
  { name: 'Novato',             minLevel: 1,   color: '#7D8A96', soft: '#7D8A96' },
  { name: 'Estudiante',         minLevel: 6,   color: '#6E8CA0', soft: '#6E8CA0' },
  { name: 'Graduado',           minLevel: 12,  color: '#5E9AA8', soft: '#5E9AA8' },
  { name: 'Residente R1',       minLevel: 20,  color: '#8BA888', soft: '#8BA888' },
  { name: 'Residente R2',       minLevel: 30,  color: '#7EA57A', soft: '#7EA57A' },
  { name: 'Residente R3',       minLevel: 40,  color: '#6E9B6B', soft: '#6E9B6B' },
  { name: 'Residente R4',       minLevel: 50,  color: '#C9A227', soft: '#C9A227' },
  { name: 'Residente R5',       minLevel: 60,  color: '#D18D80', soft: '#D18D80' },
  { name: 'Jefe de residentes', minLevel: 70,  color: '#C4655A', soft: '#C4655A' },
  { name: 'Adjunto',            minLevel: 80,  color: '#A8524F', soft: '#A8524F' },
  { name: 'Jefe de sección',    minLevel: 90,  color: '#7C4A63', soft: '#7C4A63' },
  { name: 'Jefe de servicio',   minLevel: 100, color: '#2c3e50', soft: '#2c3e50' },
] as const

export function rankForLevel(level: number): Rank {
  let found = RANKS[0]
  for (const r of RANKS) {
    if (level >= r.minLevel) found = r
  }
  return found
}

/** Siguiente rango, o null si ya está en el último. */
export function nextRank(level: number): Rank | null {
  return RANKS.find((r) => r.minLevel > level) ?? null
}
