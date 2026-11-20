'use client'

/* ════════════════════════════════════════════════════════════════════════
   Kit de movimiento de la web: el compañero de `sticker.tsx`. Una sola curva
   (la de las burbujas del dashboard: 0,42 s, [0.22, 1, 0.36, 1]) para todo lo
   que entra y una salida corta, para que filtrar o mover cosas no se sienta
   lento. Nació en la Biblioteca; cualquier pantalla puede usarlo.

   Cómo se monta una pantalla:
     <PaginaConMovimiento animarEntrada={!deMemoria}>      ← reducir movimiento + «¿se anima la entrada?»
       <RejillaAnimada className="grid …">                 ← hereda esa decisión
         {items.map((x, i) => <ItemAnimado key={x.id} indice={i}>…</ItemAnimado>)}
       </RejillaAnimada>
     </PaginaConMovimiento>
   Con `animarEntrada={false}` (se vuelve a una pantalla cuyos datos ya estaban
   en memoria) nada repite la entrada; lo que se añada después sí se anima.
   Con «reducir movimiento», MotionConfig quita desplazamientos y layout y deja
   los fundidos; las clases CSS de aquí llevan su `motion-reduce:`.
═══════════════════════════════════════════════════════════════════════════ */
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, PresenceContext, motion, useReducedMotion, type Variants } from 'framer-motion'

export const TRANSICION = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const }
export const SALIDA = { duration: 0.16, ease: [0.4, 0, 1, 1] as const }

/** Escalonado de entrada: pasos cortos y con tope, para que 70 elementos no tarden más que 10. */
const PASO = 0.03
const TOPE = 10
const retraso = (i: number) => Math.min(Math.max(i, 0), TOPE) * PASO

/** Tarjetas de una rejilla: suben y aparecen en cascada; al salir se encogen rápido. */
export const VARIANTES_TARJETA: Variants = {
  oculta: { opacity: 0, y: 18, scale: 0.97 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...TRANSICION, delay: retraso(i) } }),
  fuera: { opacity: 0, scale: 0.94, transition: SALIDA },
}

/** Filas de una lista: suben un poco al entrar; al salir (moverla a otra carpeta) se van hacia la derecha. */
export const VARIANTES_FILA: Variants = {
  oculta: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, x: 0, transition: { ...TRANSICION, delay: retraso(i) } }),
  fuera: { opacity: 0, x: 28, transition: SALIDA },
}

/** Entrada de un bloque suelto de la página (`{...entrada(0.06)}` en un motion.*), escalonado a mano. */
export const entrada = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { ...TRANSICION, delay },
})

/**
 * Raíz de una pantalla con movimiento: respeta «reducir movimiento» y decide si la entrada se anima.
 * `animarEntrada={false}` bloquea la animación inicial de todo lo que se pinta en el primer render
 * (Hero incluido, sin tocarlo); las rejillas y listas animadas lo heredan.
 */
export function PaginaConMovimiento({ animarEntrada = true, children }: { animarEntrada?: boolean; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={animarEntrada}>
        <PresenciaFija key="pagina">{children}</PresenciaFija>
      </AnimatePresence>
    </MotionConfig>
  )
}

// AnimatePresence necesita un hijo con key; este no pinta nada propio.
function PresenciaFija({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** ¿Se anima la entrada aquí? Lo que diga la pantalla (PaginaConMovimiento) en el momento de montar. */
function useEntradaHeredada(propia: boolean | undefined) {
  const presencia = useContext(PresenceContext)
  const [heredada] = useState(() => presencia?.initial !== false)
  return propia ?? heredada
}

type PropsRejilla = {
  children: ReactNode
  className?: string
  /** Por defecto, lo que diga la pantalla (PaginaConMovimiento). */
  animarEntrada?: boolean
  as?: 'div' | 'ul'
  'aria-label'?: string
}

/**
 * Contenedor de una rejilla o lista animada: lo que sale se queda en su sitio mientras se desvanece
 * (popLayout) y lo demás se recoloca deslizándose. Sus hijos directos, `ItemAnimado` con `key`.
 */
export function RejillaAnimada({ children, className = '', animarEntrada, as = 'div', ...resto }: PropsRejilla) {
  const animar = useEntradaHeredada(animarEntrada)
  const contenido = (
    <AnimatePresence mode="popLayout" initial={animar}>
      {children}
    </AnimatePresence>
  )
  // `relative`: lo que sale se posiciona respecto a este contenedor.
  return as === 'ul' ? (
    <ul className={`relative ${className}`} {...resto}>
      {contenido}
    </ul>
  ) : (
    <div className={`relative ${className}`} {...resto}>
      {contenido}
    </div>
  )
}

type PropsItem = {
  children: ReactNode
  /** Posición en la lista: marca el escalonado de entrada. */
  indice?: number
  variante?: 'tarjeta' | 'fila'
  as?: 'div' | 'li'
  className?: string
}

/** Un elemento de `RejillaAnimada`: entra en cascada, sale rápido y se desliza a su nuevo hueco (solo posición). */
export function ItemAnimado({ children, indice = 0, variante = 'tarjeta', as = 'div', className }: PropsItem) {
  const props = {
    className,
    // Solo la posición: si cambia el alto de la fila de la rejilla, el tamaño se ajusta sin deformar el texto.
    layout: 'position' as const,
    custom: indice,
    variants: variante === 'fila' ? VARIANTES_FILA : VARIANTES_TARJETA,
    initial: 'oculta',
    animate: 'visible',
    exit: 'fuera',
    transition: { layout: TRANSICION },
  }
  return as === 'li' ? <motion.li {...props}>{children}</motion.li> : <motion.div {...props}>{children}</motion.div>
}

/**
 * Hover y pulsación de pegatina para una tarjeta dentro de un `group` (el enlace): al pasar por encima se
 * levanta y la sombra crece lo mismo, así que la esquina de la sombra no se mueve; al pulsar se hunde.
 * Solo CSS (con muchas tarjetas no cuesta nada) y el hover de Tailwind v4 ya ignora el táctil.
 * El StickerCard pone la sombra en línea: quien use esto le pasa `style={{ boxShadow: undefined }}`.
 * Tailwind solo ve clases literales: por eso una constante por profundidad de sombra.
 */
export const PEGATINA_3 =
  'shadow-[3px_3px_0_0_#2c3e50] transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'group-hover:-translate-x-[2px] group-hover:-translate-y-[2px] group-hover:shadow-[5px_5px_0_0_#2c3e50] ' +
  'group-focus-visible:-translate-x-[2px] group-focus-visible:-translate-y-[2px] group-focus-visible:shadow-[5px_5px_0_0_#2c3e50] ' +
  'group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-[1px_1px_0_0_#2c3e50] group-active:duration-75 ' +
  'group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#E8A598] ' +
  'motion-reduce:transition-none'

export const PEGATINA_4 =
  'shadow-[4px_4px_0_0_#2c3e50] transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'group-hover:-translate-x-[3px] group-hover:-translate-y-[3px] group-hover:shadow-[7px_7px_0_0_#2c3e50] ' +
  'group-focus-visible:-translate-x-[3px] group-focus-visible:-translate-y-[3px] group-focus-visible:shadow-[7px_7px_0_0_#2c3e50] ' +
  'group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-[2px_2px_0_0_#2c3e50] group-active:duration-75 ' +
  'group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-[#E8A598] ' +
  'motion-reduce:transition-none'

export const PEGATINA_5 =
  'shadow-[5px_5px_0_0_#2c3e50] transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'group-hover:-translate-x-[3px] group-hover:-translate-y-[3px] group-hover:shadow-[8px_8px_0_0_#2c3e50] ' +
  'group-focus-visible:-translate-x-[3px] group-focus-visible:-translate-y-[3px] group-focus-visible:shadow-[8px_8px_0_0_#2c3e50] ' +
  'group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-[3px_3px_0_0_#2c3e50] group-active:duration-75 ' +
  'group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-[#E8A598] ' +
  'motion-reduce:transition-none'

/** Pequeño giro con rebote para la sigla o el icono de la tarjeta (envolviéndolo: nunca en el icono). */
export const GIRO_HOVER =
  'transition-[rotate,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-6 group-hover:scale-110 group-focus-visible:-rotate-6 group-focus-visible:scale-110 motion-reduce:transition-none'

/** Flecha «ir»: avanza un poco con rebote al pasar por encima (envolviendo el icono). */
export const EMPUJE_HOVER =
  'inline-flex transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none'

/** Hueso de una pantalla en carga (barra o bloque que late suave); el tamaño y la forma, por `className`. */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-[#F0EAE7] motion-safe:animate-pulse ${className}`} />
}

/** Anima la altura hacia la de su contenido (como `AutoHeight` del dashboard): sin saltos al cambiar el texto. */
export function AlturaAnimada({ children, className }: { children: ReactNode; className?: string }) {
  const reducir = useReducedMotion()
  const dentro = useRef<HTMLDivElement | null>(null)
  const [alto, setAlto] = useState<number | 'auto'>('auto')

  useEffect(() => {
    const el = dentro.current
    if (!el) return
    const observador = new ResizeObserver(() => setAlto(el.offsetHeight))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ height: alto }}
      transition={reducir ? { duration: 0 } : TRANSICION}
      style={{ overflow: 'hidden' }}
    >
      <div ref={dentro}>{children}</div>
    </motion.div>
  )
}

/** Un número que, al cambiar, sube (si crece) o baja (si mengua) en vez de saltar. `sufijo`: « %», por ejemplo. */
export function NumeroAnimado({ valor, sufijo = '', className = '' }: { valor: number; sufijo?: string; className?: string }) {
  const reducir = useReducedMotion()
  const [ultimo, setUltimo] = useState(valor)
  const [sentido, setSentido] = useState(1)
  if (valor !== ultimo) {
    setSentido(valor > ultimo ? 1 : -1)
    setUltimo(valor)
  }
  const d = reducir ? 0 : 1
  return (
    <span className={`relative inline-flex overflow-hidden tabular-nums ${className}`}>
      <AnimatePresence initial={false} mode="popLayout" custom={sentido}>
        <motion.span
          key={valor}
          custom={sentido}
          variants={{
            entra: (s: number) => ({ y: `${70 * s * d}%`, opacity: 0 }),
            quieto: { y: '0%', opacity: 1 },
            sale: (s: number) => ({ y: `${-70 * s * d}%`, opacity: 0 }),
          }}
          initial="entra"
          animate="quieto"
          exit="sale"
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {valor}
          {sufijo}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * Dónde cae la búsqueda dentro del texto original. Repite `normalizar` (lib/carpetas/sugerir: sin tildes,
 * minúsculas, signos como espacio) letra a letra para poder volver a las posiciones del texto con tildes.
 */
function rangoCoincidencia(texto: string, q: string): [number, number] | null {
  if (!q) return null
  let norm = ''
  const origen: number[] = []
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9ñ]+/g, ' ')
    for (const ch of c) {
      if (ch === ' ' && norm.endsWith(' ')) continue
      norm += ch
      origen.push(i)
    }
  }
  const p = norm.indexOf(q)
  if (p < 0) return null
  return [origen[p], origen[p + q.length - 1] + 1]
}

/** El texto con lo buscado marcado en suave; `q` ya viene normalizada. */
export function Resaltado({ texto, q }: { texto: string; q: string }) {
  const rango = useMemo(() => rangoCoincidencia(texto, q), [texto, q])
  if (!rango) return <>{texto}</>
  const [a, b] = rango
  return (
    <>
      {texto.slice(0, a)}
      <motion.mark
        className="rounded-[5px] px-px text-inherit"
        initial={{ backgroundColor: 'rgba(232,165,152,0)' }}
        animate={{ backgroundColor: 'rgba(232,165,152,0.38)' }}
        transition={{ duration: 0.25 }}
      >
        {texto.slice(a, b)}
      </motion.mark>
      {texto.slice(b)}
    </>
  )
}
