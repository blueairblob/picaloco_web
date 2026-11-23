import { describe, expect, it } from 'vitest'
import { handleVolunteers, makeTempPassword, TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH } from './volunteers.js'

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

  it('create says so when the rollback delete fails too', async () => {
    const { result, calls } = await run(
      base({
        [rpc('account_status')]: status('none', null),
        'POST /auth/v1/admin/users': { status: 200, body: { id: NEW_ID } },
        [rpc('add_volunteer')]: { status: 500, body: { message: 'boom' } },
        [`DELETE /auth/v1/admin/users/${NEW_ID}`]: { status: 500, body: { message: SERVICE } },
      }),
      { action: 'create', email: 'bob@example.org' },
    )
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true)
    expect(result).toEqual({
      status: 502,
      body: { error: 'could not make them a volunteer, and the new account could not be undone: ask the developer' },
    })
    const s = JSON.stringify(result)
    expect(s).not.toContain(SERVICE)
    expect(s).not.toContain(ANON)
    expect(s).not.toContain('caller-token')
  })

  it('create re-activation does not delete the account when the role grant fails', async () => {
    const { result, calls } = await run(
      base({
        [rpc('account_status')]: status('removed_volunteer'),
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
        [rpc('add_volunteer')]: { status: 500, body: {} },
      }),
      { action: 'create', email: 'bob@example.org' },
    )
    expect(result.status).toBe(502)
    expect(result.body).not.toHaveProperty('temp_password')
    expect(calls.some((c) => c.method === 'PUT')).toBe(true)
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
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

  it('reset flags the change before setting the password', async () => {
    const { calls } = await run(
      base({
        [rpc('account_status')]: status('volunteer'),
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
        [rpc('require_password_change')]: { status: 200, body: null },
      }),
      { action: 'reset', user_id: UID },
    )
    const flagAt = calls.findIndex((c) => c.url.endsWith('/require_password_change'))
    const putAt = calls.findIndex((c) => c.method === 'PUT')
    expect(flagAt).toBeGreaterThanOrEqual(0)
    expect(flagAt).toBeLessThan(putAt)
  })

  it('reset changes nothing when the flag cannot be set', async () => {
    const { result, calls } = await run(
      base({
        [rpc('account_status')]: status('volunteer'),
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
        [rpc('require_password_change')]: { status: 500, body: {} },
      }),
      { action: 'reset', user_id: UID },
    )
    expect(result).toEqual({ status: 502, body: { error: 'could not reset the password; nothing was changed' } })
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('reset says the old password still works when setting the new one fails', async () => {
    const { result } = await run(
      base({
        [rpc('account_status')]: status('volunteer'),
        [`PUT /auth/v1/admin/users/${UID}`]: { status: 500, body: {} },
        [rpc('require_password_change')]: { status: 200, body: null },
      }),
      { action: 'reset', user_id: UID },
    )
    expect(result).toEqual({
      status: 502,
      body: { error: 'could not set the new password; their old password still works and they will be asked to change it' },
    })
  })

  it('set_password changes only the caller', async () => {
    const { result, calls } = await run(
      {
        'GET /auth/v1/user': { status: 200, body: { id: UID } },
        [rpc('my_role')]: { status: 200, body: { role: 'volunteer', must_change_password: true } },
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

  it('set_password rejects passwords over 72 UTF-8 bytes (the bcrypt limit)', async () => {
    const ok = {
      'GET /auth/v1/user': { status: 200, body: { id: UID } },
      [rpc('my_role')]: { status: 200, body: { role: 'volunteer', must_change_password: true } },
      [`PUT /auth/v1/admin/users/${UID}`]: { status: 200, body: {} },
    }
    expect((await run(ok, { action: 'set_password', password: 'a'.repeat(72) })).result.status).toBe(200)
    for (const password of ['a'.repeat(73), 'é'.repeat(37)]) {
      const { result, calls } = await run(ok, { action: 'set_password', password })
      expect(result).toEqual({ status: 400, body: { error: 'password is too long: 72 characters at most (fewer with accented letters)' } })
      expect(calls).toEqual([])
    }
  })

  it('set_password is refused unless a volunteer must change it', async () => {
    const roles: Array<{ status: number; body: unknown }> = [
      { status: 200, body: { role: 'admin', must_change_password: false } },
      { status: 200, body: { role: 'volunteer', must_change_password: false } },
      { status: 200, body: { role: null, must_change_password: null } },
    ]
    for (const my of roles) {
      const { result, calls } = await run(
        { 'GET /auth/v1/user': { status: 200, body: { id: UID } }, [rpc('my_role')]: my },
        { action: 'set_password', password: 'long-enough-pw' },
      )
      expect(result.status).toBe(403)
      expect(calls.some((c) => c.method === 'PUT')).toBe(false)
    }
    const failed = await run(
      { 'GET /auth/v1/user': { status: 200, body: { id: UID } }, [rpc('my_role')]: { status: 500, body: {} } },
      { action: 'set_password', password: 'long-enough-pw' },
    )
    expect(failed.result.status).toBe(502)
    expect(failed.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('never puts a key in any answer', async () => {
    const cases: Array<[Answers, unknown]> = [
      [{ [rpc('is_admin')]: { status: 500, body: { message: `${SERVICE} ${ANON}` } } }, { action: 'create', email: 'a@b.org' }],
      [base({ [rpc('account_status')]: status('other') }), { action: 'create', email: 'a@b.org' }],
      [base({ [rpc('account_status')]: status('none', null), 'POST /auth/v1/admin/users': { status: 500, body: { message: SERVICE } } }), { action: 'create', email: 'a@b.org' }],
      [{ 'GET /auth/v1/user': { status: 200, body: { id: UID } }, [rpc('my_role')]: { status: 200, body: { role: 'volunteer', must_change_password: true } }, [`PUT /auth/v1/admin/users/${UID}`]: { status: 500, body: { message: SERVICE } } }, { action: 'set_password', password: 'long-enough-pw' }],
    ]
    for (const [a, body] of cases) {
      const s = JSON.stringify((await run(a, body)).result)
      expect(s).not.toContain(SERVICE)
      expect(s).not.toContain(ANON)
      expect(s).not.toContain('caller-token')
    }
  })
})

describe('makeTempPassword', () => {
  it('skips bytes at or above 224 and builds the password from the accepted bytes in order', () => {
    expect(TEMP_PASSWORD_ALPHABET).toHaveLength(56) // 4 * 56 = 224
    const batches = [
      [224, 0, 255, 1, 230, 55, 56, 223],
      [240, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    ]
    const asked: number[] = []
    const random = (n: number) => {
      asked.push(n)
      return Uint8Array.from(batches.shift() ?? [])
    }
    const pw = makeTempPassword(random)
    const accepted = [0, 1, 55, 56, 223, 2, 3, 4, 5, 6, 7, 8]
    expect(pw).toBe(accepted.map((b) => TEMP_PASSWORD_ALPHABET[b % 56]).join(''))
    expect(pw).toHaveLength(TEMP_PASSWORD_LENGTH)
    expect(asked).toHaveLength(2) // the first batch had too few accepted bytes
  })

  it('never uses a byte of 224 or more', () => {
    const random = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i % 2 ? 224 + (i % 32) : 5))
    expect(makeTempPassword(random)).toBe(TEMP_PASSWORD_ALPHABET[5].repeat(TEMP_PASSWORD_LENGTH))
  })
})
