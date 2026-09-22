import type { Challenge, ProgressResponse } from '@/services/progressService'
import { rankForLevel, xpParaNivel } from '@/lib/levels'

/* ════════════════════════════════════════════════════════════════════════
   Detección de metas cumplidas.

   El backend no manda "has subido de nivel": manda el estado. Así que el
   logro se deduce comparando el estado nuevo con el último que vimos. Eso
   tiene una ventaja que no es menor: no hace falta ningún endpoint nuevo ni
   ninguna tabla de "notificaciones de logro" que mantener sincronizada.

   La referencia anterior se guarda en localStorage y NO en memoria, para que
   un logro conseguido justo antes de recargar no se pierda por el camino.

   ─── CONTRATO COMÚN CON LA APP (lib/core/models/logros.dart) ────────────
   Este fichero y su gemelo de Flutter implementan la misma especificación, y
   los dos deben cambiar a la vez. Salió del incidente del 21/09/2026, cuando
   entrar al perfil disparó varios avisos de subida de nivel seguidos:

   1. REFERENCIA Y COLA POR USUARIO. La clave lleva el id de quien la produjo.
      Antes eran globales: cambiar de cuenta en el mismo navegador celebraba en
      la cuenta nueva los logros de la anterior, y nadie las borraba al salir.
   2. UNA FOTO ANÓMALA NO SE GUARDA NI SE PINTA (ver `fotoAnomala`). Un 200 con
      nivel 1 y cero XP encima de una referencia de nivel 12 no es un dato: es
      el servidor tragándose un error. Tomarlo por bueno era lo que hacía
      volver a celebrar el nivel entero después.
   3. LOS SALTOS SE FUNDEN (ver `fusionarSaltos`). Un usuario no sube dos
      veces: sube UNA VEZ, de un sitio a otro.
   4. EL PERMISO DE CELEBRAR CADUCA. Lo vigila el provider, no este fichero.
   5. LOS DESAFÍOS SE RECUERDAN POR CÓDIGO **Y PERIODO**.
   6. LA REFERENCIA ESTÁ VERSIONADA: una guardada por el código viejo se
      descarta y se vuelve a fotografiar en silencio.
═══════════════════════════════════════════════════════════════════════════ */

/* Cada logro lleva identidad propia. No es burocracia: sin ella, dos avisos
   seguidos comparten clave de React, que reutiliza el nodo y cambia el texto
   sin animar nada. Se veía como si el aviso no tuviera entrada. */
export type Logro = { id: string } & (
  | { tipo: 'rango'; nivel: number; rango: string; color: string; xpAntes: number; xpDespues: number }
  | { tipo: 'nivel'; nivel: number; color: string; xpAntes: number; xpDespues: number }
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
  /** XP acumulado la última vez que se miró. Es el punto de partida de la
      animación de subida: sin él no habría desde dónde contar. */
  xpTotal: number
  racha: number
  /** Desafíos ya celebrados, como `código|periodo` (ver `claveHecho`). */
  hechos: string[]
}

/** Formato de la referencia guardada. Una de otra versión se descarta. */
const VERSION_REFERENCIA = 2

/* Las claves de antes del 21/09/2026: una sola para todo el navegador, sin
   dueño y sin borrarse al cerrar sesión. */
const CLAVE_HEREDADA = 'mirdaily.logros.referencia'
const CLAVE_COLA_HEREDADA = 'mirdaily.logros.pendientes'

const clave = (usuario: string) => `mirdaily.logros.referencia.${usuario}`
const claveCola = (usuario: string) => `mirdaily.logros.pendientes.${usuario}`

// Los hitos de racha se celebran, los días sueltos no: felicitar cada día
// convierte la celebración en ruido y deja de significar nada.
const HITOS_RACHA = [3, 7, 15, 30, 50, 100, 200, 365]

/**
 * Cómo se recuerda que un desafío ya se celebró: código Y periodo.
 *
 * El periodo no es adorno. Con solo el código, "Haz el Daily" se celebraba el
 * primer día y nunca más, porque el código seguía en la lista de hechos. Y si
 * la lista de desafíos llegaba vacía un instante, se volvían a celebrar todos.
 *
 * `periodKey` puede faltar si el backend es anterior a septiembre de 2026; en
 * ese caso se degrada al comportamiento antiguo en vez de romperse.
 */
export function claveHecho(c: Challenge): string {
  return `${c.code}|${c.periodKey ?? ''}`
}

/** Tira las claves globales de antes de que esto fuera por usuario. */
export function purgarSinDuenno() {
  try {
    localStorage.removeItem(CLAVE_HEREDADA)
    localStorage.removeItem(CLAVE_COLA_HEREDADA)
  } catch {
    /* Modo privado: no había nada que purgar. */
  }
}

export function leerReferencia(usuario: string): Referencia | null {
  try {
    const crudo = localStorage.getItem(clave(usuario))
    if (!crudo) return null
    const r = JSON.parse(crudo) as Partial<Referencia> & { v?: number }
    // Una referencia de otra versión no se puede reinterpretar: la v1 guardaba
    // los desafíos sin periodo, y darla por buena celebraría de golpe todos
    // los del día. Se descarta y se vuelve a fotografiar en silencio.
    if (r?.v !== VERSION_REFERENCIA) return null
    if (typeof r?.nivel !== 'number' || typeof r?.racha !== 'number') return null
    return {
      nivel: r.nivel,
      xpTotal: typeof r.xpTotal === 'number' ? r.xpTotal : xpParaNivel(r.nivel),
      racha: r.racha,
      hechos: Array.isArray(r.hechos) ? r.hechos : [],
    }
  } catch {
    return null
  }
}

export function guardarReferencia(usuario: string, ref: Referencia) {
  try {
    localStorage.setItem(clave(usuario), JSON.stringify({ v: VERSION_REFERENCIA, ...ref }))
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

export function leerPendientes(usuario: string): Logro[] {
  try {
    const crudo = localStorage.getItem(claveCola(usuario))
    if (!crudo) return []
    const l = JSON.parse(crudo)
    return Array.isArray(l) ? (l as Logro[]) : []
  } catch {
    return []
  }
}

export function guardarPendientes(usuario: string, logros: Logro[]) {
  try {
    if (logros.length === 0) localStorage.removeItem(claveCola(usuario))
    else localStorage.setItem(claveCola(usuario), JSON.stringify(logros))
  } catch {
    /* Igual que arriba: si no se puede guardar, se celebra en esta sesión y ya. */
  }
}

/** Foto del estado actual, para guardarla como referencia. */
export function referenciaDe(datos: ProgressResponse): Referencia {
  return {
    nivel: datos.progress.level,
    xpTotal: datos.progress.xpTotal,
    racha: datos.progress.currentStreak,
    hechos: [...datos.daily, ...datos.weekly].filter((c) => c.completed).map(claveHecho),
  }
}

/**
 * ¿Esta respuesta puede creerse?
 *
 * Solo se rechaza lo que NO puede ser verdad, no cualquier cosa rara: si el
 * ledger se reconstruye y el nivel baja de verdad, hay que enseñarlo (sin
 * celebrarlo: de eso ya se encarga `detectarLogros`, que solo mira hacia
 * arriba). Lo que se rechaza es la firma exacta de la avería conocida: el
 * fallback que devolvía `/api/progress` cuando el servidor se tragaba un error
 * de Supabase, un 200 con nivel 1, cero XP y sin desafíos.
 *
 * Es indistinguible de un usuario nuevo de verdad MIRANDO SOLO la respuesta.
 * Por eso hace falta la referencia: quien ayer iba por el nivel 12 no amanece
 * en el 1.
 */
export function fotoAnomala(ref: Referencia | null, datos: ProgressResponse): boolean {
  // Sin referencia no hay con qué comparar: es la primera vez que se ve a esta
  // cuenta y nivel 1 con cero XP es exactamente lo que le toca.
  if (!ref) return false

  const p = datos.progress
  if (!p || typeof p.level !== 'number' || typeof p.xpTotal !== 'number') return true

  if (p.level <= 1 && p.xpTotal <= 0 && (ref.nivel > 1 || ref.xpTotal > 0)) return true

  // Los desafíos desaparecidos: tenía alguno hecho y ahora no llega ni la
  // lista. Guardar esa foto vaciaría `hechos` y al volver la lista se
  // celebrarían todos otra vez.
  const todos = [...(datos.daily ?? []), ...(datos.weekly ?? [])]
  if (todos.length === 0 && ref.hechos.length > 0) return true

  return false
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
    // El tramo que recorrerá la barra. Se protege de un XP anterior mayor que
    // el nuevo (una reconstrucción del ledger) arrancando, como mucho, al
    // principio del nivel de partida.
    const xpAntes = Math.min(ref.xpTotal, datos.progress.xpTotal)
    const xpDespues = datos.progress.xpTotal
    // Cambiar de rango pesa más que subir un nivel, así que se anuncia como
    // rango y no se duplica el aviso.
    if (rangoNuevo.name !== rangoViejo.name) {
      out.push({
        id: nuevoId(),
        tipo: 'rango',
        nivel: level,
        rango: rangoNuevo.name,
        color: rangoNuevo.color,
        xpAntes,
        xpDespues,
      })
    } else {
      out.push({
        id: nuevoId(),
        tipo: 'nivel',
        nivel: level,
        color: rangoNuevo.color,
        xpAntes,
        xpDespues,
      })
    }
  }

  if (currentStreak > ref.racha && HITOS_RACHA.includes(currentStreak)) {
    out.push({ id: nuevoId(), tipo: 'racha', dias: currentStreak })
  }

  const yaVistos = new Set(ref.hechos)
  for (const c of [...datos.daily, ...datos.weekly]) {
    if (c.completed && !yaVistos.has(claveHecho(c))) {
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

/**
 * Deja UN solo salto de nivel en la cola, del principio del primero al final
 * del último.
 *
 * La referencia avanza en cuanto se detecta el logro, así que cada recarga
 * solo ve SU trocito: recargar tres veces mientras se sube del 9 al 12
 * encolaba "Nivel 10", "Nivel 11" y "Nivel 12", tres modales seguidos para una
 * sola subida. Y al usar la web y la app a la vez pasa constantemente, porque
 * cada una lleva su propia referencia.
 *
 * Conserva el id del primero a propósito: si el modal ya está en pantalla,
 * cambiar el id cambiaría su `key` y React lo remontaría a mitad de animación.
 */
export function fusionarSaltos(cola: Logro[]): Logro[] {
  const out: Logro[] = []
  let indiceSalto = -1

  for (const l of cola) {
    if (l.tipo !== 'nivel' && l.tipo !== 'rango') {
      out.push(l)
      continue
    }
    if (indiceSalto < 0) {
      indiceSalto = out.length
      out.push(l)
      continue
    }
    out[indiceSalto] = fundir(
      out[indiceSalto] as Extract<Logro, { tipo: 'nivel' | 'rango' }>,
      l,
    )
  }

  return out
}

type Salto = Extract<Logro, { tipo: 'nivel' | 'rango' }>

function fundir(a: Salto, b: Salto): Salto {
  const nivel = Math.max(a.nivel, b.nivel)
  const rango = rankForLevel(nivel)
  // Si CUALQUIERA de los peldaños cruzó un rango, el tramo entero lo cruzó.
  const esRango = a.tipo === 'rango' || b.tipo === 'rango'

  // Un `xpAntes` a cero es "no se sabe", no "empezó de cero": tomarlo por el
  // mínimo mandaría la barra al principio de la curva.
  const candidatos = [a.xpAntes, b.xpAntes].filter((x) => x > 0)
  const xpAntes = candidatos.length === 0 ? 0 : Math.min(...candidatos)
  const xpDespues = Math.max(a.xpDespues, b.xpDespues)

  return esRango
    ? { id: a.id, tipo: 'rango', nivel, rango: rango.name, color: rango.color, xpAntes, xpDespues }
    : { id: a.id, tipo: 'nivel', nivel, color: rango.color, xpAntes, xpDespues }
}

/** El más importante manda: es el que da titular a la celebración. */
const PESO: Record<Logro['tipo'], number> = { rango: 4, nivel: 3, racha: 2, desafio: 1 }

export function ordenarPorPeso(logros: Logro[]): Logro[] {
  return [...logros].sort((a, b) => PESO[b.tipo] - PESO[a.tipo])
}
