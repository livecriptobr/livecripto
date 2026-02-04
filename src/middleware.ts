import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/private(.*)',
])

const isWebhookRoute = createRouteMatcher([
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/api/internal(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Skip Clerk entirely for webhooks, cron, and internal routes
  if (isWebhookRoute(req)) {
    return NextResponse.next()
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
