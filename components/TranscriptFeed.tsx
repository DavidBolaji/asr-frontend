'use client'

import { useEffect, useRef } from 'react'
import { MessageSquareText, Music4, Volume2, Waves } from 'lucide-react'
import type { TranscriptItem } from '@/lib/types'

interface TranscriptFeedProps {
  transcripts: TranscriptItem[]
  emptyMessage: string
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  let colorClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  if (confidence > 0.8) colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  else if (confidence > 0.5) colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {pct}%
    </span>
  )
}

function LanguageBadge({ language }: { language: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/25 uppercase tracking-wide">
      {language || 'unk'}
    </span>
  )
}

function AudioEventBadge({ eventType }: { eventType: string }) {
  const styleMap: Record<string, string> = {
    music_detected: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
    noise_detected: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    silence_detected: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
    language_unavailable: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
    unknown_audio: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wide ${styleMap[eventType] ?? styleMap.unknown_audio}`}>
      {eventType.replaceAll('_', ' ')}
    </span>
  )
}

function AudioEventIcon({ eventType }: { eventType: string }) {
  if (eventType === 'music_detected') return <Music4 className="w-4 h-4 text-violet-300" />
  if (eventType === 'noise_detected') return <Waves className="w-4 h-4 text-amber-300" />
  return <Volume2 className="w-4 h-4 text-slate-300" />
}

export default function TranscriptFeed({ transcripts, emptyMessage }: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (transcripts.length === 0) return
    // Auto-scroll to bottom when new items arrive
    const container = containerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcripts])

  if (transcripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-3">
        <MessageSquareText className="w-8 h-8 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="max-h-96 overflow-y-auto space-y-2 pr-1"
    >
      {transcripts.map((item, idx) => (
        item.kind === 'audio_event' ? (
          <div
            key={item.id}
            className="animate-[fadeSlideIn_0.3s_ease-out] rounded-xl bg-slate-800/40 border border-violet-500/20 p-4 hover:bg-slate-800/60 transition-colors"
            style={{ animationDelay: `${Math.min(idx * 20, 100)}ms` }}
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <AudioEventIcon eventType={item.eventType || 'unknown_audio'} />
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {formatTime(item.timestamp)}
              </span>
              {item.startTime !== undefined && item.endTime !== undefined && (
                <span className="text-xs text-slate-600 font-mono">
                  [{item.startTime.toFixed(1)}s – {item.endTime.toFixed(1)}s]
                </span>
              )}
              <AudioEventBadge eventType={item.eventType || 'unknown_audio'} />
            </div>
            <p className="text-slate-100 text-base leading-relaxed font-medium">
              {item.text}
            </p>
            {item.topLabel && (
              <p className="mt-2 text-xs text-slate-400 uppercase tracking-wide">
                {item.topLabel}
              </p>
            )}
          </div>
        ) : (
          <div
            key={item.id}
            className="animate-[fadeSlideIn_0.3s_ease-out] rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 hover:bg-slate-800/70 transition-colors"
            style={{ animationDelay: `${Math.min(idx * 20, 100)}ms` }}
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {formatTime(item.timestamp)}
              </span>
              {item.startTime !== undefined && item.endTime !== undefined && (
                <span className="text-xs text-slate-600 font-mono">
                  [{item.startTime.toFixed(1)}s – {item.endTime.toFixed(1)}s]
                </span>
              )}
              <ConfidenceBadge confidence={item.confidence} />
              <LanguageBadge language={item.language} />
            </div>
            <p className="text-slate-100 text-base leading-relaxed font-medium">
              {item.text}
            </p>
          </div>
        )
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
