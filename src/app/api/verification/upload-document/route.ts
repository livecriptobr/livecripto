import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const logger = createLogger({ action: 'upload-document' })

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
    const documentFront = formData.get('documentFront') as File | null
    const documentBack = formData.get('documentBack') as File | null

    if (!documentFront) {
      return NextResponse.json({ error: 'Documento frente é obrigatório' }, { status: 400 })
    }

    // Validate front
    if (!ALLOWED_TYPES.includes(documentFront.type)) {
      return NextResponse.json({ error: 'Formato inválido. Use JPEG ou PNG.' }, { status: 400 })
    }
    if (documentFront.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
    }

    // Validate back if provided
    if (documentBack) {
      if (!ALLOWED_TYPES.includes(documentBack.type)) {
        return NextResponse.json({ error: 'Formato do verso inválido. Use JPEG ou PNG.' }, { status: 400 })
      }
      if (documentBack.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Arquivo do verso muito grande. Máximo 10MB.' }, { status: 400 })
      }
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'verification', user.id)
    await mkdir(uploadDir, { recursive: true })

    // Save front
    const frontExt = documentFront.type === 'image/png' ? 'png' : 'jpg'
    const frontFileName = `doc-front-${Date.now()}.${frontExt}`
    const frontBuffer = Buffer.from(await documentFront.arrayBuffer())
    await writeFile(path.join(uploadDir, frontFileName), frontBuffer)
    const frontUrl = `/uploads/verification/${user.id}/${frontFileName}`

    // Save back
    let backUrl: string | undefined
    if (documentBack) {
      const backExt = documentBack.type === 'image/png' ? 'png' : 'jpg'
      const backFileName = `doc-back-${Date.now()}.${backExt}`
      const backBuffer = Buffer.from(await documentBack.arrayBuffer())
      await writeFile(path.join(uploadDir, backFileName), backBuffer)
      backUrl = `/uploads/verification/${user.id}/${backFileName}`
    }

    const verification = await prisma.verification.upsert({
      where: { userId_type: { userId: user.id, type: 'identity' } },
      create: {
        userId: user.id,
        type: 'identity',
        status: 'pending',
        documentUrl: frontUrl,
        documentBackUrl: backUrl,
      },
      update: {
        status: 'pending',
        documentUrl: frontUrl,
        documentBackUrl: backUrl,
        selfieUrl: undefined,
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
      },
    })

    logger.info('Document uploaded', { userId: user.id, verificationId: verification.id })

    return NextResponse.json({ success: true, verification })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Upload document failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
