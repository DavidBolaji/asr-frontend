import crypto from 'crypto'

export function makeHmacHeaders(bodyStr: string): Record<string, string> {
  const secret = process.env.API_SECRET!
  const keyId = process.env.API_KEY_ID!
  const timestamp = (Date.now() / 1000).toFixed(3)
  const msg = Buffer.concat([Buffer.from(bodyStr), Buffer.from(timestamp)])
  const sig = crypto.createHmac('sha256', secret).update(msg).digest('hex')
  return {
    'Content-Type': 'application/vnd.api+json',
    'X-Api-Key-ID': keyId,
    'X-Signature': sig,
    'X-Timestamp': timestamp,
  }
}

export const API_URL = () => process.env.TRANSCRIPTION_API_URL!
