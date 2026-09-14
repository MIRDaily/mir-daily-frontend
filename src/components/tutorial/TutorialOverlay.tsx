'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import MascotBubble from '@/components/tutorial/MascotBubble'
import PreviewModo, { ALTO_PREVIEW, ANCHO_PREVIEW } from '@/components/tutorial/PreviewModo'
import { useAnchorRect } from '@/components/tutorial/useAnchorRect'
import { desbloquearVoz } from '@/lib/tutorials/mascotAudio'
import type { TutorialStep } from '@/lib/tutorials/types'

/* ════════════════════════════════════════════════════════════════════════
   La capa del tutorial.

   Va por encima de todo (la celebración de logros usa z-[100]) pero por
   debajo de nada que importe: si algo tiene que interrumpir a esto, es que
   algo se ha montado mal.

   El foco no son cuatro divs recortando el hueco, es UNA sombra gigante:
   `box-shadow: 0 0 0 9999px`. Respeta el border-radius, es una sola capa y no
   se descuadra al hacer scroll, que es donde fallan las otras dos técnicas.
═══════════════════════════════════════════════════════════════════════════ */

const MARGEN_FOCO = 10
// Alto estimado del bocadillo, generoso a propósito: en móvil se apila la
// mascota sobre el texto y crece. Pasarse solo empuja hacia la colocación
// anclada abajo, que siempre es segura; quedarse corto lo saca de pantalla.
const ALTO_BOCADILLO = 260
/* Ancho REAL del conjunto mascota + globo en escritorio: 160 de la mascota,
   12 de hueco y 384 del globo (`max-w-sm`). Estaba puesto en 440, que es solo
   el globo, y eso tenia dos consecuencias feas: el conjunto no quedaba
   centrado sobre el foco —se iba 58 px a la derecha— y la comprobacion de
   choque con la maqueta del modo creia que cabian los dos cuando no. Si
   cambia el tamano de la mascota o del globo, este numero cambia con ellos. */
const ANCHO_BOCADILLO = 556
const HUECO = 24
// Sitio para los puntos y el botón "Saltar" cuando el bocadillo va abajo.
const ALTO_BARRA = 72

type Props = {
  paso: TutorialStep
  indice: number
  total: number
  onAvanzar: () => void
  onSaltar: () => void
}

export default function TutorialOverlay({ paso, indice, total, onAvanzar, onSaltar }: Props) {
  /* En qué paso se terminó de escribir el texto. Guardar el índice en vez de
     un booleano evita tener que reiniciarlo desde un efecto cada vez que se
     avanza: al cambiar de paso deja de coincidir y vuelve a ser "escribiendo"
     él solo. */
  const [completoEn, setCompletoEn] = useState<number | null>(null)
  const textoCompleto = completoEn === indice

  const rect = useAnchorRect(paso.placement === 'centro' ? undefined : paso.anchor, true)

  /** Mientras escribe, un toque ACELERA —y se puede tocar varias veces, cada
      una corre más—. Solo con la frase entera en pantalla el toque pasa al
      paso siguiente. Como en Animal Crossing: es la diferencia entre
      encantador e insufrible.

      Que no salte a la frase completa de golpe es lo que separa "voy con
      prisa" de "no quiero leerlo": el salto instantáneo mataba también los
      blips, así que quien tocaba por impaciencia se quedaba sin la voz.

      El `desbloquearVoz()` de aquí arriba es, además, lo que hace que el
      primer cuadro acabe sonando: es un gesto del usuario, y el navegador
      solo deja arrancar el audio después de uno. */
  const avanzar = useCallback(() => {
    void desbloquearVoz()
    if (!textoCompleto) {
      window.dispatchEvent(new Event('tutorial:acelerar'))
      return
    }
    onAvanzar()
  }, [textoCompleto, onAvanzar])

  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSaltar()
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        avanzar()
      }
    }
    window.addEventListener('keydown', teclado)
    return () => window.removeEventListener('keydown', teclado)
  }, [avanzar, onSaltar])

  // El overlay solo se monta cuando el provider ya ha decidido en un efecto,
  // así que en el servidor nunca llega aquí; la guarda es por si acaso.
  if (typeof document === 'undefined') return null

  const hayFoco = rect !== null && rect.width > 0 && rect.height > 0

  /* Tres colocaciones, no ocho: debajo del objetivo, encima si debajo no cabe,
     y anclado al fondo de la pantalla cuando no cabe en ninguno de los dos.
     El tercer caso no es rebuscado —es el normal en móvil, donde el foco del
     sobre ocupa casi toda la pantalla— y sin él el bocadillo se salía por
     arriba con la mascota cortada por el borde. */
  const espacioDebajo = hayFoco ? window.innerHeight - (rect.top + rect.height) : 0
  const espacioEncima = hayFoco ? rect.top : 0
  const cabeDebajo = hayFoco && espacioDebajo >= ALTO_BOCADILLO + HUECO
  const cabeEncima = hayFoco && espacioEncima >= ALTO_BOCADILLO + HUECO

  const centroX = hayFoco ? rect.left + rect.width / 2 : 0
  const mirandoIzquierda = hayFoco && centroX > window.innerWidth * 0.6

  const posicionVertical = cabeDebajo
    ? { top: rect.top + rect.height + HUECO }
    : cabeEncima
      ? { bottom: window.innerHeight - rect.top + HUECO }
      : { bottom: ALTO_BARRA }

  const izquierdaBocadillo = hayFoco
    ? Math.min(
        Math.max(centroX - ANCHO_BOCADILLO / 2, 16),
        Math.max(window.innerWidth - ANCHO_BOCADILLO - 16, 16),
      )
    : 0

  /* La maqueta del modo va en el hueco que el foco deja al otro lado: se mide
     el espacio libre a izquierda y derecha y gana el mayor. En móvil el foco
     ocupa casi todo el ancho, no hay hueco y no sale — que es lo correcto,
     porque ahí competiría con el bocadillo por una pantalla ya llena. */
  const huecoIzquierda = hayFoco ? rect.left - HUECO * 2 : 0
  const huecoDerecha = hayFoco ? window.innerWidth - (rect.left + rect.width) - HUECO * 2 : 0
  const previewALaIzquierda = huecoIzquierda >= huecoDerecha
  const huecoPreview = Math.max(huecoIzquierda, huecoDerecha)

  /* La miniatura se DIBUJA siempre al mismo tamaño y aquí se escala para
     llenar el hueco. Antes tenía un tamaño fijo y prudente, y el resultado
     era que se veía enana aunque al lado sobrara media pantalla. Escalando,
     las coordenadas del ratón siguen valiendo —van en el espacio de dibujo—
     y la maqueta se ve todo lo grande que quepa.

     El tope de 1.35 existe para que en un monitor enorme no acabe siendo más
     grande que la propia tarjeta que está explicando. */
  const altoDisponible = window.innerHeight - HUECO * 2 - ALTO_BARRA
  const escalaPreview = Math.min(
    1.35,
    huecoPreview / ANCHO_PREVIEW,
    altoDisponible / ALTO_PREVIEW,
  )
  const anchoEscalado = ANCHO_PREVIEW * escalaPreview
  const altoEscalado = ALTO_PREVIEW * escalaPreview

  const izquierdaPreview = !hayFoco
    ? 0
    : previewALaIzquierda
      ? Math.max(rect.left - HUECO - anchoEscalado, HUECO)
      : rect.left + rect.width + HUECO

  // Centrada con el foco, pero sin salirse por arriba ni por abajo.
  const topPreview = hayFoco
    ? Math.min(
        Math.max(rect.top + rect.height / 2 - altoEscalado / 2, HUECO),
        Math.max(window.innerHeight - altoEscalado - ALTO_BARRA, HUECO),
      )
    : HUECO

  /* Y no se pinta si fuera a chocar con el bocadillo.

     La primera versión de esto era una regla de brocha gorda —"solo si el
     bocadillo cabe encima o debajo del foco"— y se cargaba justo el caso
     normal: con una tarjeta alta, el bocadillo se ancla al fondo aunque a los
     lados sobre media pantalla. Así que en vez de adivinar, se comparan los
     dos rectángulos de verdad. */
  const topBocadillo = cabeDebajo
    ? rect.top + rect.height + HUECO
    : cabeEncima
      ? rect.top - HUECO - ALTO_BOCADILLO
      : window.innerHeight - ALTO_BARRA - ALTO_BOCADILLO

  const chocanEnHorizontal =
    izquierdaPreview < izquierdaBocadillo + ANCHO_BOCADILLO &&
    izquierdaPreview + anchoEscalado > izquierdaBocadillo
  const chocanEnVertical =
    topPreview < topBocadillo + ALTO_BOCADILLO && topPreview + altoEscalado > topBocadillo

  // Por debajo de ~0,6 los rótulos dejan de leerse: mejor no enseñarla.
  const muestraPreview =
    hayFoco &&
    Boolean(paso.preview) &&
    escalaPreview >= 0.6 &&
    !(chocanEnHorizontal && chocanEnVertical)

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-live="polite">
      {/* Capa oscura. Con foco es la sombra del recorte; sin foco, un velo. */}
      {hayFoco ? (
        <motion.div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-[#E8A598]"
          initial={false}
          animate={{
            top: rect.top - MARGEN_FOCO,
            left: rect.left - MARGEN_FOCO,
            width: rect.width + MARGEN_FOCO * 2,
            height: rect.height + MARGEN_FOCO * 2,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          style={{ boxShadow: '0 0 0 9999px rgba(44, 62, 80, 0.55)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#2C3E50]/55 backdrop-blur-[2px]" />
      )}

      {/* Toda la capa avanza al tocarla: obligar a acertar un botón pequeño
          justo cuando la persona todavía no sabe dónde está nada es lo
          contrario de lo que hace un tutorial. */}
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-pointer"
        onClick={avanzar}
        aria-label={textoCompleto ? 'Siguiente' : 'Escribir más rápido'}
      />

      {/* La maqueta del modo, en el hueco de al lado. Va ANTES del bocadillo
          en el DOM a propósito: si algún día llegaran a rozarse, el que
          manda es el que lleva el texto. */}
      {muestraPreview && paso.preview ? (
        <motion.div
          /* La clave es el MODO y no el índice: con varios bocadillos
             seguidos sobre la misma tarjeta, indexar por paso remontaba la
             maqueta en cada uno y la animación volvía a empezar sin llegar
             nunca a terminar su vuelta. */
          key={`preview-${paso.preview}`}
          className="pointer-events-none absolute"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            top: topPreview,
            left: izquierdaPreview,
            width: anchoEscalado,
            height: altoEscalado,
          }}
        >
          <div
            style={{ transform: `scale(${escalaPreview})`, transformOrigin: 'top left' }}
          >
            <PreviewModo modo={paso.preview} />
          </div>
        </motion.div>
      ) : null}

      <AnimatePresence mode="wait">
        {/* Centrar con flex y NO con `translate(-50%,-50%)`: framer anima `y`
            en este mismo elemento, así que escribe su propio `transform` y se
            comería el nuestro —que es justo lo que pasaba: el bocadillo se
            clavaba por la esquina en el centro de la pantalla. */}
        <motion.div
          key={indice}
          className={
            hayFoco
              ? 'pointer-events-none absolute'
              : 'pointer-events-none absolute inset-0 flex items-center justify-center'
          }
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={
            hayFoco
              ? {
                  ...posicionVertical,
                  left: Math.min(
                    Math.max(centroX - ANCHO_BOCADILLO / 2, 16),
                    Math.max(window.innerWidth - ANCHO_BOCADILLO - 16, 16),
                  ),
                }
              : undefined
          }
        >
          <MascotBubble
            texto={paso.text}
            pose={paso.pose}
            mirandoIzquierda={mirandoIzquierda}
            onTextoCompleto={() => setCompletoEn(indice)}
          />
        </motion.div>
      </AnimatePresence>

      {/* Saltar, siempre visible y siempre en el mismo sitio. */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === indice ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSaltar}
          className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          Saltar
        </button>
      </div>
    </div>,
    document.body,
  )
}
