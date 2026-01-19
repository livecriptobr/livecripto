import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { donateInitSchema } from '@/lib/validation'
import { sanitizeMessage, containsBlockedWord } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/rate-limit'
import { createPixCharge } from '@/lib/payments/openpix'
import { createLightningInvoice } from '@/lib/payments/coinsnap'
import { createCheckoutPreference } from '@/lib/payments/mercadopago'
import { convertBrlToUsd } from '@/lib/payments/currency'

// Check if real providers are configured
const USE_REAL_OPENPIX = !!process.env.OPENPIX_APP_ID
const USE_REAL_COINSNAP = !!process.env.COINSNAP_API_KEY && !!process.env.COINSNAP_STORE_ID
const USE_REAL_MERCADOPAGO = !!process.env.MERCADOPAGO_ACCESS_TOKEN

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    const body = await req.json()
    const parsed = donateInitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { username, amountCents, donorName, message, method } = parsed.data

    // Rate limit
    const rateLimitKey = `donate:${ip}:${username}`
    const rateCheck = checkRateLimit(rateLimitKey, 5, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento.' },
        { status: 429 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, alertSettings: true, displayName: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 })
    }

    const settings = user.alertSettings as Record<string, unknown>

    // Check min amount
    const minAmount = (settings?.minAmountCents as number) || 100
    if (amountCents < minAmount) {
      return NextResponse.json({ error: 'Valor abaixo do minimo' }, { status: 400 })
    }

    // Sanitize and check blacklist
    const sanitizedMessage = sanitizeMessage(message)
    const blockedWords = (settings?.blockedWords as string[]) || []
    if (containsBlockedWord(sanitizedMessage, blockedWords)) {
      return NextResponse.json({ error: 'Mensagem contem palavras bloqueadas' }, { status: 400 })
    }

    // Map method to provider
    const providerMap: Record<string, 'OPENPIX' | 'MERCADOPAGO' | 'COINSNAP'> = {
      pix: 'OPENPIX',
      card: 'MERCADOPAGO',
      lightning: 'COINSNAP',
    }

    // Create donation
    const donation = await prisma.donation.create({
      data: {
        userId: user.id,
        donorName: donorName.trim(),
        message: sanitizedMessage,
        amountCents,
        paymentProvider: providerMap[method],
        status: 'CREATED',
      },
    })

    // PIX via OpenPix
    if (method === 'pix') {
      if (USE_REAL_OPENPIX) {
        try {
          const charge = await createPixCharge({
            correlationID: donation.id,
            value: amountCents, // OpenPix expects cents
            comment: `Doacao para ${user.displayName || username}`,
            expiresIn: 900, // 15 minutes
          })

          // Update donation status to pending
          await prisma.donation.update({
            where: { id: donation.id },
            data: { status: 'PENDING' },
          })

          return NextResponse.json({
            donationId: donation.id,
            method: 'pix',
            qrCode: charge.qrCode,
            copyPaste: charge.copyPaste,
            expiresAt: charge.expiresAt,
          })
        } catch (error) {
          console.error('OpenPix charge creation failed:', error)
          // Fall through to mock response
        }
      }

      // Mock response for development
      return NextResponse.json({
        donationId: donation.id,
        method: 'pix',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        copyPaste: '00020126580014BR.GOV.BCB.PIX0136mock-pix-key-here',
        mock: true,
      })
    }

    // Card via MercadoPago
    if (method === 'card') {
      if (USE_REAL_MERCADOPAGO) {
        try {
          const preference = await createCheckoutPreference({
            donationId: donation.id,
            title: `Doacao para ${user.displayName || username}`,
            amountBrl: amountCents / 100, // MercadoPago expects reais, not cents
          })

          // Update donation with preference ID and status
          await prisma.donation.update({
            where: { id: donation.id },
            data: {
              providerPaymentId: preference.preferenceId,
              status: 'PENDING',
            },
          })

          return NextResponse.json({
            donationId: donation.id,
            method: 'card',
            redirectUrl: preference.redirectUrl,
            preferenceId: preference.preferenceId,
          })
        } catch (error) {
          console.error('MercadoPago preference creation failed:', error)
          // Fall through to mock response
        }
      }

      // Mock response for development
      return NextResponse.json({
        donationId: donation.id,
        method: 'card',
        redirectUrl: '/checkout/return?status=pending&id=' + donation.id,
        mock: true,
      })
    }

    // Lightning via Coinsnap
    if (method === 'lightning') {
      if (USE_REAL_COINSNAP) {
        try {
          // Convert BRL to USD for Lightning (Coinsnap uses USD)
          const amountUsdCents = await convertBrlToUsd(amountCents)

          const invoice = await createLightningInvoice({
            amount: amountUsdCents / 100, // Coinsnap expects dollars
            currency: 'USD',
            orderId: donation.id,
            redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=success&id=${donation.id}`,
            metadata: {
              donorName: donorName.trim(),
              recipientUsername: username,
            },
          })

          // Update donation with invoice ID and status
          await prisma.donation.update({
            where: { id: donation.id },
            data: {
              providerPaymentId: invoice.invoiceId,
              status: 'PENDING',
            },
          })

          return NextResponse.json({
            donationId: donation.id,
            method: 'lightning',
            invoice: invoice.bolt11,
            qrCode: invoice.qrCode,
            expiresAt: invoice.expiresAt,
          })
        } catch (error) {
          console.error('Coinsnap invoice creation failed:', error)
          // Fall through to mock response
        }
      }

      // Mock response for development
      return NextResponse.json({
        donationId: donation.id,
        method: 'lightning',
        invoice: 'lnbc1mock...',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mock: true,
      })
    }

    return NextResponse.json({ error: 'Metodo invalido' }, { status: 400 })
  } catch (error) {
    console.error('Donate init error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
