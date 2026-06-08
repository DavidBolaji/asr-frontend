'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Radio,
  Play,
  Square,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
  ChevronDown,
  Volume2,
  VolumeX,
} from 'lucide-react'
import TranscriptFeed from './TranscriptFeed'
import type { TranscriptItem, StreamStatus } from '@/lib/types'
import { LANGUAGES, MODELS } from '@/lib/types'

function useElapsedTime(active: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (active) {
      startRef.current = Date.now()
      const tick = () => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (!active) setElapsed(0)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return fmt(elapsed)
}

function StatusBar({
  status,
  sessionId,
  elapsed,
  count,
}: {
  status: StreamStatus
  sessionId: string | null
  elapsed: string
  count: number
}) {
  const isLive = status === 'live'
  const isConnecting = status === 'connecting'

  return (
    <div className="flex items-center gap-4 flex-wrap text-sm text-slate-400">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        {isLive && (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 font-semibold text-xs uppercase tracking-widest">Live</span>
          </>
        )}
        {isConnecting && (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span className="text-sky-400 font-semibold text-xs uppercase tracking-widest">Connecting</span>
          </>
        )}
        {status === 'idle' && (
          <span className="text-slate-600 text-xs uppercase tracking-widest">Idle</span>
        )}
        {status === 'stopped' && (
          <span className="text-slate-500 text-xs uppercase tracking-widest">Stopped</span>
        )}
        {status === 'error' && (
          <span className="text-rose-400 text-xs uppercase tracking-widest">Error</span>
        )}
      </div>

      {sessionId && (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600">ID:</span>
          <code className="text-slate-300 text-xs bg-slate-800 px-2 py-0.5 rounded font-mono">
            {sessionId}
          </code>
        </div>
      )}

      {isLive && (
        <>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">{elapsed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>{count} segments</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function ScenarioA() {
  const [url, setUrl] = useState('')
  const [language, setLanguage] = useState('auto')
  const [model, setModel] = useState('base')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const elapsed = useElapsedTime(status === 'live')

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onclose = null
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const startStream = async () => {
    if (!url.trim()) {
      setError('Please enter a stream URL')
      return
    }

    setError(null)
    setTranscripts([])
    setSessionId(null)
    setStatus('connecting')

    // JSON:API request body per spec §3 Endpoint 1
    const body = JSON.stringify({
      jsonapi: { version: '1.1' },
      data: {
        type: 'sessions',
        attributes: {
          streamUrl: url.trim(),
          language: language === 'auto' ? null : language,
          model,
        },
      },
    })

    try {
      const res = await fetch('/api/proxy/sessions', {
        method: 'POST',
        body,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        const detail = err?.errors?.[0]?.detail || err.error || err.detail || `Server returned ${res.status}`
        throw new Error(detail)
      }

      // JSON:API response: data.data.id
      const data = await res.json()
      const sid: string = data?.data?.id

      if (!sid) {
        throw new Error('No session ID returned from server')
      }

      setSessionId(sid)

      // Connect directly to the backend WebSocket — Vercel's rewrite proxy does
      // not reliably forward WebSocket upgrade requests to external origins.
      const apiKey = process.env.NEXT_PUBLIC_WS_API_KEY ?? ''
      const wsBase = process.env.NEXT_PUBLIC_WS_BASE ?? (() => {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${proto}//${window.location.host}`
      })()
      const wsUrl = `${wsBase}/v1/listen?session_id=${sid}&api_key=${encodeURIComponent(apiKey)}`

      cleanup()
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        setStatus('live')
      }

      ws.onmessage = (evt) => {
        try {
          const frame = JSON.parse(typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data))

          if (frame.event === 'transcript_update') {
            const attrs = frame.data?.attributes ?? {}
            const item: TranscriptItem = {
              id: frame.data?.id ?? `${Date.now()}-${Math.random()}`,
              text: attrs.text || '',
              language: attrs.language || 'unk',
              timestamp: Date.now(),
              confidence: attrs.confidence ?? 0,
              startTime: attrs.startTime,
              endTime: attrs.endTime,
              kind: 'transcript',
            }
            if (item.text.trim()) {
              setTranscripts((prev) => [...prev, item])
            }
          } else if (frame.event === 'audio_event') {
            const attrs = frame.data?.attributes ?? {}
            const classification = attrs.audioClassification ?? {}
            const item: TranscriptItem = {
              id: frame.data?.id ?? `${Date.now()}-${Math.random()}`,
              text: attrs.message || 'Audio event received',
              language: classification.bucket || 'audio',
              timestamp: Date.now(),
              confidence: classification.topScore ?? 0,
              startTime: attrs.startTime,
              endTime: attrs.endTime,
              kind: 'audio_event',
              eventType: attrs.eventType || 'unknown_audio',
              topLabel: classification.topLabel,
            }
            setTranscripts((prev) => [...prev, item])
          } else if (frame.errors) {
            setError(frame.errors[0]?.detail || frame.errors[0]?.title || 'Transcription error')
            setStatus('error')
          } else if (frame.event === 'session_end') {
            setStatus('stopped')
          }
        } catch {
          // Ignore unparseable frames
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection failed')
        setStatus('error')
      }

      ws.onclose = (evt) => {
        if (status === 'live' || status === 'connecting') {
          if (evt.code !== 1000 && evt.code !== 1001) {
            setStatus('stopped')
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream')
      setStatus('error')
    }
  }

  const stopStream = async () => {
    cleanup()
    setStatus('stopped')

    if (sessionId) {
      // Best-effort stop call
      fetch('/api/proxy/stop-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {})
    }
  }

  const isLive = status === 'live'
  const isConnecting = status === 'connecting'
  const isActive = isLive || isConnecting

  return (
    <div
      className={`glass-card rounded-2xl p-6 md:p-8 space-y-6 transition-all duration-500 relative ${
        isLive ? 'glow-emerald border-emerald-500/20' : 'border-slate-800'
      }`}
    >
      {/* Top gradient bar when live */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`p-2.5 rounded-xl transition-colors ${
            isLive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Radio className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-slate-100 font-semibold text-lg">Radio Stream</h2>
          <p className="text-slate-500 text-sm">Server pulls audio from URL</p>
        </div>
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          Stream URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://stream.example.com/radio.mp3"
          disabled={isActive}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-mono"
        />
      </div>

      {/* Controls Row */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px] space-y-1.5">
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Language
          </label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isActive}
              className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm pr-9"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex-1 min-w-[140px] space-y-1.5">
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Model
          </label>
          <div className="relative">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isActive}
              className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm pr-9"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium opacity-0 select-none">
            Action
          </label>
          {!isActive ? (
            <button
              onClick={startStream}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg px-6 py-2.5 font-medium transition-all text-sm shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Stream
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg px-6 py-2.5 font-medium transition-all text-sm shadow-lg shadow-rose-900/30"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        status={status}
        sessionId={sessionId}
        elapsed={elapsed}
        count={transcripts.length}
      />

      {/* Audio Player */}
      {(isLive || status === 'stopped') && url && (
        <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3">
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.muted = !muted
              }
              setMuted((m) => !m)
            }}
            className="text-slate-400 hover:text-slate-100 transition-colors flex-shrink-0"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <audio
            ref={audioRef}
            src={url}
            autoPlay
            muted={muted}
            className="w-full h-7"
            style={{ accentColor: '#10b981' }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-rose-400 text-sm animate-[fadeSlideIn_0.2s_ease-out]">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Transcript Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Live Transcript
          </h3>
          {transcripts.length > 0 && (
            <button
              onClick={() => setTranscripts([])}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <TranscriptFeed
          transcripts={transcripts}
          emptyMessage="Waiting for audio stream to begin transcription…"
        />
      </div>
    </div>
  )
}
