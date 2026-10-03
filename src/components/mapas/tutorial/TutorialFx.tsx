import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import { useTutorialFx } from './fx'

// Lo que se ve de las demostraciones: el cursor fantasma y las teclas pulsadas. Mismo cursor que
// las maquetas del Studio (components/tutorial/PreviewModo), para que se reconozca.

const TINTA = '#2C3E50'

/** El botón ? de atajos del editor, tal cual se ve en la interfaz (para nombrarlo dentro del texto). */
export function HelpButtonIcon() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        margin: '0 2px',
        verticalAlign: 'middle',
        borderRadius: 8,
        border: '1px solid #E5DED6',
        background: '#FFFFFF',
        color: '#7D8A96',
        boxShadow: '0 2px 8px rgba(125,138,150,.22)',
      }}
    >
      <HelpCircle size={14} />
    </span>
  )
}

export function KeyCap({ k, pressed = false, size = 'md' }: { k: string; pressed?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const pad = size === 'lg' ? '10px 18px' : size === 'md' ? '4px 9px' : '2px 6px'
  const font = size === 'lg' ? 22 : size === 'md' ? 12 : 10
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size === 'lg' ? 56 : size === 'md' ? 26 : 18,
        padding: pad,
        borderRadius: size === 'lg' ? 12 : 7,
        border: `1.5px solid ${TINTA}`,
        background: pressed ? '#FDE68A' : '#FFFFFF',
        color: TINTA,
        fontFamily: 'inherit',
        fontWeight: 800,
        fontSize: font,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        boxShadow: pressed ? `0 1px 0 ${TINTA}` : `0 ${size === 'lg' ? 4 : 2}px 0 ${TINTA}`,
        transform: pressed ? `translateY(${size === 'lg' ? 3 : 1}px)` : 'none',
        transition: 'transform 90ms ease, box-shadow 90ms ease, background 120ms ease',
      }}
    >
      {k}
    </kbd>
  )
}

export function TutorialFx({ leftInset = 0 }: { leftInset?: number }) {
  const cursor = useTutorialFx((s) => s.cursor)
  const keys = useTutorialFx((s) => s.keys)

  return (
    <>
      {/* Teclas pulsadas: grandes, abajo y centradas en el hueco del mapa. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          // Por encima del minimapa (150 px de alto + margen), centradas en el hueco del mapa.
          bottom: 184,
          left: leftInset,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1200,
        }}
      >
        <AnimatePresence>
          {keys.length > 0 && (
            <motion.div
              key={keys.join('+')}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 10px 30px rgba(44,62,80,0.18)',
              }}
            >
              {keys.map((k, i) => (
                <span key={k + i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {i > 0 && <span style={{ fontWeight: 800, color: TINTA, fontSize: 18 }}>+</span>}
                  <KeyCap k={k} pressed size="lg" />
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cursor fantasma, en coordenadas de pantalla. Va en el <body>: dentro del editor quedaba por
          debajo de la cabecera y de los diálogos (cada uno tiene su propio apilado). */}
      {cursor && typeof document !== 'undefined' && createPortal(
        <motion.div
          aria-hidden
          initial={false}
          animate={{ x: cursor.x, y: cursor.y }}
          transition={cursor.ms ? { duration: cursor.ms / 1000, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          style={{ position: 'fixed', left: 0, top: 0, zIndex: 1300, pointerEvents: 'none' }}
        >
          <AnimatePresence>
            {cursor.pressed && (
              <motion.span
                initial={{ scale: 0.2, opacity: 0.55 }}
                animate={{ scale: 1, opacity: 0.35 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: 'absolute',
                  left: -16,
                  top: -16,
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: '#E8A598',
                }}
              />
            )}
          </AnimatePresence>
          <motion.svg
            viewBox="0 0 12 18"
            width={22}
            height={33}
            animate={{ scale: cursor.pressed ? 0.86 : 1 }}
            transition={{ duration: 0.1 }}
            style={{ position: 'absolute', left: -2, top: -2, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }}
          >
            <path d="M1 1 L11 11 L6.5 11.5 L9 16.5 L7 17.5 L4.5 12.5 L1 15.5 Z" fill={TINTA} stroke="#fff" strokeWidth="1.2" />
          </motion.svg>
        </motion.div>,
        document.body,
      )}
    </>
  )
}
