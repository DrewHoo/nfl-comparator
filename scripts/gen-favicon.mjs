// Generate the favicon set from one SVG. Run: npm run gen:favicon
// Outputs are committed; CI does not regenerate them.
//   public/favicon.svg          modern browsers
//   public/favicon-32.png       small-pixel fallback
//   public/favicon-192.png      Android, PWA
//   public/apple-touch-icon.png iOS home screen (180x180)
//
// The mark is the site's one picture: two careers' curves, one cream and one
// rust, crossing. It has to read at 16x16, so two thick strokes and nothing else.
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(outDir, { recursive: true })

const BG = '#282127'
const CREAM = '#f3e2bc'
const RUST = '#c36c36'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${BG}"/>
  <path d="M10 52 C 24 50, 34 40, 54 14" fill="none" stroke="${RUST}" stroke-width="6" stroke-linecap="round"/>
  <path d="M10 44 C 28 44, 40 34, 54 30" fill="none" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>
</svg>`

writeFileSync(resolve(outDir, 'favicon.svg'), svg + '\n')
console.log('wrote favicon.svg')

for (const { name, size } of [
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
]) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(outDir, name))
  console.log(`wrote ${name}`)
}
