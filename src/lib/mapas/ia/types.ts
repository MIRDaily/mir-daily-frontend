// Tipos de la IA de mapas (documento → mapa). El texto se extrae EN EL
// NAVEGADOR: el archivo nunca se sube; al servidor solo viaja el texto.

/** `pagina`: número de página o diapositiva de donde sale (revisión guiada: página de origen). */
export type Seccion = { titulo?: string; texto: string; pagina?: number }

export type Extraido = {
  /** Título propuesto (metadatos o nombre del archivo). */
  titulo: string
  secciones: Seccion[]
  paginas: number
  /** Tablas leídas con su estructura (filas y columnas). */
  tablas?: number
  /** Cómo se llaman las «páginas» de este formato, para el diálogo. */
  unidad?: 'página' | 'diapositiva'
  caracteres: number
  /** Cosas que el usuario debería saber (p. ej. se dejó de leer por el tope). */
  avisos: string[]
  /** Se dejó de leer al llegar al tope de lectura. */
  truncado: boolean
  /** Marcadores del PDF (índice del propio archivo): título y página donde empieza. */
  marcadores?: { titulo: string; pagina: number; nivel?: 1 | 2 }[]
}

export type ModoIA = 'esquema' | 'detalle'

export type EstadoIA = {
  disponible: boolean
  modos: ModoIA[]
  /** Opciones que entiende el servidor (uno antiguo no las manda). */
  opciones?: { tablas?: boolean; libro?: boolean }
  /** `maxChars`/`maxPaginas`: un mapa. `maxCharsLibro`/`maxTemas`: documento largo tema a tema (servidor nuevo). */
  limites: { maxChars: number; maxPaginas: number; maxCharsLibro?: number; maxPaginasLibro?: number; maxTemas?: number }
  cupo: {
    generacionesHoy: number
    maxGeneracionesDia: number
    caracteresHoy: number
    maxCaracteresDia: number
  }
}

/** Error con mensaje listo para enseñar al usuario. */
export class ExtractError extends Error {}

// Sin «parameter properties» (readonly en el constructor): Node no las sabe quitar y los tests
// (npm test) no podrían cargar este módulo.
export class IAError extends Error {
  readonly status: number
  readonly codigo: string
  constructor(message: string, status = 0, codigo = '') {
    super(message)
    this.status = status
    this.codigo = codigo
  }
}

/** Tamaño máximo de archivo que se intenta leer (protege la memoria de la pestaña). */
export const MAX_ARCHIVO_BYTES = 30_000_000

/**
 * En Word y PowerPoint casi todo el peso son imágenes, que no se leen (solo se cuentan): un
 * seminario de 32 MB tenía 27 MB de fotos y 25.000 caracteres de texto. El tope es más alto.
 */
export const MAX_OFFICE_BYTES = 120_000_000

/** Aviso para un documento con imágenes: su contenido no entra en el mapa. */
export function avisoImagenes(n: number): string | null {
  if (n <= 0) return null
  return n === 1
    ? 'Tiene 1 imagen: lo que haya dentro (tablas, esquemas, texto en la imagen) no se lee, solo el texto del documento.'
    : `Tiene ${n} imágenes: lo que haya dentro (tablas, esquemas, texto en las imágenes) no se lee, solo el texto del documento.`
}

/** Se deja de leer al pasar de este múltiplo del tope de caracteres del servidor. */
export const FACTOR_LECTURA = 1.3

/**
 * Nodos aproximados por modo (k × √caracteres), para avisar de lo que saldrá.
 * Es lo que sale de verdad, no el presupuesto del servidor (que el modelo
 * supera algo): medido con los 16 temas de reuma, de 1.500 a 84.000 caracteres.
 * Crece con la raíz y no en línea: un tema corto también tiene sus entidades.
 */
export const NODOS_POR_RAIZ: Record<ModoIA, number> = { esquema: 0.5, detalle: 0.7 }
