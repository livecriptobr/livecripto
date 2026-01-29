import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const log = createLogger({ action: 'check-username' })

  const username = req.nextUrl.searchParams.get('username')

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Username obrigatorio' }, { status: 400 })
  }

  const clean = username.toLowerCase().replace(/[^a-z0-9-]/g, '')

  if (clean.length < 3) {
    return NextResponse.json({ available: false, username: clean, reason: 'Minimo 3 caracteres' })
  }

  const reserved = ['admin', 'api', 'dashboard', 'login', 'signup', 'sign-in', 'sign-up', 'checkout', 'overlay', 'donate']
  if (reserved.includes(clean)) {
    return NextResponse.json({ available: false, username: clean, reason: 'Username reservado' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username: clean } })
    const available = !existing

    log.info('Username check', { username: clean, available })
    return NextResponse.json({ available, username: clean })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    log.error('Username check failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
