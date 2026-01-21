import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateTTS, buildTTSText, applyBlacklist } from '@/lib/tts'
import { uploadToBunny } from '@/lib/bunny'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { alertId } = await req.json()

  if (!alertId) {
    return NextResponse.json({ error: 'Missing alertId' }, { status: 400 })
  }

  try {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        donation: true,
        user: { select: { id: true, alertSettings: true } },
      },
    })

    if (!alert || !alert.donation) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    interface AlertSettings {
      ttsEnabled?: boolean
      ttsTemplate?: string
      ttsVoice?: string
      blockedWords?: string[]
    }
    const settings = alert.user.alertSettings as AlertSettings | null

    // Check if TTS is disabled
    if (!settings?.ttsEnabled) {
      await prisma.alert.update({
        where: { id: alertId },
        data: { status: 'READY', readyAt: new Date() },
      })
      return NextResponse.json({ success: true, audioUrl: null })
    }

    // Build text
    let text = buildTTSText(
      settings.ttsTemplate || '{nome} doou {valor}. {mensagem}',
      alert.donation
    )

    // Apply blacklist
    text = applyBlacklist(text, settings.blockedWords || [])

    // Generate audio
    const audioBuffer = await generateTTS({
      text,
      voice: settings.ttsVoice || 'pt-BR-Standard-A',
    })

    // Upload to Bunny
    const path = `tts/${alert.user.id}/${alert.id}.mp3`
    const audioUrl = await uploadToBunny({ path, content: audioBuffer })

    // Update alert
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        audioUrl,
        status: 'READY',
        readyAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, audioUrl })
  } catch (error) {
    console.error('TTS build error:', error)

    // Mark as READY but with error (show alert without audio)
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'READY',
        readyAt: new Date(),
        lastError: String(error),
      },
    })

    return NextResponse.json({ success: true, audioUrl: null, error: String(error) })
  }
}
