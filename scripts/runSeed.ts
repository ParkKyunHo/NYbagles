#!/usr/bin/env node

import dotenv from 'dotenv'
import path from 'path'
import { seedDatabase } from '../lib/seed/seedData'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

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

seedDatabase()
  .then(() => {
    console.log('✅ Database seeding completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  })