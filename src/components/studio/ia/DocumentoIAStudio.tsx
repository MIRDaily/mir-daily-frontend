'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useProfile } from '@/hooks/useProfile'
import { FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { iaEstado } from '@/lib/mapas/ia/api'
import { flashcardsIAEstado } from '@/lib/flashcards/ia/api'
import { resumenesIAEstado } from '@/lib/resumenes/ia'
import { useCreditosIA } from '@/hooks/useCreditosIA'
import type { EstadosIA } from './DocumentoIAHub'
import { useSoltarDocumento } from '@/hooks/useSoltarDocumento'
import CapaSoltarDocumento from '@/components/ia/CapaSoltarDocumento'

// Studio: arrastrar un PDF, Word o PowerPoint a la página (o pulsar «Crear desde un documento») abre
// el popup unificado para sacar de él un mapa conceptual, flashcards y/o un resumen activo. Solo se
// ofrece si el servidor dice que alguna de las tres IA está disponible para esta cuenta (el permiso
// real lo valida siempre el servidor; ocultar esto no protege nada). Con los créditos encendidos, a
// quien tenga un plan activo; si no, a los admins, como antes.

const DocumentoIAHub = dynamic(() => import('./DocumentoIAHub'), { ssr: false })

export function useDocumentoIA() {
  const { profile } = useProfile()
  const creditos = useCreditosIA()
  const conIA = profile?.is_admin === true || (creditos.activo && !!creditos.saldo?.puede_usar)
  const [estados, setEstados] = useState<EstadosIA | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  useEffect(() => {
    if (!conIA) return
    let vivo = true
    void Promise.all([iaEstado(), flashcardsIAEstado(), resumenesIAEstado()]).then(([mapa, flashcards, resumenes]) => {
      if (vivo) setEstados({ mapa, flashcards, resumenes })
    })
    return () => {
      vivo = false
    }
  }, [conIA])

  const disponible = !!estados && (!!estados.mapa || !!estados.flashcards || !!estados.resumenes)
  // Arrastrar el archivo a cualquier parte de la página (o elegirlo con la tarjeta).
  const { arrastrando, rechazo, recibir } = useSoltarDocumento({ activo: disponible, bloqueado: archivo !== null, alSoltar: setArchivo })

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
      <CapaSoltarDocumento
        arrastrando={ia.arrastrando}
        rechazo={ia.rechazo}
        texto="Podrás elegir si hacer un mapa conceptual, flashcards o un resumen activo."
      />
      {ia.archivo && ia.estados ? <DocumentoIAHub archivo={ia.archivo} estados={ia.estados} onClose={() => ia.setArchivo(null)} /> : null}
    </>
  )
}
