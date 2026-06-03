import { NextRequest, NextResponse } from 'next/server'
import { makeHmacHeaders, API_URL } from '@/lib/hmac'

export async function POST(req: NextRequest) {
  try {
    const bodyStr = await req.text()
    const headers = makeHmacHeaders(bodyStr)

    const upstream = await fetch(`${API_URL()}/api/v1/sessions`, {
      method: 'POST',
      headers,
      body: bodyStr,
    })

    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err) {
    console.error('[proxy/sessions] error:', err)
    return NextResponse.json(
      { error: 'Failed to reach transcription backend' },
      { status: 502 }
    )
  }
}
