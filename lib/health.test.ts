import { describe, expect, it } from 'vitest'
import { checkHealth, HEALTH_PATH } from './health.js'

const SERVER = 'https://server.example'
const KEY = 'anon-key'
const json = (status: number, body: unknown) =>
  async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('checkHealth', () => {
  it('asks the server for one search row, with the key and the rat schema', async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers as Record<string, string> }
      return new Response('[{"image_no":"arc00001"}]', { status: 200 })
    }
    await checkHealth({ url: SERVER, key: KEY, fetchFn })
    expect(HEALTH_PATH).toBe('/rest/v1/mobile_catalog_view?select=image_no&limit=1')
    expect(seen?.url).toBe(SERVER + HEALTH_PATH)
    expect(seen?.headers).toMatchObject({ apikey: KEY, 'Accept-Profile': 'rat' })
  })

  it('is 200 and ok when a row comes back', async () => {
    expect(await checkHealth({ url: SERVER, key: KEY, fetchFn: json(200, [{ image_no: 'arc00001' }]) })).toEqual({
      status: 200,
      body: { ok: true, image_no: 'arc00001' },
    })
  })

  it('is 503 when the server answers but returns no row', async () => {
    expect(await checkHealth({ url: SERVER, key: KEY, fetchFn: json(200, []) })).toEqual({
      status: 503,
      body: { ok: false, reason: 'no rows returned' },
    })
  })

  it('is 503 with the status when the server refuses', async () => {
    expect(await checkHealth({ url: SERVER, key: KEY, fetchFn: json(401, { message: 'no key' }) })).toEqual({
      status: 503,
      body: { ok: false, reason: 'server answered 401' },
    })
  })

  it('is 503 when the answer is not JSON', async () => {
    const fetchFn = async () => new Response('<html>bad gateway</html>', { status: 200 })
    expect((await checkHealth({ url: SERVER, key: KEY, fetchFn })).body).toEqual({ ok: false, reason: 'answer was not a search row' })
  })

  it('is 503 when the server cannot be reached', async () => {
    const fetchFn = async () => {
      throw new TypeError('fetch failed')
    }
    expect(await checkHealth({ url: SERVER, key: KEY, fetchFn })).toEqual({
      status: 503,
      body: { ok: false, reason: 'server unreachable' },
    })
  })

  it('is 503 when the server does not answer in time', async () => {
    const fetchFn = (_u: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    expect(await checkHealth({ url: SERVER, key: KEY, fetchFn, timeoutMs: 20 })).toEqual({
      status: 503,
      body: { ok: false, reason: 'no answer within 20 ms' },
    })
  })

  it('is 503 when the site is not configured, without calling out', async () => {
    let called = false
    const fetchFn = async () => {
      called = true
      return new Response('[]')
    }
    expect(await checkHealth({ url: undefined, key: KEY, fetchFn })).toEqual({
      status: 503,
      body: { ok: false, reason: 'health check not configured' },
    })
    expect(await checkHealth({ url: SERVER, key: '', fetchFn })).toMatchObject({ status: 503 })
    expect(called).toBe(false)
  })

  it('never puts the key in its answer', async () => {
    for (const fetchFn of [json(200, [{ image_no: 'x' }]), json(500, { message: KEY })]) {
      expect(JSON.stringify(await checkHealth({ url: SERVER, key: KEY, fetchFn }))).not.toContain(KEY)
    }
  })
})
