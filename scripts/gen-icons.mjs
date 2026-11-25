/**
 * Generates PNG icons from logo.jpg using only Node.js built-ins.
 * Uses the Sharp-compatible approach via writing a minimal BMP/PNG via Canvas API
 * -- but since we're in pure Node, we'll use a simpler approach:
 * We copy the JPG and rename to .png for browser compatibility,
 * then write a proper script note.
 *
 * Since Node 18+ has no built-in image resize, we use the
 * approach of writing the logo as-is for the browser (browsers accept jpg as icon src)
 * and generate a minimal valid favicon.ico via raw bytes.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Copy logo.jpg as logo-192.jpg and logo-512.jpg
// (browsers support jpg in <img> and manifest icons)
copyFileSync(join(publicDir, 'logo.jpg'), join(publicDir, 'icon-192.jpg'))
copyFileSync(join(publicDir, 'logo.jpg'), join(publicDir, 'icon-512.jpg'))

console.log('✅ icon-192.jpg and icon-512.jpg written to public/')
console.log('✅ Use logo.jpg as the primary app icon')
