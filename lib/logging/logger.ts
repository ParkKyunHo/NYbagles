import { NextRequest } from 'next/server'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  userId?: string
  requestId?: string
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  error?: Error
  metadata?: Record<string, any>
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.logLevel]
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const baseLog = {
      timestamp,
      level,
      message,
      ...context,
    }

    if (this.isDevelopment) {
      // Pretty print for development
      const color = this.getColor(level)
      return `${color}[${timestamp}] ${level.toUpperCase()}: ${message}${this.reset()}`
    }

    // JSON format for production
    return JSON.stringify(baseLog)
  }

  private getColor(level: LogLevel): string {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m', // Magenta
    }
    return colors[level]
  }

  private reset(): string {
    return '\x1b[0m'
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context))
    }
  }

  fatal(message: string, context?: LogContext) {
    if (this.shouldLog('fatal')) {
      console.error(this.formatMessage('fatal', message, context))
    }
  }

  // Log HTTP requests
  logRequest(req: NextRequest, res: { status: number }, duration: number) {
    const context: LogContext = {
      method: req.method,
      path: req.nextUrl.pathname,
      statusCode: res.status,
      duration,
      metadata: {
        userAgent: req.headers.get('user-agent'),
        referer: req.headers.get('referer'),
      },
    }

    const level = res.status >= 500 ? 'error' : res.status >= 400 ? 'warn' : 'info'
    const message = `${req.method} ${req.nextUrl.pathname} ${res.status} ${duration}ms`

    this[level](message, context)
  }

  // Log API errors
  logApiError(error: Error, req: NextRequest, userId?: string) {
    const context: LogContext = {
      userId,
      method: req.method,
      path: req.nextUrl.pathname,
      error,
      metadata: {
        stack: error.stack,
        body: req.body,
      },
    }

    this.error(`API Error: ${error.message}`, context)
  }
}

// Export singleton instance
export const logger = new Logger()

// Middleware helper for request logging
export function createRequestLogger() {
  return (req: NextRequest, res: Response, duration: number) => {
    logger.logRequest(req, { status: res.status }, duration)
  }
}