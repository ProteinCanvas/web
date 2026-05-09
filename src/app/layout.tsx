import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ProteinCanvas',
  description: 'Open-source visual analytics workbench for generative protein design',
  keywords: ['protein design', 'RFdiffusion', 'ProteinMPNN', 'BoltzGen', 'structural biology', 'visualization'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
