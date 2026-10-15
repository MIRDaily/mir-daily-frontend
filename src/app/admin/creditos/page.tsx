'use client'

import CreditosAdmin from '@/components/admin/CreditosAdmin'

// Panel mínimo de créditos de IA (la cabecera la pone GlobalHeader: /admin ya está en shouldShowHeader).
export default function AdminCreditosPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F4] text-[#7D8A96]">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <CreditosAdmin />
      </main>
    </div>
  )
}
