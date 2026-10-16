'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Arrastrar un PDF, Word o PowerPoint a cualquier parte de la página para crear con IA, sin pasar por
// el botón. Lo usan Studio (popup unificado) y las páginas de mapas, flashcards y resúmenes (su propio
// diálogo, ya con el archivo). Con `activo` false (sin IA para esta cuenta) no escucha nada; con
// `bloqueado` (un diálogo abierto) no enseña la capa ni recoge el archivo, pero evita que el navegador
// lo abra en la pestaña al soltarlo fuera de la zona del diálogo.

const EXTENSIONES = /\.(pdf|docx|pptx)$/i
const lleva = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

export const RECHAZO_FORMATO = 'Solo se leen PDF, Word (.docx) y PowerPoint (.pptx).'

export function useSoltarDocumento({ activo, bloqueado = false, alSoltar }: { activo: boolean; bloqueado?: boolean; alSoltar: (f: File) => void }) {
  const [arrastrando, setArrastrando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const bloqueadoRef = useRef(bloqueado)
  const alSoltarRef = useRef(alSoltar)
  useEffect(() => {
    bloqueadoRef.current = bloqueado
    alSoltarRef.current = alSoltar
  }, [bloqueado, alSoltar])

  /** Lo mismo al elegirlo con un `<input type="file">`: comprueba el formato y lo pasa. */
  const recibir = useCallback((f: File | undefined) => {
    if (!f) return
    if (!EXTENSIONES.test(f.name)) {
      setRechazo(RECHAZO_FORMATO)
      return
    }
    setRechazo(null)
    alSoltarRef.current(f)
  }, [])

  useEffect(() => {
    if (!rechazo) return
    const t = setTimeout(() => setRechazo(null), 4000)
    return () => clearTimeout(t)
  }, [rechazo])

  // `dragenter`/`dragleave` se disparan también al pasar por los hijos: se cuentan para saber cuándo se
  // sale de verdad de la ventana.
  useEffect(() => {
    if (!activo) return
    let dentro = 0
    const entra = (e: DragEvent) => {
      if (!lleva(e)) return
      dentro += 1
      if (!bloqueadoRef.current) setArrastrando(true)
    }
    const sale = (e: DragEvent) => {
      if (!lleva(e)) return
      dentro = Math.max(0, dentro - 1)
      if (dentro === 0) setArrastrando(false)
    }
    // Sin esto el navegador no admite el «soltar» (y, con un diálogo abierto, abriría el archivo en la pestaña).
    // Con un diálogo abierto, su propia zona de soltar ya ha aceptado el archivo (preventDefault) antes de
    // que el evento suba hasta aquí: entonces no se toca nada. Marcar «none» encima la anulaba, y el PDF
    // no entraba en el recuadro del diálogo.
    const sobre = (e: DragEvent) => {
      if (!lleva(e)) return
      if (bloqueadoRef.current) {
        if (e.defaultPrevented) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
        return
      }
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const suelta = (e: DragEvent) => {
      if (!lleva(e)) return
      dentro = 0
      setArrastrando(false)
      // La zona del diálogo ya lo ha recogido: no se recoge otra vez.
      if (e.defaultPrevented) return
      e.preventDefault()
      if (!bloqueadoRef.current) recibir(e.dataTransfer?.files?.[0])
    }
    window.addEventListener('dragenter', entra)
    window.addEventListener('dragleave', sale)
    window.addEventListener('dragover', sobre)
    window.addEventListener('drop', suelta)
    return () => {
      window.removeEventListener('dragenter', entra)
      window.removeEventListener('dragleave', sale)
      window.removeEventListener('dragover', sobre)
      window.removeEventListener('drop', suelta)
      setArrastrando(false)
    }
  }, [activo, recibir])

  return { arrastrando: arrastrando && !bloqueado, rechazo, recibir }
}
