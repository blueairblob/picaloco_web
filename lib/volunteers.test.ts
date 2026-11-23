import { describe, expect, it } from 'vitest'
import { handleVolunteers, TEMP_PASSWORD_ALPHABET } from './volunteers.js'

const URL_ = 'https://server.example'
const ANON = 'anon-key-xyz'
const SERVICE = 'service-key-xyz'
const AUTH = 'Bearer caller-token'
const UID = '11111111-1111-4111-8111-111111111111'
const NEW_ID = '22222222-2222-4222-8222-222222222222'

type Call = { url: string; method: string; headers: Record<string, string>; body: any }
type Answers = Record<string, { status: number; body?: unknown }>

function fake(answers: Answers) {
  const calls: Call[] = []
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url).replace(URL_, '')
    const method = init?.method ?? 'GET'
    calls.push({ url: u, method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const a = answers[`${method} ${u}`]
    if (!a) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(a.body ?? null), { status: a.status })
  }
  return { calls, fetchFn }
}
const rpc = (n: string) => `POST /rest/v1/rpc/${n}`
const base = (extra: Answers) => ({
  [rpc('is_admin')]: { status: 200, body: true },
  ...extra,
})
const run = (answers: Answers, body: unknown, authHeader: string | null = AUTH) => {
  const f = fake(answers)
  const p = handleVolunteers({ url: URL_, anonKey: ANON, serviceKey: SERVICE, authHeader: authHeader ?? undefined, body, fetchFn: f.fetchFn })
  return p.then((result) => ({ result, calls: f.calls }))
}
const status = (kind: string, id: string | null = UID) => ({ status: 200, body: { user_id: id, kind } })

describe('handleVolunteers', () => {
  it('refuses without a token', async () => {
    const { result, calls } = await run({}, { action: 'create', email: 'a@b.org' }, null)
    expect(result.status).toBe(401)
    expect(calls).toEqual([])
  })

  it('is 500 when not configured', async () => {
    const r = await handleVolunteers({ url: URL_, anonKey: ANON, authHeader: AUTH, body: {}, fetchFn: fake({}).fetchFn })
    expect(r.status).toBe(500)
  })

  it('is 400 for a bad body', async () => {
    expect((await run(base({}), 'nope')).result.status).toBe(400)
    expect((await run(base({}), { action: 'dance' })).result.status).toBe(400)
    expect((await run(base({}), { action: 'create', email: 'not-an-email' })).result.status).toBe(400)
    expect((await run(base({}), { action: 'reset', user_id: 'x' })).result.status).toBe(400)
  })

  it('refuses a non-admin', async () => {
    const { result, calls } = await run({ [rpc('is_admin')]: { status: 200, body: false } }, { action: 'create', email: 'a@b.org' })
    expect(result.status).toBe(403)
    expect(calls.some((c) => c.url.includes('/auth/v1/admin'))).toBe(false)
  })

  it('calls the RPCs with the caller token, anon key and rat profile', async () => {
    const { calls } = await run(base({ [rpc('account_status')]: status('none', null) }), { action: 'create', email: 'a@b.org' })
    expect(calls[0].headers).toMatchObject({ apikey: ANON, Authorization: AUTH, 'Content-Profile': 'rat', 'Content-Type': 'application/json' })
  })

  it('create makes the account, grants the role, returns the password once', async () => {
    const { result, calls } = await run(
      base({
        [rpc('account_status')]: status('none', null),
        'POST /auth/v1/admin/users': { status: 200, body: { id: NEW_ID } },
        [rpc('add_volunteer')]: { status: 200, body: { user_id: NEW_ID } },
      }),
      { action: 'create', email: 'bob@example.org' },
    )
    expect(result.status).toBe(200)
    const b = result.body as { user_id: string; email: string; temp_password: string }
    expect(b.user_id).toBe(NEW_ID)
    expect(b.email).toBe('bob@example.org')
    expect(b.temp_password).toHaveLength(12)
    for (const ch of b.temp_password) expect(TEMP_PASSWORD_ALPHABET).toContain(ch)
    const post = calls.find((c) => c.url === '/auth/v1/admin/users')!
    expect(post.body).toMatchObject({ email: 'bob@example.org', email_confirm: true, password: b.temp_password })
    expect(post.headers).toMatchObject({ apikey: SERVICE, Authorization: `Bearer ${SERVICE}` })
    expect(calls.find((c) => c.url === rpc('add_volunteer').slice(5))!.body).toEqual({ p_user_id: NEW_ID })
  })

  it('create normalises the email', async () => {
    const { calls } = await run(
      base({
        [rpc('account_status')]: status('none', null),
        'POST /auth/v1/admin/users': { status: 200, body: { id: NEW_ID } },
        [rpc('add_volunteer')]: { status: 200, body: {} },
      }),
      { action: 'create', email: ' Bob@Example.org ' },
    )
    expect(calls.find((c) => c.url.endsWith('/account_status'))!.body.p_email).toBe('bob@example.org')
    expect(calls.find((c) => c.url === '/auth/v1/admin/users')!.body.email).toBe('bob@example.org')
  })

  it('create re-activates a removed volunteer with a new password', async () => {
    const { result, calls } = await run(
      base({
        [rpc('account_status')]: status('removed_volunteer'),
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
        [rpc('add_volunteer')]: { status: 200, body: {} },
      }),
      { action: 'create', email: 'bob@example.org' },
    )
    expect(result.status).toBe(200)
    expect((result.body as any).user_id).toBe(UID)
    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.body.password).toBe((result.body as any).temp_password)
    expect(calls.some((c) => c.method === 'POST' && c.url === '/auth/v1/admin/users')).toBe(false)
    expect(calls.find((c) => c.url.endsWith('/add_volunteer'))!.body).toEqual({ p_user_id: UID })
  })

  it('create refuses existing accounts', async () => {
    for (const kind of ['admin', 'volunteer']) {
      const { result, calls } = await run(base({ [rpc('account_status')]: status(kind) }), { action: 'create', email: 'a@b.org' })
      expect(result).toEqual({ status: 409, body: { error: 'already a volunteer' } })
      expect(calls.some((c) => c.url.includes('/auth/v1'))).toBe(false)
    }
    const { result } = await run(base({ [rpc('account_status')]: status('other') }), { action: 'create', email: 'a@b.org' })
    expect(result).toEqual({
      status: 409,
      body: { error: "that email already has an account that isn't a volunteer: ask the developer" },
    })
  })

  it('create rolls back the account when the role grant fails', async () => {
    const { result, calls } = await run(
      base({
        [rpc('account_status')]: status('none', null),
        'POST /auth/v1/admin/users': { status: 200, body: { id: NEW_ID } },
        [rpc('add_volunteer')]: { status: 500, body: { message: 'boom' } },
        [`DELETE /auth/v1/admin/users/${NEW_ID}`]: { status: 200, body: {} },
      }),
      { action: 'create', email: 'bob@example.org' },
    )
    expect(result.status).toBe(502)
    expect(result.body).not.toHaveProperty('temp_password')
    expect(calls.some((c) => c.method === 'DELETE' && c.url === `/auth/v1/admin/users/${NEW_ID}`)).toBe(true)
  })

  it('is 502 when the account cannot be created', async () => {
    const { result } = await run(
      base({ [rpc('account_status')]: status('none', null), 'POST /auth/v1/admin/users': { status: 500, body: {} } }),
      { action: 'create', email: 'bob@example.org' },
    )
    expect(result.status).toBe(502)
  })

  it('reset only for active volunteers', async () => {
    const admin = await run(base({ [rpc('account_status')]: status('admin') }), { action: 'reset', user_id: UID })
    expect(admin.result.status).toBe(409)
    expect(admin.calls.some((c) => c.method === 'PUT')).toBe(false)

    const ok = await run(
      base({
        [rpc('account_status')]: status('volunteer'),
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
        [rpc('require_password_change')]: { status: 200, body: null },
      }),
      { action: 'reset', user_id: UID },
    )
    expect(ok.result.status).toBe(200)
    const pw = (ok.result.body as any).temp_password as string
    expect(pw).toHaveLength(12)
    expect(ok.calls.find((c) => c.method === 'PUT')!.body).toEqual({ password: pw })
    expect(ok.calls.find((c) => c.url.endsWith('/require_password_change'))!.body).toEqual({ p_user_id: UID })
  })

  it('set_password changes only the caller', async () => {
    const { result, calls } = await run(
      {
        'GET /auth/v1/user': { status: 200, body: { id: UID } },
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
      },
      { action: 'set_password', password: 'long-enough-pw', user_id: NEW_ID },
    )
    expect(result).toEqual({ status: 200, body: { ok: true } })
    expect(calls[0].headers).toMatchObject({ apikey: ANON, Authorization: AUTH })
    expect(calls.some((c) => c.url.includes(NEW_ID))).toBe(false)
    expect(calls.some((c) => c.url.endsWith('/is_admin'))).toBe(false)
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ password: 'long-enough-pw' })
  })

  it('set_password rejects short passwords and bad tokens', async () => {
    expect((await run({}, { action: 'set_password', password: 'short' })).result.status).toBe(400)
    const bad = await run({ 'GET /auth/v1/user': { status: 401, body: {} } }, { action: 'set_password', password: 'long-enough-pw' })
    expect(bad.result.status).toBe(401)
  })

  it('never puts a key in any answer', async () => {
    const cases: Array<[Answers, unknown]> = [
      [{ [rpc('is_admin')]: { status: 500, body: { message: `${SERVICE} ${ANON}` } } }, { action: 'create', email: 'a@b.org' }],
      [base({ [rpc('account_status')]: status('other') }), { action: 'create', email: 'a@b.org' }],
      [base({ [rpc('account_status')]: status('none', null), 'POST /auth/v1/admin/users': { status: 500, body: { message: SERVICE } } }), { action: 'create', email: 'a@b.org' }],
      [{ 'GET /auth/v1/user': { status: 200, body: { id: UID } }, [`PUT /auth/v1/admin/users/${UID}`]: { status: 500, body: { message: SERVICE } } }, { action: 'set_password', password: 'long-enough-pw' }],
    ]
    for (const [a, body] of cases) {
      const s = JSON.stringify((await run(a, body)).result)
      expect(s).not.toContain(SERVICE)
      expect(s).not.toContain(ANON)
      expect(s).not.toContain('caller-token')
    }
  })
})
