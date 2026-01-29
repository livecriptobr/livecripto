import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { DEFAULT_STATE } from '@/lib/control-commands'
import { addController, removeController } from '@/lib/control-broadcast'

const logger = createLogger({ action: 'control-stream' })

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const widget = await prisma.widget.findUnique({
    where: { token },
    select: { userId: true },
  })

  if (!widget) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userId = widget.userId
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      addController(userId, controller)

      const initialMsg = `data: ${JSON.stringify({ type: 'init', state: DEFAULT_STATE })}\n\n`
      controller.enqueue(new TextEncoder().encode(initialMsg))

      logger.info('SSE control stream connected', { userId })
    },
    cancel() {
      if (controllerRef) {
        removeController(userId, controllerRef)
      }
      logger.info('SSE control stream disconnected', { userId })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
