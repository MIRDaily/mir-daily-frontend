'use client'

import ProfileCard from '@/components/Profile/ProfileCard'
import AppHeader from '@/components/AppHeader'

export default function ProfilePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#2D3748]">
      <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[#E8A598]/15 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-[#7D8A96]/10 blur-3xl" />
      <AppHeader activeTab={null} />

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <ProfileCard />
      </main>
    </div>
  )
}
