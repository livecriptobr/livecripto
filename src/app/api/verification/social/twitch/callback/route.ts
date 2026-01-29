import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

interface TwitchUser {
  id: string
  login: string
  display_name: string
}

interface TwitchTokenResponse {
  access_token: string
  token_type: string
}

interface TwitchUsersResponse {
  data: TwitchUser[]
}

export async function GET(req: NextRequest) {
  const logger = createLogger({ action: 'twitch-callback' })

  try {
    const { searchParams } = req.nextUrl
    const code = searchParams.get('code')
    const state = searchParams.get('state') // clerkUserId

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=missing_params`)
    }

    const clientId = process.env.TWITCH_CLIENT_ID!
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/verification/social/twitch/callback`

    // Exchange code for token
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
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
      logger.error('Twitch token exchange failed', { status: tokenRes.status })
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=token_failed`)
    }

    const tokenData = (await tokenRes.json()) as TwitchTokenResponse

    // Get user info
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': clientId,
      },
    })

    if (!userRes.ok) {
      logger.error('Twitch user fetch failed', { status: userRes.status })
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=user_failed`)
    }

    const userData = (await userRes.json()) as TwitchUsersResponse
    const twitchUser = userData.data[0]

    if (!twitchUser) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=no_user`)
    }

    // Find user by clerkUserId (state)
    const user = await prisma.user.findUnique({
      where: { clerkUserId: state },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=user_not_found`)
    }

    await prisma.verification.upsert({
      where: { userId_type: { userId: user.id, type: 'twitch' } },
      create: {
        userId: user.id,
        type: 'twitch',
        status: 'approved',
        externalId: twitchUser.id,
        externalName: twitchUser.display_name,
      },
      update: {
        status: 'approved',
        externalId: twitchUser.id,
        externalName: twitchUser.display_name,
      },
    })

    logger.info('Twitch verified', { userId: user.id, twitchUser: twitchUser.login })

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?success=twitch`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Twitch callback failed', { error: msg })
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verifications?error=callback_failed`)
  }
}
