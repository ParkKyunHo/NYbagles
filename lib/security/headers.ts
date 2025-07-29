import { NextResponse } from 'next/server'

export interface SecurityHeadersConfig {
  enableHSTS?: boolean
  enableCSP?: boolean
  enableXFrame?: boolean
  enableNoSniff?: boolean
  enableXSSProtection?: boolean
  enableReferrerPolicy?: boolean
  customCSP?: string
}

const defaultConfig: SecurityHeadersConfig = {
  enableHSTS: true,
  enableCSP: true,
  enableXFrame: true,
  enableNoSniff: true,
  enableXSSProtection: true,
  enableReferrerPolicy: true,
}

export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = defaultConfig
): NextResponse {
  // Strict-Transport-Security
  if (config.enableHSTS) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )
  }

  // Content-Security-Policy
  if (config.enableCSP) {
    const csp = config.customCSP || [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
    
    response.headers.set('Content-Security-Policy', csp)
  }

  // X-Frame-Options
  if (config.enableXFrame) {
    response.headers.set('X-Frame-Options', 'DENY')
  }

  // X-Content-Type-Options
  if (config.enableNoSniff) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }

  // X-XSS-Protection (legacy but still useful)
  if (config.enableXSSProtection) {
    response.headers.set('X-XSS-Protection', '1; mode=block')
  }

  // Referrer-Policy
  if (config.enableReferrerPolicy) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  }

  // Permissions-Policy (formerly Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(self), payment=()'
  )

  return response
}