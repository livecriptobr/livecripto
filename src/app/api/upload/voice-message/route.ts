import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createLogger } from '@/lib/logger'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav']

export async function POST(req: NextRequest) {
  const log = createLogger({ action: 'upload-voice-message' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('audio') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de audio nao suportado' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande (max 2MB)' }, { status: 400 })
    }

    const ext = file.type === 'audio/webm' ? 'webm'
      : file.type === 'audio/ogg' ? 'ogg'
      : file.type === 'audio/mpeg' ? 'mp3'
      : 'wav'

    const filename = `voice-${randomUUID()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'voices')
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/voices/${filename}`
    log.info('Voice message uploaded', { filename, size: file.size })

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Upload failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
