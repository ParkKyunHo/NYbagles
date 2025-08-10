#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import path from 'path'

async function updateAuthImports() {
  console.log('🔄 Updating authentication imports to use unified-auth...\n')
  
  // Find all page.tsx files in the dashboard directory
  const files = await glob('app/(dashboard)/**/page.tsx', {
    cwd: path.resolve(process.cwd()),
    absolute: true
  })
  
  console.log(`Found ${files.length} dashboard pages to check\n`)
  
  let updatedCount = 0
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    
    // Check if file uses old auth imports
    const oldImports = [
      "from '@/lib/auth/server-auth'",
      "from '@/hooks/useAuthCheck'",
      "getAuthUser",
      "checkPageAccess"
    ]
    
    let needsUpdate = false
    for (const oldImport of oldImports) {
      if (content.includes(oldImport)) {
        needsUpdate = true
        break
      }
    }
    
    if (needsUpdate) {
      let newContent = content
      
      // Replace old imports with new ones
      newContent = newContent.replace(
        /import\s*{\s*getAuthUser[^}]*}\s*from\s*['"]@\/lib\/auth\/server-auth['"]/g,
        "import { requireAuth } from '@/lib/auth/unified-auth'"
      )
      
      newContent = newContent.replace(
        /import\s*{\s*requireRole[^}]*}\s*from\s*['"]@\/lib\/auth\/server-auth['"]/g,
        "import { requireRole } from '@/lib/auth/unified-auth'"
      )
      
      newContent = newContent.replace(
        /import\s*{\s*checkPageAccess[^}]*}\s*from\s*['"]@\/lib\/auth\/server-auth['"]/g,
        "import { checkPageAccess } from '@/lib/auth/unified-auth'"
      )
      
      // Replace function calls
      newContent = newContent.replace(
        /const\s+user\s*=\s*await\s+getAuthUser\(\)/g,
        'const user = await requireAuth()'
      )
      
      // Save the updated file
      writeFileSync(file, newContent)
      updatedCount++
      console.log(`✅ Updated: ${path.relative(process.cwd(), file)}`)
    }
  }
  
  console.log(`\n✨ Updated ${updatedCount} files with unified authentication`)
}

updateAuthImports().catch(console.error)