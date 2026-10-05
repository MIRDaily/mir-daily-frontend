// Tipos de la IA de mapas (documento → mapa). El texto se extrae EN EL
// NAVEGADOR: el archivo nunca se sube; al servidor solo viaja el texto.

export type Seccion = { titulo?: string; texto: string }

export type Extraido = {
  /** Título propuesto (metadatos o nombre del archivo). */
  titulo: string
  secciones: Seccion[]
  paginas: number
  caracteres: number
  /** Cosas que el usuario debería saber (p. ej. se dejó de leer por el tope). */
  avisos: string[]
  /** Se dejó de leer al llegar al tope de lectura. */
  truncado: boolean
}

export type ModoIA = 'esquema' | 'detalle'

export type EstadoIA = {
  disponible: boolean
  modos: ModoIA[]
  limites: { maxChars: number; maxPaginas: number }
  cupo: {
    generacionesHoy: number
    maxGeneracionesDia: number
    caracteresHoy: number
    maxCaracteresDia: number
  }
}

/** Error con mensaje listo para enseñar al usuario. */
export class ExtractError extends Error {}

export class IAError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly codigo = '',
  ) {
    super(message)
  }
}

/** Tamaño máximo de archivo que se intenta leer (protege la memoria de la pestaña). */
export const MAX_ARCHIVO_BYTES = 30_000_000

/** Se deja de leer al pasar de este múltiplo del tope de caracteres del servidor. */
export const FACTOR_LECTURA = 1.3

/**
 * Nodos aproximados por modo, para avisar de lo que saldrá. Es lo que sale de
 * verdad, no el presupuesto del servidor: en esquema se le piden ~1 por 900
 * caracteres y el modelo se pasa en torno a un 30 % (medido: 97-143 nodos con 83.000).
 */
export const CARACTERES_POR_NODO: Record<ModoIA, number> = { esquema: 700, detalle: 150 }
