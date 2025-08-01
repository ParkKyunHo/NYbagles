import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

// Function to replace text-gray-500 with text-gray-700 in a file
async function updateFontColors(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    
    // Check if file contains text-gray-500 or text-gray-400
    if (!content.includes('text-gray-500') && !content.includes('text-gray-400')) {
      return
    }
    
    // Replace text-gray-500 with text-gray-700 and text-gray-400 with text-gray-600
    let updatedContent = content.replace(/text-gray-500/g, 'text-gray-700')
    updatedContent = updatedContent.replace(/text-gray-400/g, 'text-gray-600')
    
    // Write the updated content back
    await fs.promises.writeFile(filePath, updatedContent, 'utf-8')
    console.log(`Updated: ${filePath}`)
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error)
  }
}

// Main function
async function main() {
  console.log('Starting font color update...')
  
  // Find all TypeScript files in the app directory
  const files = await glob('app/**/*.{ts,tsx}', {
    cwd: process.cwd(),
    absolute: true
  })
  
  console.log(`Found ${files.length} files to check`)
  
  // Update each file
  for (const file of files) {
    await updateFontColors(file)
  }
  
  // Also update the StoreSelector component
  const storeSelectorPath = path.join(process.cwd(), 'components/ui/store-selector.tsx')
  if (fs.existsSync(storeSelectorPath)) {
    await updateFontColors(storeSelectorPath)
  }
  
  console.log('Font color update completed!')
}

// Run the script
main().catch(console.error)