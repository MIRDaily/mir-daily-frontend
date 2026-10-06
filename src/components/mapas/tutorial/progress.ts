// Progreso del tutorial interactivo de mapas: qué lecciones se han completado en este navegador.
// Es solo para enseñar "3 de 10" y marcar las hechas; no es un dato de la cuenta (el "ya te he
// invitado" sí lo es, y va por tutorials_seen con la clave mapas.vN).

const PROGRESS_KEY = 'mapas.tutorial.hechas'

/** Ids de las lecciones (lessons.ts), en orden. Aquí sueltos para no cargar el guion en la lista de
 *  mapas; una prueba vigila que coincidan. */
export const LESSON_IDS = [
  'bienvenida',
  'raton',
  'crear',
  'moverse',
  'plegar',
  'mover',
  'cambiar-rama',
  'buscar',
  'estilo',
  'panel',
  'lineas',
  'tablas',
  'ordenar',
  'exportar',
  'fin',
] as const

export const TOTAL_LESSONS = LESSON_IDS.length

/** Primera lección sin hacer (para "Seguir"); si están todas, la primera. */
export function firstPendingLesson(done: string[]): number {
  const i = LESSON_IDS.findIndex((id) => !done.includes(id))
  return i === -1 ? 0 : i
}

export function readLessonsDone(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function writeLessonsDone(ids: string[]) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    /* sin almacenamiento: el progreso dura lo que la pestaña */
  }
}
