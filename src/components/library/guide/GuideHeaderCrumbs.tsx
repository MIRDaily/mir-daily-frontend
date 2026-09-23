'use client'

import { useEffect } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

type GuideHeaderCrumbsProps = {
  subjectId: string
  subjectName: string
  current: string
}

// Ruta en la cabecera global, como en los mazos: ← Biblioteca / Asignatura / Guía.
export default function GuideHeaderCrumbs({ subjectId, subjectName, current }: GuideHeaderCrumbsProps) {
  const { setBackAction } = useHeaderUI()

  useEffect(() => {
    setBackAction({
      label: 'Biblioteca',
      href: '/library',
      trail: [{ label: subjectName, href: `/library/${subjectId}` }],
      current,
    })
    return () => setBackAction(null)
  }, [setBackAction, subjectId, subjectName, current])

  return null
}
