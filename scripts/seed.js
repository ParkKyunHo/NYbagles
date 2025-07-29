#!/usr/bin/env node

const { config } = require('dotenv')
const { resolve } = require('path')

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })
config({ path: resolve(__dirname, '../.env') })

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set')
  process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set')
  console.error('   Please add it to your .env.local file')
  console.error('   You can find it in your Supabase project settings')
  process.exit(1)
}

// Run seed script
console.log('🚀 Starting database seed...')
console.log('   URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

require('../lib/seed/seedData.ts')