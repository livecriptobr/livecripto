import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const log = createLogger({ action: 'upload-avatar' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato nao suportado (JPEG/PNG/WebP)' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande (max 5MB)' }, { status: 400 })
    }

    const ext = EXT_MAP[file.type] || 'jpg'
    const filename = `${user.id}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/avatars/${filename}`

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: url },
    })

    log.info('Avatar uploaded', { userId: user.id, size: file.size })
    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao fazer upload'
    log.error('Avatar upload failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
