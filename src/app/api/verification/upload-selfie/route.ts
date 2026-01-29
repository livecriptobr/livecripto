import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const logger = createLogger({ action: 'upload-selfie' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const formData = await req.formData()
    const selfie = formData.get('selfie') as File | null

    if (!selfie) {
      return NextResponse.json({ error: 'Selfie é obrigatória' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(selfie.type)) {
      return NextResponse.json({ error: 'Formato inválido. Use JPEG ou PNG.' }, { status: 400 })
    }
    if (selfie.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
    }

    // Check that identity verification exists with documents
    const existing = await prisma.verification.findUnique({
      where: { userId_type: { userId: user.id, type: 'identity' } },
    })
    if (!existing || !existing.documentUrl) {
      return NextResponse.json({ error: 'Envie o documento primeiro' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'verification', user.id)
    await mkdir(uploadDir, { recursive: true })

    const ext = selfie.type === 'image/png' ? 'png' : 'jpg'
    const fileName = `selfie-${Date.now()}.${ext}`
    const buffer = Buffer.from(await selfie.arrayBuffer())
    await writeFile(path.join(uploadDir, fileName), buffer)
    const selfieUrl = `/uploads/verification/${user.id}/${fileName}`

    const verification = await prisma.verification.update({
      where: { userId_type: { userId: user.id, type: 'identity' } },
      data: {
        selfieUrl,
        status: 'reviewing',
      },
    })

    logger.info('Selfie uploaded', { userId: user.id, verificationId: verification.id })

    return NextResponse.json({ success: true, verification })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Upload selfie failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
