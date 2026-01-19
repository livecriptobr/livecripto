import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LiveCripto - Doacoes para Streamers',
  description: 'Receba doacoes via PIX, Cartao e Lightning Network',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
