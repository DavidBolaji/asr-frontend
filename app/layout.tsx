import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Radio Live Transcription',
  description: 'Real-time speech transcription for radio streams and live audio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#06090f] min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
