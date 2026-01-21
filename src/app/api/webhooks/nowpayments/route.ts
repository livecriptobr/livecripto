import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { DonationStatus, LedgerType, LedgerSource } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import { processWebhookOnce } from '@/lib/webhook-idempotency';
import { PaymentStatus, sortObject } from '@/lib/payments/nowpayments';

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '';

function verifySignature(payload: Record<string, unknown>, signature: string): boolean {
  if (!IPN_SECRET) return true; // Skip in dev if not configured

  const sorted = sortObject(payload);
  const jsonString = JSON.stringify(sorted);

  const hmac = crypto.createHmac('sha512', IPN_SECRET);
  hmac.update(jsonString);
  const calculatedSignature = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase()),
      Buffer.from(calculatedSignature.toLowerCase())
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const logger = createLogger({ action: 'nowpayments-webhook' });

  try {
    const signature = request.headers.get('x-nowpayments-sig') || '';
    const payload = await request.json();

    if (IPN_SECRET && !verifySignature(payload, signature)) {
      logger.warn('Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { payment_id, payment_status, order_id } = payload;

    logger.info(`Received webhook: ${payment_status} for order ${order_id}`);

    // Find donation by providerPaymentId or order_id
    const donation = await prisma.donation.findFirst({
      where: {
        OR: [
          { providerPaymentId: String(payment_id) },
          { id: order_id }
        ]
      },
      include: { user: true },
    });

    if (!donation) {
      logger.warn(`Donation not found for order ${order_id}`);
      return NextResponse.json({ received: true });
    }

    // Process webhook idempotently
    const result = await processWebhookOnce(
      'nowpayments',
      `${payment_id}_${payment_status}`,
      payload,
      async () => {
        // Update providerPaymentId if not set
        if (!donation.providerPaymentId) {
          await prisma.donation.update({
            where: { id: donation.id },
            data: { providerPaymentId: String(payment_id) },
          });
        }

        // Map NowPayments status to our status
        let newStatus: DonationStatus | null = null;

        switch (payment_status) {
          case PaymentStatus.FINISHED:
          case PaymentStatus.CONFIRMED:
            newStatus = DonationStatus.PAID;
            break;
          case PaymentStatus.FAILED:
          case PaymentStatus.REFUNDED:
            newStatus = DonationStatus.FAILED;
            break;
          case PaymentStatus.EXPIRED:
            newStatus = DonationStatus.EXPIRED;
            break;
          case PaymentStatus.WAITING:
          case PaymentStatus.CONFIRMING:
          case PaymentStatus.SENDING:
          case PaymentStatus.PARTIALLY_PAID:
            newStatus = DonationStatus.PENDING;
            break;
        }

        if (newStatus && donation.status !== newStatus) {
          await prisma.donation.update({
            where: { id: donation.id },
            data: {
              status: newStatus,
              paidAt: newStatus === DonationStatus.PAID ? new Date() : null,
            },
          });

          // If paid, create ledger entry and alert
          if (newStatus === DonationStatus.PAID) {
            await prisma.ledger.create({
              data: {
                userId: donation.userId,
                type: LedgerType.CREDIT,
                source: LedgerSource.DONATION,
                amountCents: donation.amountCents,
                referenceId: donation.id,
              },
            });

            await prisma.alert.create({
              data: {
                donationId: donation.id,
                userId: donation.userId,
              },
            });

            logger.info(`Donation ${donation.id} paid, alert created`);
          }
        }
      }
    );

    logger.info(`Webhook processed`, { alreadyProcessed: result.alreadyProcessed });
    return NextResponse.json({ received: true, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    logger.error('Webhook error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
