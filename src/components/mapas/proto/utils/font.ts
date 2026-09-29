/**
 * El prototipo guardaba 'Lexend' como nombre de fuente. En MIRDaily Lexend se carga
 * con next/font y su familia real es la variable `--font-lexend`; el nombre suelto
 * no resolvería a nada.
 */
export function resolveFont(name: string | undefined): string {
  if (!name || name === 'Lexend') return "var(--font-lexend), 'Lexend', system-ui, sans-serif"
  return name
}
