import { fontCss } from '@/lib/mapas/fonts'

/**
 * Pila CSS de una fuente guardada. Acepta el id de una de las fuentes del editor ('Nunito'…), el
 * antiguo 'Lexend' del prototipo y las pilas sueltas de mapas viejos ('Georgia, serif').
 */
export function resolveFont(name: string | undefined): string {
  return fontCss(name)
}
