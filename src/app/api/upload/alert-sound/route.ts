import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createLogger } from '@/lib/logger'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3']

export async function POST(req: NextRequest) {
  const log = createLogger({ action: 'upload-alert-sound' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('sound') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato nao suportado (mp3/wav)' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande (max 5MB)' }, { status: 400 })
    }

    const ext = file.type === 'audio/wav' ? 'wav' : 'mp3'
    const filename = `alert-${randomUUID()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'sounds')
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/sounds/${filename}`
    log.info('Alert sound uploaded', { filename, size: file.size })

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Upload failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
