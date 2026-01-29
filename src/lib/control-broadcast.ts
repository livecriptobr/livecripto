import type { ControlCommand } from '@/lib/control-commands'

type ControllerStream = ReadableStreamDefaultController<Uint8Array>

const userControllers = new Map<string, Set<ControllerStream>>()

export function broadcastToUser(userId: string, command: ControlCommand): void {
  const controllers = userControllers.get(userId)
  if (!controllers || controllers.size === 0) return

  const data = `data: ${JSON.stringify(command)}\n\n`
  const encoded = new TextEncoder().encode(data)

  for (const controller of controllers) {
    try {
      controller.enqueue(encoded)
    } catch {
      controllers.delete(controller)
    }
  }
}

export function addController(userId: string, controller: ControllerStream): void {
  if (!userControllers.has(userId)) {
    userControllers.set(userId, new Set())
  }
  userControllers.get(userId)!.add(controller)
}

export function removeController(userId: string, controller: ControllerStream): void {
  const controllers = userControllers.get(userId)
  if (controllers) {
    controllers.delete(controller)
    if (controllers.size === 0) {
      userControllers.delete(userId)
    }
  }
}
