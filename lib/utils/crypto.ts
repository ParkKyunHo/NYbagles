import * as crypto from 'crypto'

// Generate TOTP secret for QR codes
export function generateSecret(): string {
  return crypto.randomBytes(32).toString('base64')
}

// Generate TOTP token
export function generateTOTP(secret: string, window: number = 0): string {
  const epoch = Math.floor(Date.now() / 1000)
  const timeCounter = Math.floor(epoch / 30) + window
  
  const buffer = Buffer.alloc(8)
  buffer.writeBigInt64BE(BigInt(timeCounter))
  
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'))
  hmac.update(buffer)
  const hash = hmac.digest()
  
  const offset = hash[hash.length - 1] & 0xf
  const truncated = hash.readUInt32BE(offset) & 0x7fffffff
  const otp = truncated % 1000000
  
  return otp.toString().padStart(6, '0')
}

// Verify TOTP token
export function verifyTOTP(token: string, secret: string, windowSize: number = 1): boolean {
  for (let i = -windowSize; i <= windowSize; i++) {
    if (generateTOTP(secret, i) === token) {
      return true
    }
  }
  return false
}

// Hash token for storage
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}