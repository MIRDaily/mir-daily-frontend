import './globals.css'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import GlobalHeader from '@/components/GlobalHeader'
import { AppProviders } from '@/providers/AppProviders'

const lexend = localFont({
  src: [
    { path: '../../public/fonts/lexend/Lexend-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/lexend/Lexend-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/lexend/Lexend-Bold.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-lexend',
})

export const metadata: Metadata = {
  title: 'MIRDaily',
  description: 'Plataforma MIR',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={lexend.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap"
        />
      </head>
      <body className="font-display">
        <AppProviders>
          <GlobalHeader />
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
