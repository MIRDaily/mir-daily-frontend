'use client'

import CreditosPerfil from '@/components/ia/CreditosPerfil'

// «Créditos de IA» del perfil (la cabecera la pone GlobalHeader: /profile ya está en shouldShowHeader).
export default function CreditosPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-70"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(56deg, rgba(232,165,152,0.07) 0 1px, transparent 1px 14px)',
            'repeating-linear-gradient(-56deg, rgba(125,138,150,0.05) 0 1px, transparent 1px 14px)',
          ].join(','),
        }}
      />
      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <CreditosPerfil />
      </main>
    </div>
  )
}
