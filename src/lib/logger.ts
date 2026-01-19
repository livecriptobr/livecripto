import { nanoid } from 'nanoid'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  requestId?: string
  userId?: string
  action?: string
  [key: string]: any
}

const SENSITIVE_KEYS = ['token', 'key', 'secret', 'password', 'authorization', 'cookie']

function sanitize(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj

  const result: any = Array.isArray(obj) ? [] : {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object') {
      result[key] = sanitize(value)
    } else {
      result[key] = value
    }
  }

  return result
}

export function createLogger(baseContext: LogContext = {}) {
  const requestId = baseContext.requestId || nanoid(10)

  const log = (level: LogLevel, message: string, data?: Record<string, any>) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      ...baseContext,
      message,
      ...(data ? sanitize(data) : {}),
    }

    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(JSON.stringify(entry))
  }

  return {
    info: (msg: string, data?: Record<string, any>) => log('info', msg, data),
    warn: (msg: string, data?: Record<string, any>) => log('warn', msg, data),
    error: (msg: string, data?: Record<string, any>) => log('error', msg, data),
    debug: (msg: string, data?: Record<string, any>) => log('debug', msg, data),
    requestId,
  }
}
