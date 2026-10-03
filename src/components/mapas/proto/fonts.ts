import { Caveat, Inter, JetBrains_Mono, Lora, Nunito, Playfair_Display } from 'next/font/google'

// Las fuentes extra del editor de mapas (lib/mapas/fonts.ts). next/font las descarga al compilar y
// las sirve desde nuestro dominio; `preload: false` evita cargarlas hasta que algún nodo las use,
// y todas son variables (un solo fichero por fuente y subconjunto). Las opciones tienen que ser
// literales en cada llamada: next/font las lee en compilación y no admite `...opciones`.

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-mapa-inter' })
const nunito = Nunito({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-mapa-nunito' })
const lora = Lora({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-mapa-lora' })
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-mapa-playfair' })
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-mapa-mono' })
const caveat = Caveat({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-mapa-caveat' })

/** Clases que definen las variables CSS de las fuentes: van en la raíz del editor. */
export const MAP_FONT_CLASSES = [inter, nunito, lora, playfair, mono, caveat].map((f) => f.variable).join(' ')
