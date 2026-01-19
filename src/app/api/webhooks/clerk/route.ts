import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { normalizeUsername, generateRandomSuffix, generateOverlayToken } from '@/lib/username'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses?.[0]?.email_address || ''
    const name = [first_name, last_name].filter(Boolean).join(' ') || undefined

    // Generate unique username
    const baseUsername = normalizeUsername(email.split('@')[0] || name || 'user')
    let username = baseUsername
    let attempts = 0

    while (attempts < 5) {
      const exists = await prisma.user.findUnique({ where: { username } })
      if (!exists) break
      username = `${baseUsername}-${generateRandomSuffix()}`
      attempts++
    }

    await prisma.user.create({
      data: {
        clerkUserId: id,
        email,
        username,
        displayName: name || username,
        overlayToken: generateOverlayToken(),
        alertSettings: {
          minAmountCents: 100,
          ttsEnabled: true,
          ttsVoice: 'pt-BR-Standard-A',
          ttsTemplate: '{nome} doou {valor}. {mensagem}',
          durationMs: 8000,
          blockedWords: [],
        },
      },
    })
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses?.[0]?.email_address
    const name = [first_name, last_name].filter(Boolean).join(' ') || undefined

    await prisma.user.updateMany({
      where: { clerkUserId: id },
      data: {
        ...(email && { email }),
        ...(name && { displayName: name }),
      },
    })
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data
    if (id) {
      await prisma.user.deleteMany({ where: { clerkUserId: id } })
    }
  }

  return NextResponse.json({ received: true })
}
