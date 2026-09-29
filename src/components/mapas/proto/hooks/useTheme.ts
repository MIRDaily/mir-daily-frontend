import { useUIStore } from '@/components/mapas/proto/store/ui.store'

export interface ThemeTokens {
  canvas: string
  bgPanel: string
  bgPanel2: string
  border: string
  border2: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentGreen: string
  danger: string
  warning: string
  shadow: string
  shadowLight: string
  glow: string        // accent-tinted rgba, used as shadow color in dark mode
  glowLight: string
  miniMapMask: string
  hoverBg: string
  kbd: string
  isDark: boolean
}

export const LIGHT: ThemeTokens = {
  canvas:        '#FAF7F4',
  bgPanel:       '#FFFFFF',
  bgPanel2:      '#F5F0EB',
  border:        '#EDE6DE',
  border2:       '#D4C8BE',
  textPrimary:   '#2A2420',
  textSecondary: '#7D8A96',
  textMuted:     '#ADBAC0',
  accent:        '#E8A598',
  accentGreen:   '#8BA89A',
  danger:        '#D4756A',
  warning:       '#C4944A',
  shadow:        'rgba(75,50,35,0.12)',
  shadowLight:   'rgba(75,50,35,0.06)',
  glow:          'rgba(75,50,35,0.12)',
  glowLight:     'rgba(75,50,35,0.06)',
  miniMapMask:   'rgba(250,247,244,0.75)',
  hoverBg:       '#F5EDE9',
  kbd:           '#EDE5DE',
  isDark:        false,
}

export const DARK: ThemeTokens = {
  canvas:        '#1C1815',
  bgPanel:       '#26211D',
  bgPanel2:      '#211D19',
  border:        '#3C3530',
  border2:       '#504840',
  textPrimary:   '#FAF7F4',
  textSecondary: '#B0A89E',
  textMuted:     '#7D8A96',
  accent:        '#E8A598',
  accentGreen:   '#8BA89A',
  danger:        '#D4756A',
  warning:       '#C4944A',
  shadow:        'rgba(0,0,0,0.45)',
  shadowLight:   'rgba(0,0,0,0.25)',
  glow:          'rgba(232,165,152,0.50)',
  glowLight:     'rgba(232,165,152,0.22)',
  miniMapMask:   'rgba(28,24,21,0.75)',
  hoverBg:       '#3C3530',
  kbd:           '#3C3530',
  isDark:        true,
}

export function useTheme(): ThemeTokens {
  const theme = useUIStore((s) => s.theme)
  return theme === 'dark' ? DARK : LIGHT
}
