/** Ancho de la columna del entrenador del tutorial; el mapa se encuadra a su derecha. */
export const COACH_WIDTH = 392

/**
 * Encuadre del mapa de práctica: a la derecha del panel de la mascota. En px y como texto: un número
 * suelto React Flow lo toma como fracción (110 = 11 000 %). `minZoom` evita que en pantallas
 * pequeñas los nodos se queden diminutos: se prefiere recortar un poco el borde a no poder leerlos.
 */
export const TUTORIAL_FIT = {
  padding: { top: '40px', right: '40px', bottom: '40px', left: `${COACH_WIDTH + 48}px` },
  minZoom: 0.72,
  maxZoom: 1.1,
} as const
