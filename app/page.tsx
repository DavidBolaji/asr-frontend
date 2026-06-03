'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Radio, Mic, Waves, Zap } from 'lucide-react'

// Dynamic imports to avoid SSR issues with Web APIs (AudioContext, WebSocket)
const ScenarioA = dynamic(() => import('@/components/ScenarioA'), { ssr: false })
const ScenarioB = dynamic(() => import('@/components/ScenarioB'), { ssr: false })

type Tab = 'radio' | 'microphone'

function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Top-left emerald orb */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
      {/* Top-right sky orb */}
      <div className="absolute -top-20 right-0 w-80 h-80 bg-sky-600/6 rounded-full blur-3xl" />
      {/* Bottom-center indigo orb */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rem] h-64 bg-indigo-600/5 rounded-full blur-3xl" />
      {/* Middle-right rose orb (subtle) */}
      <div className="absolute top-1/2 -right-20 w-72 h-72 bg-rose-600/5 rounded-full blur-3xl" />
    </div>
  )
}

function GridPattern() {
  return (
    <div
      className="fixed inset-0 pointer-events-none opacity-[0.025]"
      aria-hidden
      style={{
        backgroundImage: `
          linear-gradient(rgba(148, 163, 184, 0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
    />
  )
}

function Header() {
  return (
    <div className="text-center space-y-4 mb-10">
      {/* Logo mark */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/20 mb-2">
        <Waves className="w-8 h-8 text-emerald-400" />
      </div>

      <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
          <span className="gradient-text">Radio Live</span>
          <br />
          <span className="text-slate-100">Transcription</span>
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-md mx-auto leading-relaxed">
          Real-time speech-to-text for radio streams and live audio,
          with support for Tigrinya, Arabic, Amharic, and more.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {[
          { icon: Zap, label: 'Low Latency' },
          { icon: Waves, label: 'Multi-language' },
          { icon: Radio, label: 'Stream Ready' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700/60 text-slate-400"
          >
            <Icon className="w-3 h-3" />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function TabSwitcher({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/70 border border-slate-800 mb-8 w-full max-w-sm mx-auto">
      <button
        onClick={() => onChange('radio')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          active === 'radio'
            ? 'bg-slate-700 text-slate-100 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <Radio className="w-4 h-4" />
        Radio Stream
      </button>
      <button
        onClick={() => onChange('microphone')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          active === 'microphone'
            ? 'bg-slate-700 text-slate-100 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <Mic className="w-4 h-4" />
        Live Mic
      </button>
    </div>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('radio')

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <GridPattern />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 md:py-16">
        <Header />

        <TabSwitcher active={activeTab} onChange={setActiveTab} />

        {/* Tab panels */}
        <div className="relative">
          {activeTab === 'radio' && (
            <div className="animate-[fadeSlideIn_0.25s_ease-out]">
              <ScenarioA />
            </div>
          )}
          {activeTab === 'microphone' && (
            <div className="animate-[fadeSlideIn_0.25s_ease-out]">
              <ScenarioB />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-slate-700 text-xs space-y-1">
          <p>Radio Live Transcription &mdash; powered by Whisper ASR</p>
          <p>
            Supports Tigrinya · Arabic · Amharic · Somali · English and more
          </p>
        </footer>
      </div>
    </div>
  )
}
