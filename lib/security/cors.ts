import { NextRequest, NextResponse } from 'next/server'

export interface CORSConfig {
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  exposedHeaders?: string[]
  credentials: boolean
  maxAge?: number
}

const defaultConfig: CORSConfig = {
  allowedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
}

export function corsMiddleware(
  req: NextRequest,
  res: NextResponse,
  config: Partial<CORSConfig> = {}
): NextResponse {
  const corsConfig = { ...defaultConfig, ...config }
  const origin = req.headers.get('origin') || ''

  // Check if origin is allowed
  const isAllowedOrigin = corsConfig.allowedOrigins.includes('*') || 
    corsConfig.allowedOrigins.includes(origin)

  if (isAllowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', origin)
  }

  // Set other CORS headers
  res.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig.allowedMethods.join(', ')
  )
  
  res.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig.allowedHeaders.join(', ')
  )

  if (corsConfig.exposedHeaders && corsConfig.exposedHeaders.length > 0) {
    res.headers.set(
      'Access-Control-Expose-Headers',
      corsConfig.exposedHeaders.join(', ')
    )
  }

  if (corsConfig.credentials) {
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  if (corsConfig.maxAge) {
    res.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString())
  }

  return res
}

// Helper function for API routes
export function handleCORS(req: NextRequest): NextResponse | null {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    return corsMiddleware(req, response)
  }
  
  return null
}