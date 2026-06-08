export interface TranscriptItem {
  id: string
  text: string
  language: string
  timestamp: number
  confidence: number
  startTime?: number
  endTime?: number
  kind?: 'transcript' | 'audio_event'
  eventType?: string
  topLabel?: string
}

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'error' | 'stopped'
export type RecordingStatus = 'idle' | 'connecting' | 'ready' | 'recording' | 'error' | 'stopped'

export const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'ti', label: 'Tigrinya' },
  { value: 'ar', label: 'Arabic' },
  { value: 'am', label: 'Amharic' },
  { value: 'so', label: 'Somali' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
]

export const MODELS = [
  { value: 'base', label: 'Base (Fast)' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (Accurate)' },
  { value: 'large-v2', label: 'Large v2' },
  { value: 'large-v3', label: 'Large v3' },
]
