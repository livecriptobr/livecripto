import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

interface TenorMedia {
  gif: { url: string; dims: [number, number] }
  tinygif: { url: string; dims: [number, number] }
}

interface TenorResult {
  id: string
  media_formats: TenorMedia
}

interface TenorResponse {
  results: TenorResult[]
}

interface GifItem {
  id: string
  url: string
  previewUrl: string
  width: number
  height: number
}

export async function GET(req: NextRequest) {
  const log = createLogger({ action: 'gif-search' })

  try {
    const q = req.nextUrl.searchParams.get('q')
    const limit = req.nextUrl.searchParams.get('limit') || '20'

    if (!q) {
      return NextResponse.json({ error: 'Query obrigatoria' }, { status: 400 })
    }

    const apiKey = process.env.TENOR_API_KEY
    if (!apiKey) {
      log.error('TENOR_API_KEY not configured')
      return NextResponse.json({ error: 'GIF search not configured' }, { status: 503 })
    }

    const url = new URL('https://tenor.googleapis.com/v2/search')
    url.searchParams.set('q', q)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('limit', limit)
    url.searchParams.set('media_filter', 'gif,tinygif')
    url.searchParams.set('locale', 'pt_BR')

    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Tenor API returned ${res.status}`)
    }

    const data: TenorResponse = await res.json()

    const gifs: GifItem[] = data.results.map((r) => ({
      id: r.id,
      url: r.media_formats.gif.url,
      previewUrl: r.media_formats.tinygif.url,
      width: r.media_formats.gif.dims[0],
      height: r.media_formats.gif.dims[1],
    }))

    return NextResponse.json(gifs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('GIF search failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
