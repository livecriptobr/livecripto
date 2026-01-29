import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

interface GoogleTokenResponse {
  access_token: string
  token_type: string
}

interface YouTubeChannel {
  id: string
  snippet: {
    title: string
  }
}

interface YouTubeResponse {
  items?: YouTubeChannel[]
}

export async function GET(req: NextRequest) {
  const logger = createLogger({ action: 'youtube-callback' })

  try {
    const { searchParams } = req.nextUrl
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=missing_params`)
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/verification/social/youtube/callback`

    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      logger.error('Google token exchange failed', { status: tokenRes.status })
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=token_failed`)
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse

    // Get YouTube channel
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    )

    if (!channelRes.ok) {
      logger.error('YouTube channel fetch failed', { status: channelRes.status })
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=channel_failed`)
    }

    const channelData = (await channelRes.json()) as YouTubeResponse
    const channel = channelData.items?.[0]

    if (!channel) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=no_channel`)
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: state },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=user_not_found`)
    }

    await prisma.verification.upsert({
      where: { userId_type: { userId: user.id, type: 'youtube' } },
      create: {
        userId: user.id,
        type: 'youtube',
        status: 'approved',
        externalId: channel.id,
        externalName: channel.snippet.title,
      },
      update: {
        status: 'approved',
        externalId: channel.id,
        externalName: channel.snippet.title,
      },
    })

    logger.info('YouTube verified', { userId: user.id, channelId: channel.id })

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?success=youtube`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('YouTube callback failed', { error: msg })
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=callback_failed`)
  }
}
