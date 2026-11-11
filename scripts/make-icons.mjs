// Renders public/icon.svg to the PNG sizes iOS and Android need. Run: node scripts/make-icons.mjs
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const pub = fileURLToPath(new URL('../public/', import.meta.url))
const svg = await readFile(pub + 'icon.svg', 'utf8')
const browser = await chromium.launch()
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: pub + name })
  await page.close()
}
await browser.close()
console.log('icons written')
