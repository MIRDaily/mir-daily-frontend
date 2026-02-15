import './globals.css'
import type { Metadata } from 'next'
import { Lexend } from 'next/font/google'
import { NotificationsProvider } from '@/providers/NotificationsProvider'

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '900'],
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
        <NotificationsProvider>{children}</NotificationsProvider>
      </body>
    </html>
  )
}
