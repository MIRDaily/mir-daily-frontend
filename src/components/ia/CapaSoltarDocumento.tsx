'use client'

// La capa de «suelta el documento aquí» (a pantalla completa mientras se arrastra un archivo) y el aviso
// de formato no válido. Va a nivel de página, fuera de los bloques con transformaciones. Ver
// useSoltarDocumento.

export default function CapaSoltarDocumento({
  arrastrando,
  rechazo,
  texto,
}: {
  arrastrando: boolean
  rechazo: string | null
  /** Qué pasará al soltar, p. ej. «Se creará un mapa conceptual con IA». */
  texto: string
}) {
  return (
    <>
      {arrastrando && (
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
            <p className="text-sm text-[#7D8A96]">{texto}</p>
          </div>
        </div>
      )}
      {rechazo && (
        <p
          role="alert"
          className="fixed bottom-6 left-1/2 z-[95] max-w-[90vw] -translate-x-1/2 rounded-2xl border border-[#D4667A]/30 bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E] shadow-lg"
        >
          {rechazo}
        </p>
      )}
    </>
  )
}
