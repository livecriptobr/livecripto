import { NextResponse } from 'next/server'

export class ApiError extends Error {
  retryAfter?: number

  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static badRequest(message: string) {
    return new ApiError(message, 400, 'BAD_REQUEST')
  }

  static unauthorized(message = 'Nao autorizado') {
    return new ApiError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Acesso negado') {
    return new ApiError(message, 403, 'FORBIDDEN')
  }

  static notFound(message = 'Nao encontrado') {
    return new ApiError(message, 404, 'NOT_FOUND')
  }

  static tooManyRequests(retryAfter?: number) {
    const error = new ApiError('Muitas requisicoes', 429, 'TOO_MANY_REQUESTS')
    error.retryAfter = retryAfter
    return error
  }
}

interface ErrorResponse {
  error: string
  code?: string
  retryAfter?: number
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const response: ErrorResponse = { error: error.message, code: error.code }
    if (error.retryAfter) {
      response.retryAfter = error.retryAfter
    }
    return NextResponse.json(response, { status: error.statusCode })
  }

  console.error('Unhandled error:', error)
  return NextResponse.json(
    { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
    { status: 500 }
  )
}
