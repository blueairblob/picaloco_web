// Screenshots for the RAT operations manual (docs/ops-manual/screenshots/).
// Read-only against the live site: it searches, opens photos and admin overview pages, and never
// answers, reviews or saves anything.
//
// Run from the repo root:
//   PW_DIR=<dir with node_modules/playwright> [CHROME=<chromium binary>] \
//   ADMIN_TEST_EMAIL=... ADMIN_TEST_PASSWORD=... node docs/ops-manual/capture.mjs
// (the admin login is read from the environment, normally loaded from .env.local; never printed)
// PUBLIC_IP=<a public address of the server> makes the browser reach the server the way a visitor
// does. Needed on a PC that is on the developer's Tailscale network: there the server's name
// resolves to a private 100.x address, and current Chrome blocks a public site from calling a
// private address, so every request fails with ERR_FAILED.
//
// Broken states are made by blocking the real requests in the browser, so they show what a
// volunteer would really see when the server or the photos are unreachable.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(path.join(process.env.PW_DIR ?? '.', 'package.json'))
const { chromium } = require('playwright')

const SITE = 'https://picaloco-web.vercel.app'
const SERVER_HOST = 'huey.taila2eeb2.ts.net'
const SAMPLE = 'arc00001'
const OUT = 'docs/ops-manual/screenshots'
const EMAIL = process.env.ADMIN_TEST_EMAIL
const PASSWORD = process.env.ADMIN_TEST_PASSWORD
const FAKE_EMAIL = 'your.name@example.org'

mkdirSync(OUT, { recursive: true })
const args = process.env.PUBLIC_IP ? [`--host-resolver-rules=MAP ${SERVER_HOST} ${process.env.PUBLIC_IP}`] : []
const browser = await chromium.launch({ args, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) })
const leaks = []

async function newPage(block) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await ctx.newPage()
  if (block === 'server') await page.route(`https://${SERVER_HOST}/**`, (r) => r.abort('connectionrefused'))
  if (block === 'photos') await page.route(`https://${SERVER_HOST}/storage/**`, (r) => r.abort('connectionrefused'))
  return page
}

const pause = (page, ms) => page.waitForTimeout(ms)

// Wait for something a person would see; a screenshot taken while "Loading…" shows is useless.
async function waitFor(page, name, locator, ms = 45000) {
  try { await locator.first().waitFor({ timeout: ms }) } catch { leaks.push(`${name}: expected content never appeared`); return false }
  await pause(page, 1500)
  return true
}

// Replace the admin email wherever it shows, then refuse to save if any real address remains.
async function shot(page, name) {
  if (EMAIL) {
    await page.evaluate(([real, fake]) => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.nodeValue.includes(real)) n.nodeValue = n.nodeValue.split(real).join(fake)
      }
      for (const el of document.querySelectorAll('input')) if (el.value === real) el.value = fake
    }, [EMAIL, FAKE_EMAIL])
  }
  const text = await page.evaluate(() =>
    document.body.innerText + ' ' + [...document.querySelectorAll('input')].map((i) => i.value).join(' '))
  const found = (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).filter((e) => e !== FAKE_EMAIL)
  if (found.length) { leaks.push(`${name}: email shown`); return }
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`saved ${name}.png`)
}

async function search(page, term) {
  await page.getByPlaceholder('Search by image number or keyword…').fill(term)
  await page.keyboard.press('Enter')
}

// --- working ---
let page = await newPage()
await page.goto(SITE)
await page.waitForFunction(() => document.images.length > 4 && [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length > 4, null, { timeout: 45000 })
  .then(() => pause(page, 2000)).then(() => shot(page, '01-home')).catch(() => leaks.push('01-home: photos never loaded'))
await search(page, SAMPLE)
if (await waitFor(page, '02-search-found', page.getByText(SAMPLE, { exact: true }))) {
  await page.waitForFunction((n) => [...document.images].some((i) => i.src.includes(n) && i.complete && i.naturalWidth > 0), SAMPLE, { timeout: 30000 }).catch(() => leaks.push('02-search-found: photo never loaded'))
  await shot(page, '02-search-found')
}
await page.goto(`${SITE}/photo/${SAMPLE}`)
if (await waitFor(page, '03-photo-detail', page.getByText('City of Truro'))) {
  await page.waitForFunction((n) => [...document.images].some((i) => i.src.includes(n) && i.complete && i.naturalWidth > 0), SAMPLE, { timeout: 30000 }).catch(() => leaks.push('03-photo-detail: photo never loaded'))
  await shot(page, '03-photo-detail')
}
await page.goto(`${SITE}/admin/fixes`)
if (await waitFor(page, '04-admin-sign-in', page.locator('input[type="password"]'))) await shot(page, '04-admin-sign-in')

// --- broken ---
await page.goto(SITE); await waitFor(page, '11', page.getByPlaceholder('Search by image number or keyword…'))
await search(page, 'zzqxnotarealphoto'); await pause(page, 8000); await shot(page, '11-search-nothing-found')
await page.goto(`${SITE}/admin/fixes`); await waitFor(page, '14', page.locator('input[type="password"]'))
await page.locator('input[type="email"]').fill(FAKE_EMAIL)
await page.locator('input[type="password"]').fill('not-the-password')
await page.getByRole('button', { name: 'Sign in' }).click(); await pause(page, 6000); await shot(page, '14-login-failed')
await page.context().close()

// Server unreachable: the site itself loads (it is hosted elsewhere) but every data request fails.
page = await newPage('server')
await page.goto(SITE); await waitFor(page, '12', page.getByPlaceholder('Search by image number or keyword…'))
await search(page, SAMPLE); await pause(page, 20000); await shot(page, '12-server-unreachable')
await page.context().close()

// Photos unreachable: text loads, pictures don't.
page = await newPage('photos')
await page.goto(SITE); await waitFor(page, '13', page.getByPlaceholder('Search by image number or keyword…'))
await search(page, SAMPLE)
if (await waitFor(page, '13-photos-missing-search', page.getByText(SAMPLE, { exact: true }))) { await pause(page, 4000); await shot(page, '13-photos-missing-search') }
await page.goto(`${SITE}/photo/${SAMPLE}`)
if (await waitFor(page, '13-photos-missing-detail', page.getByText('City of Truro'))) { await pause(page, 4000); await shot(page, '13-photos-missing-detail') }
await page.context().close()

// --- admin, signed in (overview pages only; nothing is answered or reviewed) ---
if (EMAIL && PASSWORD) {
  page = await newPage()
  await page.goto(`${SITE}/admin/fixes`); await waitFor(page, '05', page.locator('input[type="password"]'))
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  try {
    await page.locator('input[type="password"]').waitFor({ state: 'detached', timeout: 45000 })
    await pause(page, 6000); await shot(page, '05-admin-data-fixes')
    await page.goto(`${SITE}/admin/model-check`); await pause(page, 8000); await shot(page, '06-admin-model-check')
  } catch { leaks.push('05/06: admin sign-in did not complete') }
  await page.context().close()
} else {
  leaks.push('admin shots skipped: ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD not set')
}

await browser.close()
if (leaks.length) { console.error('NOT SAVED:\n' + leaks.join('\n')); process.exit(1) }
