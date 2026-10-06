import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { GraduationCap, HelpCircle, X } from 'lucide-react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'

const SHORTCUTS: { keys: string[]; desc: string }[] = [
  { keys: ['Tab'], desc: 'Hijo del nodo seleccionado (también escribiendo)' },
  { keys: ['Enter'], desc: 'Hermano del nodo seleccionado' },
  { keys: ['← ↑ → ↓'], desc: 'Moverse entre nodos conectados' },
  { keys: ['Escribir'], desc: 'Editar el nodo seleccionado (F2 también)' },
  { keys: ['N'], desc: 'Nuevo nodo suelto (sin nada seleccionado; Alt+N siempre)' },
  { keys: ['Espacio'], desc: 'Plegar / desplegar los nodos seleccionados' },
  { keys: ['Alt', '1 – 9'], desc: 'Ver hasta ese nivel (Alt+0: todo)' },
  { keys: ['Alt', 'M'], desc: 'Pasar la rama seleccionada al otro lado, en espejo' },
  { keys: ['Alt', 'T'], desc: 'Tabla hija del nodo seleccionado (o suelta)' },
  { keys: ['Tabla: Tab / ⇧Tab'], desc: 'Celda siguiente / anterior (Tab en la última: fila nueva)' },
  { keys: ['Tabla: flechas'], desc: 'Saltar de celda desde el borde del texto; Enter baja, ⇧Enter salto de línea' },
  { keys: ['Tabla: Alt', '← ↑ → ↓'], desc: 'Mover la fila o la columna de la celda' },
  { keys: ['Ctrl', 'F'], desc: 'Buscar en el mapa' },
  { keys: ['Ctrl', 'P'], desc: 'Exportar / imprimir (PDF, imagen)' },
  { keys: ['Ctrl', 'Arrastrar'], desc: 'Soltar sobre otro nodo: cambia de rama' },
  { keys: ['Selección', 'Ordenar'], desc: 'Ordena solo los nodos seleccionados' },
  { keys: ['Doble clic'], desc: 'Editar nodo' },
  
  { keys: ['Click +'], desc: 'Añadir nodo hijo' },
  { keys: ['Supr'], desc: 'Eliminar selección' },
  { keys: ['Ctrl', 'Z'], desc: 'Deshacer' },
  { keys: ['Ctrl', '⇧Z'], desc: 'Rehacer' },
  { keys: ['Ctrl', 'C'], desc: 'Copiar nodos' },
  { keys: ['Ctrl', 'X'], desc: 'Cortar nodos' },
  { keys: ['Ctrl', 'V'], desc: 'Pegar nodos' },
  { keys: ['Ctrl', 'E'], desc: 'Estilos del nodo seleccionado (o la paleta sobre el nodo)' },
  { keys: ['Varios + Estilos'], desc: 'Mismo estilo a toda la selección' },
  { keys: ['1 – 7'], desc: 'Categoría del nodo bajo el cursor (o de toda la selección)' },
  { keys: ['Arrastrar nodo'], desc: 'Mueve el nodo con toda su rama' },
  { keys: ['Alt', 'Arrastrar'], desc: 'Mueve solo el nodo' },
  { keys: ['Clic − / +N'], desc: 'Plegar / desplegar rama' },
  { keys: ['Arrastrar en vacío'], desc: 'Selección múltiple' },
  { keys: ['Clic medio'], desc: 'Mover canvas (arrastrar)' },
  { keys: ['Scroll'], desc: 'Mover canvas (rueda)' },
  { keys: ['Esc'], desc: 'Cerrar / Deseleccionar' },
]

// Panel collapses downward toward the ? button
const panelVariants = {
  hidden: {
    opacity: 0,
    scale: 0.82,
    y: 14,
    transition: { duration: 0.35, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 360, damping: 28, mass: 0.85 },
  },
  exit: {
    opacity: 0,
    scale: 0.72,
    y: 18,
    transition: { duration: 0.42, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
}

const AUTO_CLOSE_MS = 5000

export function ShortcutsPanel() {
  const [open, setOpen] = useState(false)
  const btnControls = useAnimationControls()
  const autoCloseFired = useRef(false)
  const t = useTheme()

  const collapse = () => {
    setOpen(false)
    // ~420ms after exit starts, pulse the button to "receive" the panel
    setTimeout(() => {
      btnControls.start({
        scale: [1, 1.28, 1.08, 1],
        transition: { duration: 0.52, ease: 'easeOut' },
      })
    }, 400)
  }

  // Auto-collapse once on first mount
  useEffect(() => {
    if (autoCloseFired.current) return
    autoCloseFired.current = true
    const t = setTimeout(collapse, AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    if (open) {
      collapse()
    } else {
      setOpen(true)
    }
  }

  return (
    // Encima de los controles de zoom de React Flow y en su misma columna: allí están a 15 px del
    // borde, miden 28 px de ancho y unos 106 de alto (+ − encuadrar bloquear). El botón copia su
    // caja (ancho, borde, radio, sombra) para leerse como uno más de la columna.
    <div
      style={{
        position: 'absolute',
        bottom: 15 + 106 + 10,
        left: 15,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="shortcuts-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              transformOrigin: 'bottom left',
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              boxShadow: `0 8px 32px ${t.shadow}`,
              minWidth: 244,
              // Con tantos atajos ya no cabe entero: que no se meta bajo la barra ni la caja del título.
              maxHeight: 'calc(100dvh - 300px)',
              overflowY: 'auto',
              transition: 'background 400ms ease, border-color 400ms ease',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  color: t.textPrimary,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}
              >
                Atajos de teclado
              </span>
              <button
                onClick={collapse}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.textMuted,
                  padding: 2,
                  borderRadius: 4,
                  display: 'flex',
                  transition: 'color 150ms',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = t.textPrimary)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = t.textMuted)
                }
              >
                <X size={13} />
              </button>
            </div>

            {/* Acceso permanente al tutorial interactivo (mapa de práctica + mascota). */}
            <Link
              href="/mapas/tutorial"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 10,
                background: t.isDark ? '#3a2f2c' : '#FCEFEC',
                color: '#E8A598',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <GraduationCap size={15} />
              <span style={{ flex: 1 }}>Tutorial interactivo</span>
              <span aria-hidden>→</span>
            </Link>

            {/* Shortcut rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {SHORTCUTS.map(({ keys, desc }) => (
                <div
                  key={desc}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ color: t.textMuted, fontSize: 11 }}>{desc}</span>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {keys.map((k, i) => (
                      <kbd
                        key={i}
                        style={{
                          background: t.isDark ? '#313244' : '#eeedf8',
                          color: t.textSecondary,
                          border: `1px solid ${t.border}`,
                          borderRadius: 5,
                          padding: '2px 6px',
                          fontSize: 10,
                          fontFamily: 'inherit',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          boxShadow: t.isDark
                            ? '0 1px 0 rgba(0,0,0,0.4)'
                            : '0 1px 0 rgba(0,0,0,0.1)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button — always visible */}
      <motion.button
        animate={btnControls}
        onClick={handleToggle}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        title={open ? 'Cerrar atajos' : 'Ver atajos de teclado'}
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          border: `1px solid ${open ? t.accent : t.border}`,
          background: open ? t.accent : t.bgPanel,
          color: open ? '#fff' : t.textMuted,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 2px 12px ${t.shadow}`,
          padding: 0,
          transition: 'background 200ms ease, color 200ms ease, border-color 200ms ease',
        }}
      >
        <HelpCircle size={15} />
      </motion.button>
    </div>
  )
}
