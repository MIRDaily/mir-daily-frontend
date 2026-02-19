'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import { getAvatarUrl } from '@/lib/avatar'
import { getOnboardingDeferredFlag } from '@/lib/onboarding'
import { supabase } from '@/lib/supabaseBrowser'
import NotificationsPopup from '@/components/NotificationsPopup'
import { useNotificationsContext } from '@/providers/NotificationsProvider'

type HeaderTab = 'studio' | 'daily' | 'dashboard' | null

type AppHeaderProps = {
  activeTab?: HeaderTab
  blurred?: boolean
  className?: string
}

function getNavClass(activeTab: HeaderTab, tab: Exclude<HeaderTab, null>) {
  if (activeTab === tab) {
    return 'relative text-[#E8A598] font-bold transition-colors pb-1'
  }
  return 'relative text-[#7D8A96] hover:text-[#E8A598] font-medium transition-colors pb-1'
}

export default function AppHeader({
  activeTab = null,
  blurred = false,
  className = '',
}: AppHeaderProps) {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const { unreadCount, refreshUnreadCount } = useNotificationsContext()
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [profileHref, setProfileHref] = useState('/profile')
  const notificationRef = useRef<HTMLDivElement | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationOpen(false)
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false)
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (!isNotificationOpen) return
    refreshUnreadCount({ debounced: true })
  }, [isNotificationOpen, refreshUnreadCount])

  useEffect(() => {
    setProfileHref(getOnboardingDeferredFlag() ? '/onboarding' : '/profile')
  }, [isProfileMenuOpen])

  return (
    <nav
      className={`sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-[#7D8A96]/10 px-6 py-4 transition-[filter] duration-500 ${
        blurred ? 'blur-[6px] pointer-events-none' : 'blur-0'
      } ${className}`.trim()}
    >
      <div className="relative max-w-7xl mx-auto flex items-center justify-between">
        <Link className="flex items-center gap-3 group" href="/dashboard">
          <div className="size-8 text-[#E8A598] flex items-center justify-center transition-transform group-hover:scale-105">
            <svg
              className="size-8"
              fill="currentColor"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#7D8A96] group-hover:text-[#E8A598] transition-colors">
            MIR<span className="text-[#E8A598]">Daily</span>
          </h1>
        </Link>
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link className={getNavClass(activeTab, 'studio')} href="/studio">
            {activeTab === 'studio' && (
              <motion.span
                layoutId="header-active-tab-indicator"
                className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-[#E8A598]"
                transition={{ type: 'spring', stiffness: 450, damping: 36 }}
              />
            )}
            Studio
          </Link>
          <Link className={getNavClass(activeTab, 'daily')} href="/dashboard">
            {activeTab === 'daily' && (
              <motion.span
                layoutId="header-active-tab-indicator"
                className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-[#E8A598]"
                transition={{ type: 'spring', stiffness: 450, damping: 36 }}
              />
            )}
            Daily
          </Link>
          <Link className={getNavClass(activeTab, 'dashboard')} href="/panel">
            {activeTab === 'dashboard' && (
              <motion.span
                layoutId="header-active-tab-indicator"
                className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-[#E8A598]"
                transition={{ type: 'spring', stiffness: 450, damping: 36 }}
              />
            )}
            Panel
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              aria-label="Notificaciones"
              aria-expanded={isNotificationOpen}
              onClick={() => {
                setIsProfileMenuOpen(false)
                setIsNotificationOpen((prev) => !prev)
              }}
              className={`relative size-10 rounded-full border-2 border-white shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] flex items-center justify-center transition-all duration-150 active:scale-95 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30 ${
                isNotificationOpen
                  ? 'text-[#E8A598] bg-[#FAF7F4] ring-2 ring-[#E8A598]/20'
                  : 'text-[#7D8A96] bg-white/90 hover:text-[#E8A598] hover:bg-[#FAF7F4] hover:ring-2 hover:ring-[#E8A598]/20 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(125,138,150,0.24),inset_0_1px_0_rgba(255,255,255,0.92)]'
              }`}
            >
              <span className="material-symbols-outlined text-[21px] leading-none">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#C4655A] rounded-full border border-white text-[10px] text-white font-bold leading-3 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <NotificationsPopup
              open={isNotificationOpen}
              onClose={() => setIsNotificationOpen(false)}
            />
          </div>
          <div className="relative ml-1" ref={profileMenuRef}>
            <button
              type="button"
              aria-label="Perfil"
              aria-expanded={isProfileMenuOpen}
              onClick={() => {
                setIsNotificationOpen(false)
                setIsProfileMenuOpen((prev) => !prev)
              }}
              className="flex w-[176px] items-center gap-2 rounded-full border-2 border-white shadow-[0_12px_26px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] cursor-pointer hover:ring-2 hover:ring-[#E8A598]/20 transition-all duration-150 active:scale-[0.98] active:translate-y-0 pl-1 pr-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30 bg-white/90 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(125,138,150,0.24),inset_0_1px_0_rgba(255,255,255,0.95)]"
            >
              <div className="size-10 rounded-full overflow-hidden">
                {profileLoading ? (
                  <div className="size-10 rounded-full bg-gray-200 animate-pulse" />
                ) : (
                  <Image
                    src={getAvatarUrl(profile?.avatar_id ?? 1)}
                    alt="Mi avatar"
                    title={profile?.display_name ?? 'Mi avatar'}
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                )}
              </div>
              {profileLoading ? (
                <span className="hidden sm:inline-block h-3 w-[108px] rounded-full bg-gray-200 animate-pulse" />
              ) : (
                <span className="hidden sm:inline-block w-[108px] truncate text-sm font-semibold text-[#4B5563]">
                  {profile?.display_name ?? 'Mi perfil'}
                </span>
              )}
            </button>
            <div className={`absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-soft border border-[#7D8A96]/10 transition-all duration-200 transform origin-top-right z-50 ${isProfileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
              <div className="py-1">
                <Link className="block px-4 py-2 text-sm text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#E8A598]" href={profileHref} onClick={() => setIsProfileMenuOpen(false)}>
                  Mi Perfil
                </Link>
                <a className="block px-4 py-2 text-sm text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#E8A598]" href="#" onClick={() => setIsProfileMenuOpen(false)}>
                  Configuración
                </a>
                <div className="border-t border-[#7D8A96]/10 my-1"></div>
                <button
                  onClick={async () => {
                    setIsProfileMenuOpen(false)
                    await supabase.auth.signOut()
                    router.replace('/auth')
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-[#C4655A] hover:bg-red-50 hover:text-[#B6544A] cursor-pointer transition-colors"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
