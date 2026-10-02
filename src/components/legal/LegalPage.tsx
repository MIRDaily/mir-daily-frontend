import Link from 'next/link'

// BORRADOR: los textos legales de /privacidad y /aviso-legal son provisionales
// y tienen huecos [ASI]. Deben redactarse y revisarse por un profesional.
export const LEGAL_UPDATED = '2 de octubre de 2026'

export function Hueco({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-[#F6E3DF] px-1 font-semibold text-[#B87A6F]">
      [{children}]
    </mark>
  )
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-[#2D3748]">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export default function LegalPage({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F1EC] px-4 py-12 md:px-8">
      <article className="mx-auto max-w-3xl text-[15px] leading-relaxed text-[#4A5568] [&_a]:font-semibold [&_a]:text-[#B87A6F] [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc">
        <Link href="/" className="text-xs font-bold">
          ← Volver a MIRDaily
        </Link>
        <h1 className="mt-6 text-3xl font-black text-[#2D3748]">{titulo}</h1>
        <p className="mt-2 text-xs text-[#8C857E]">Última actualización: {LEGAL_UPDATED}</p>
        <p className="mt-6 rounded-xl border border-[#E8C9C2] bg-white/70 p-4 text-sm">
          Documento provisional en revisión. Los datos entre corchetes se completarán próximamente.
        </p>
        {children}
        <nav className="mt-14 flex gap-6 border-t border-[#E4DEDC] pt-6 text-xs">
          <Link href="/privacidad">Política de privacidad</Link>
          <Link href="/aviso-legal">Aviso legal</Link>
        </nav>
      </article>
    </div>
  )
}
