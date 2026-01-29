import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const log = createLogger({ action: 'public-profile.get' })
  const { username } = await params

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Username obrigatorio' }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        primaryColor: true,
        backgroundColor: true,
        backgroundImageUrl: true,
        bio: true,
        socialLinks: true,
        donationPageTitle: true,
        isVerified: true,
        verificationLevel: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 })
    }

    log.info('Public profile fetched', { username })
    return NextResponse.json(user)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    log.error('Public profile fetch failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
