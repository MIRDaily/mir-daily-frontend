// Fuentes que se pueden elegir en el editor de mapas. Todas son libres (licencia OFL) y se sirven
// desde nuestro propio dominio con next/font (components/mapas/proto/fonts.ts): sin coste, sin
// peticiones a terceros desde el navegador y sin parpadeo al cargar.
//
// Lo que se guarda en el mapa es el `id` (p. ej. 'Nunito'); `css` es la pila real. Los valores
// antiguos (una pila CSS suelta, como 'Georgia, serif') siguen funcionando tal cual.

export type MapFont = { id: string; label: string; css: string; kind: 'sans' | 'serif' | 'mono' | 'manuscrita' }

export const MAP_FONTS: MapFont[] = [
  { id: 'Lexend', label: 'Lexend', css: "var(--font-lexend), 'Lexend', system-ui, sans-serif", kind: 'sans' },
  { id: 'Inter', label: 'Inter', css: "var(--font-mapa-inter), 'Inter', system-ui, sans-serif", kind: 'sans' },
  { id: 'Nunito', label: 'Nunito', css: "var(--font-mapa-nunito), 'Nunito', system-ui, sans-serif", kind: 'sans' },
  { id: 'Lora', label: 'Lora', css: "var(--font-mapa-lora), 'Lora', Georgia, serif", kind: 'serif' },
  { id: 'Playfair Display', label: 'Playfair', css: "var(--font-mapa-playfair), 'Playfair Display', Georgia, serif", kind: 'serif' },
  { id: 'JetBrains Mono', label: 'JetBrains', css: "var(--font-mapa-mono), 'JetBrains Mono', 'Courier New', monospace", kind: 'mono' },
  { id: 'Caveat', label: 'Caveat', css: "var(--font-mapa-caveat), 'Caveat', cursive", kind: 'manuscrita' },
]

const BY_ID = new Map(MAP_FONTS.map((f) => [f.id, f]))

export function fontCss(name: string | undefined): string {
  if (!name) return MAP_FONTS[0].css
  return BY_ID.get(name)?.css ?? name
}

/** ¿Es una fuente de la lista (y no una pila antigua suelta)? */
export function isMapFont(name: string | undefined): boolean {
  return !!name && BY_ID.has(name)
}
