'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useProfile } from '@/hooks/useProfile'
import { FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { iaEstado } from '@/lib/mapas/ia/api'
import { flashcardsIAEstado } from '@/lib/flashcards/ia/api'
import { resumenesIAEstado } from '@/lib/resumenes/ia'
import type { EstadosIA } from './DocumentoIAHub'

// Studio: arrastrar un PDF, Word o PowerPoint a la página (o pulsar «Crear desde un documento») abre
// el popup unificado para sacar de él un mapa conceptual, flashcards y/o un resumen activo. Solo se
// ofrece si el servidor dice que alguna de las tres IA está disponible para esta cuenta (el permiso
// real lo valida siempre el servidor; ocultar esto no protege nada).

const DocumentoIAHub = dynamic(() => import('./DocumentoIAHub'), { ssr: false })

const EXTENSIONES = /\.(pdf|docx|pptx)$/i
const lleva = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

export function useDocumentoIA() {
  const { profile } = useProfile()
  const esAdmin = profile?.is_admin === true
  const [estados, setEstados] = useState<EstadosIA | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const abiertoRef = useRef(false)
  useEffect(() => {
    abiertoRef.current = archivo !== null
  }, [archivo])

  useEffect(() => {
    if (!esAdmin) return
    let vivo = true
    void Promise.all([iaEstado(), flashcardsIAEstado(), resumenesIAEstado()]).then(([mapa, flashcards, resumenes]) => {
      if (vivo) setEstados({ mapa, flashcards, resumenes })
    })
    return () => {
      vivo = false
    }
  }, [esAdmin])

  const disponible = !!estados && (!!estados.mapa || !!estados.flashcards || !!estados.resumenes)

  const recibir = useCallback((f: File | undefined) => {
    if (!f) return
    if (!EXTENSIONES.test(f.name)) {
      setRechazo('Solo se leen PDF, Word (.docx) y PowerPoint (.pptx).')
      return
    }
    setRechazo(null)
    setArchivo(f)
  }, [])

  useEffect(() => {
    if (!rechazo) return
    const t = setTimeout(() => setRechazo(null), 4000)
    return () => clearTimeout(t)
  }, [rechazo])

  // Arrastrar archivos sobre la página. `dragenter`/`dragleave` se disparan también al pasar por los
  // hijos: se cuentan para saber cuándo se sale de verdad de la ventana.
  useEffect(() => {
    if (!disponible) return
    let dentro = 0
    const entra = (e: DragEvent) => {
      if (!lleva(e)) return
      dentro += 1
      if (!abiertoRef.current) setArrastrando(true)
    }
    const sale = (e: DragEvent) => {
      if (!lleva(e)) return
      dentro = Math.max(0, dentro - 1)
      if (dentro === 0) setArrastrando(false)
    }
    // Sin esto el navegador no admite el «soltar» (y, con el popup abierto, abriría el archivo en la pestaña).
    const sobre = (e: DragEvent) => {
      if (!lleva(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = abiertoRef.current ? 'none' : 'copy'
    }
    const suelta = (e: DragEvent) => {
      if (!lleva(e)) return
      e.preventDefault()
      dentro = 0
      setArrastrando(false)
      if (!abiertoRef.current) recibir(e.dataTransfer?.files?.[0])
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
    }
  }, [disponible, recibir])

  return { estados, disponible, archivo, setArchivo, recibir, arrastrando, rechazo }
}

export type DocumentoIA = ReturnType<typeof useDocumentoIA>

/** La tarjeta de «Acceso rápido»: se pulsa para elegir el archivo (arrastrarlo vale en toda la página). */
export function BotonDocumentoIA({ ia, className = '' }: { ia: DocumentoIA; className?: string }) {
  const input = useRef<HTMLInputElement>(null)
  if (!ia.disponible) return null
  return (
    <div className={className}>
      <input
        ref={input}
        type="file"
        accept={FORMATOS_ACEPTADOS}
        className="hidden"
        onChange={(e) => {
          ia.recibir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group flex w-full cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-[#E8A598]/60 bg-[#FCEFEC]/60 p-4 text-left transition-colors hover:border-[#E8A598] hover:bg-[#FCEFEC]"
      >
        <div className="rounded-lg bg-[#E8A598] p-2 text-white">
          <span className="material-symbols-outlined">upload_file</span>
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-[#2c3e50]">Crear desde un documento</h4>
          <p className="text-xs">Arrastra un PDF, Word o PowerPoint a esta página (o púlsame): mapa conceptual, flashcards y/o resumen activo.</p>
        </div>
      </button>
    </div>
  )
}

/** Lo que va a nivel de página (fuera de los bloques con transformaciones): la capa de «suelta aquí» y el popup. */
export function CapaDocumentoIA({ ia }: { ia: DocumentoIA }) {
  return (
    <>
      {ia.arrastrando && !ia.archivo && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-[#2C3E50]/35 p-6 backdrop-blur-[2px]"
        >
          <div
            className="flex max-w-md flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[#E8A598] bg-[#FAF7F4] px-10 py-12 text-center"
            style={{ boxShadow: '6px 6px 0 0 #2C3E50' }}
          >
            <span className="material-symbols-outlined text-[48px] text-[#E8A598]">upload_file</span>
            <p className="text-lg font-extrabold text-[#2C3E50]">Suelta el documento aquí</p>
            <p className="text-sm text-[#7D8A96]">Podrás elegir si hacer un mapa conceptual, flashcards o un resumen activo.</p>
          </div>
        </div>
      )}
      {ia.rechazo && (
        <p
          role="alert"
          className="fixed bottom-6 left-1/2 z-[95] max-w-[90vw] -translate-x-1/2 rounded-2xl border border-[#D4667A]/30 bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E] shadow-lg"
        >
          {ia.rechazo}
        </p>
      )}
      {ia.archivo && ia.estados ? <DocumentoIAHub archivo={ia.archivo} estados={ia.estados} onClose={() => ia.setArchivo(null)} /> : null}
    </>
  )
}
