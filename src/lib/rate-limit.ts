const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Limpar entradas antigas periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 60000)

export function rateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean
  remaining: number
  retryAfter?: number
} {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count }
}

// Legacy alias for backwards compatibility
export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const result = rateLimit(key, limit, windowMs)
  return { allowed: result.allowed, remaining: result.remaining }
}
