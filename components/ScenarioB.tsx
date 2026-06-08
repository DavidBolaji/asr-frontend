'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic,
  MicOff,
  AlertCircle,
  Loader2,
  ChevronDown,
  FileText,
  Clock,
} from 'lucide-react'
import TranscriptFeed from './TranscriptFeed'
import type { TranscriptItem, RecordingStatus } from '@/lib/types'
import { LANGUAGES } from '@/lib/types'

const PCM_WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true
    const out = new Int16Array(ch.length)
    for (let i = 0; i < ch.length; i++) {
      out[i] = Math.max(-1, Math.min(1, ch[i])) * (ch[i] < 0 ? 32768 : 32767)
    }
    this.port.postMessage(out.buffer, [out.buffer])
    return true
  }
}
registerProcessor('pcm-proc', PCMProcessor)
`

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

function AudioVisualizer({ level, active }: { level: number; active: boolean }) {
  const BAR_COUNT = 20

  return (
    <div className="flex items-end justify-center gap-1 h-10">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        // Create wave-like distribution with center bars taller
        const centerDist = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2)
        const baseHeight = (1 - centerDist * 0.6) * 100
        const noiseOffset = (Math.sin(i * 2.5) * 0.3 + 0.7)
        const activeHeight = active ? Math.max(15, (level / 100) * baseHeight * noiseOffset) : 15
        const heightPct = activeHeight

        return (
          <div
            key={i}
            className={`rounded-full transition-all ${
              active ? 'bg-gradient-to-t from-rose-600 to-rose-400' : 'bg-slate-700'
            }`}
            style={{
              width: '4px',
              height: `${Math.max(4, (heightPct / 100) * 40)}px`,
              animationDelay: `${i * 40}ms`,
              transition: active ? 'height 100ms ease-out' : 'height 300ms ease-out',
            }}
          />
        )
      })}
    </div>
  )
}

function MicButton({
  status,
  onClick,
}: {
  status: RecordingStatus
  onClick: () => void
}) {
  const isRecording = status === 'recording'
  const isConnecting = status === 'connecting' || status === 'ready'


  return (
    <div className="relative flex items-center justify-center">
      {/* Pulsing ring when recording */}
      {isRecording && (
        <>
          <span className="absolute inline-flex h-28 w-28 rounded-full bg-rose-500 opacity-10 animate-[pulse-ring_1.5s_cubic-bezier(0.215,0.61,0.355,1)_infinite]" />
          <span className="absolute inline-flex h-24 w-24 rounded-full bg-rose-500 opacity-15 animate-[pulse-ring_1.5s_cubic-bezier(0.215,0.61,0.355,1)_0.3s_infinite]" />
        </>
      )}

      <button
        onClick={onClick}
        disabled={isConnecting}
        className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl
          ${isRecording
            ? 'bg-rose-600 hover:bg-rose-500 glow-rose scale-110 shadow-rose-900/50'
            : isConnecting
            ? 'bg-slate-700 cursor-not-allowed opacity-70'
            : 'bg-slate-700 hover:bg-emerald-600 hover:scale-105 shadow-slate-900/50 hover:shadow-emerald-900/40'
          }`}
      >
        {isConnecting ? (
          <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-8 h-8 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-slate-300" />
        )}
      </button>
    </div>
  )
}

function StatusLabel({ status }: { status: RecordingStatus }) {
  switch (status) {
    case 'idle':
      return <span className="text-slate-500 text-sm">Click to start recording</span>
    case 'connecting':
      return <span className="text-sky-400 text-sm animate-pulse">Creating session…</span>
    case 'ready':
      return <span className="text-amber-400 text-sm animate-pulse">Starting microphone…</span>
    case 'recording':
      return (
        <span className="flex items-center gap-2 text-rose-400 text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          Recording live
        </span>
      )
    case 'stopped':
      return <span className="text-slate-500 text-sm">Session ended — click to record again</span>
    case 'error':
      return <span className="text-rose-400 text-sm">Error — click to try again</span>
    default:
      return null
  }
}

export default function ScenarioB() {
  const [language, setLanguage] = useState('auto')
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const pcmBufferRef = useRef<Uint8Array>(new Uint8Array(0))
  const sessionReadyRef = useRef(false)

  const elapsed = useElapsedTime(status === 'recording')

  const cleanupAudio = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    pcmBufferRef.current = new Uint8Array(0)
    setAudioLevel(0)
  }, [])

  const cleanupWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onclose = null
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close(1000, 'User stopped')
      }
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupWs()
      cleanupAudio()
    }
  }, [cleanupWs, cleanupAudio])

  const startAudioCapture = useCallback(async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = ctx

      // Create worklet from inline blob
      const blob = new Blob([PCM_WORKLET_CODE], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      const source = ctx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(ctx, 'pcm-proc')
      workletNodeRef.current = workletNode

      workletNode.port.onmessage = (evt: MessageEvent) => {
        if (ws.readyState !== WebSocket.OPEN) return

        const samples = new Int16Array(evt.data as ArrayBuffer)

        // Compute RMS for audio level visualizer
        let sum = 0
        for (let i = 0; i < samples.length; i++) {
          sum += (samples[i] / 32768) ** 2
        }
        const rms = Math.sqrt(sum / samples.length)
        setAudioLevel(Math.min(100, Math.round(rms * 400)))

        // Accumulate bytes
        const incoming = new Uint8Array(samples.buffer)
        const merged = new Uint8Array(pcmBufferRef.current.length + incoming.length)
        merged.set(pcmBufferRef.current, 0)
        merged.set(incoming, pcmBufferRef.current.length)
        pcmBufferRef.current = merged

        // Send when we have at least 8000 bytes
        if (pcmBufferRef.current.byteLength >= 8000) {
          ws.send(pcmBufferRef.current.buffer as ArrayBuffer)
          pcmBufferRef.current = new Uint8Array(0)
        }
      }

      source.connect(workletNode)
      workletNode.connect(ctx.destination)

      setStatus('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone')
      setStatus('error')
      cleanupAudio()
    }
  }, [cleanupAudio])

  const startRecording = async () => {
    if (status === 'connecting' || status === 'ready') return
    setError(null)
    setTranscripts([])
    sessionReadyRef.current = false
    setStatus('connecting')

    try {
      // JSON:API request body per spec §4 Endpoint 3
      const body = JSON.stringify({
        jsonapi: { version: '1.1' },
        data: {
          type: 'client-sessions',
          attributes: {
            deviceName: 'Web Browser',
            samplingRate: 16000,
            audioFormat: 'audio/x-raw',
            language: language === 'auto' ? null : language,
          },
        },
      })

      const res = await fetch('/api/proxy/client-sessions', {
        method: 'POST',
        body,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        const detail = err?.errors?.[0]?.detail || err.error || err.detail || `Server returned ${res.status}`
        throw new Error(detail)
      }

      // JSON:API response: data.data.attributes
      const data = await res.json()
      const handshakeToken: string = data?.data?.attributes?.handshakeToken
      const webSocketUrl: string = data?.data?.attributes?.webSocketUrl

      if (!handshakeToken || !webSocketUrl) {
        throw new Error('Server response missing handshakeToken or webSocketUrl')
      }

      cleanupWs()
      const ws = new WebSocket(webSocketUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Send handshake token as first text frame
        ws.send(handshakeToken)
        setStatus('ready')
      }

      ws.onmessage = async (evt) => {
        try {
          const frame = JSON.parse(typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data as ArrayBuffer))

          if (frame.event === 'session_ready') {
            if (!sessionReadyRef.current) {
              sessionReadyRef.current = true
              await startAudioCapture(ws)
            }
          } else if (frame.event === 'transcript_update') {
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
            setError(frame.errors[0]?.detail || frame.errors[0]?.title || 'Transcription error from server')
            setStatus('error')
            cleanupAudio()
          } else if (frame.event === 'session_end') {
            setStatus('stopped')
            cleanupAudio()
          }
        } catch {
          // Ignore unparseable frames
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection failed')
        setStatus('error')
        cleanupAudio()
      }

      ws.onclose = (evt) => {
        if (evt.code !== 1000 && evt.code !== 1001) {
          setStatus((prev) =>
            prev === 'recording' || prev === 'ready' || prev === 'connecting' ? 'stopped' : prev
          )
        }
        cleanupAudio()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording')
      setStatus('error')
      cleanupAudio()
    }
  }

  const stopRecording = () => {
    cleanupAudio()
    cleanupWs()
    setStatus('stopped')
    setAudioLevel(0)
  }

  const handleMicClick = () => {
    if (status === 'recording') {
      stopRecording()
    } else if (status !== 'connecting' && status !== 'ready') {
      startRecording()
    }
  }

  const isRecording = status === 'recording'
  const isActive = status === 'recording' || status === 'connecting' || status === 'ready'

  return (
    <div
      className={`glass-card rounded-2xl p-6 md:p-8 space-y-6 transition-all duration-500 relative ${
        isRecording ? 'glow-rose border-rose-500/20' : 'border-slate-800'
      }`}
    >
      {/* Top gradient bar when recording */}
      {isRecording && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`p-2.5 rounded-xl transition-colors ${
            isRecording ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Mic className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-slate-100 font-semibold text-lg">Live Microphone</h2>
          <p className="text-slate-500 text-sm">Browser captures and streams audio</p>
        </div>
      </div>

      {/* Language Select */}
      <div className="max-w-xs space-y-1.5">
        <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          Language
        </label>
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isActive}
            className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm pr-9"
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

      {/* Central mic area */}
      <div className="flex flex-col items-center gap-5 py-6">
        <MicButton status={status} onClick={handleMicClick} />

        <StatusLabel status={status} />

        {/* Elapsed time when recording */}
        {isRecording && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{elapsed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>{transcripts.length} segments</span>
            </div>
          </div>
        )}

        {/* Audio visualizer */}
        <AudioVisualizer level={audioLevel} active={isRecording} />
      </div>

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
          emptyMessage="Press the microphone button to start transcribing…"
        />
      </div>
    </div>
  )
}
