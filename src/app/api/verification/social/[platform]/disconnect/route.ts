import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const VALID_PLATFORMS = ['twitch', 'youtube', 'instagram']

interface RouteParams {
  params: Promise<{ platform: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const logger = createLogger({ action: 'disconnect-social' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { platform } = await params

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    await prisma.verification.deleteMany({
      where: { userId: user.id, type: platform },
    })

    logger.info('Social disconnected', { userId: user.id, platform })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Disconnect failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
