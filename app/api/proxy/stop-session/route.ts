import { NextRequest, NextResponse } from 'next/server'
import { makeHmacHeaders, API_URL } from '@/lib/hmac'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    }

    // DELETE has no body — sign an empty string
    const headers = makeHmacHeaders('')

    const upstream = await fetch(`${API_URL()}/api/v1/sessions/${session_id}`, {
      method: 'DELETE',
      headers,
    })

    if (!upstream.ok && upstream.status !== 404) {
      console.warn(`[proxy/stop-session] backend returned ${upstream.status}`)
    }

    // Non-fatal — WebSocket disconnect already signals the server
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[proxy/stop-session] error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 })
  }
}
