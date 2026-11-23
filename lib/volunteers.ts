// Account actions for volunteers, used by POST /api/volunteers. The caller's own token proves they
// are an admin (rat.is_admin) and is what the role RPCs run as; the service-role key is used only
// for the auth server's admin endpoints. No answer body ever contains a key, a token or (except the
// create/reset success bodies) a password. Logic is here with fetch injected, like lib/health.ts.
export const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export const TEMP_PASSWORD_LENGTH = 12
export const MIN_PASSWORD_LENGTH = 8
// The auth server hashes with bcrypt, which only reads the first 72 bytes.
export const MAX_PASSWORD_BYTES = 72

export type VolunteersResult = { status: number; body: Record<string, unknown> }
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

const fail = (status: number, error: string): VolunteersResult => ({ status, body: { error } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOT_VOLUNTEER = "that email already has an account that isn't a volunteer: ask the developer"

const defaultRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n))

// Rejection sampling: bytes at or above the largest multiple of the alphabet size are discarded,
// so every character is equally likely.
export function makeTempPassword(random: (n: number) => Uint8Array): string {
  const size = TEMP_PASSWORD_ALPHABET.length
  const limit = Math.floor(256 / size) * size
  let out = ''
  while (out.length < TEMP_PASSWORD_LENGTH) {
    for (const byte of random(TEMP_PASSWORD_LENGTH * 2)) {
      if (byte < limit && out.length < TEMP_PASSWORD_LENGTH) out += TEMP_PASSWORD_ALPHABET[byte % size]
    }
  }
  return out
}

export async function handleVolunteers(opts: {
  url?: string
  anonKey?: string
  serviceKey?: string
  authHeader?: string
  body: unknown
  fetchFn?: FetchFn
  random?: (n: number) => Uint8Array
}): Promise<VolunteersResult> {
  const { anonKey, serviceKey, authHeader, body, fetchFn = fetch, random = defaultRandom } = opts
  if (!opts.url || !anonKey || !serviceKey) return fail(500, 'accounts are not configured')
  const url = opts.url.replace(/\/+$/, '')
  const token = /^Bearer\s+(\S+)$/i.exec(authHeader ?? '')?.[1]
  if (!token) return fail(401, 'sign in first')
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const action = b?.action
  if (action !== 'create' && action !== 'reset' && action !== 'set_password') return fail(400, 'unknown action')

  const send = async (path: string, init: RequestInit): Promise<Response | null> => {
    try {
      return await fetchFn(url + path, init)
    } catch {
      return null
    }
  }
  const callerHeaders = { apikey: anonKey, Authorization: `Bearer ${token}` }
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const res = await send(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { ...callerHeaders, 'Content-Type': 'application/json', 'Content-Profile': 'rat' },
      body: JSON.stringify(args),
    })
    if (!res || !res.ok) return { ok: false as const, value: undefined }
    return { ok: true as const, value: await res.json().catch(() => null) }
  }
  const admin = (path: string, method: string, payload?: unknown) =>
    send(`/auth/v1/admin/users${path}`, {
      method,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    })

  if (action === 'set_password') {
    const password = b?.password
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return fail(400, `password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
    if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
      return fail(400, `password is too long: ${MAX_PASSWORD_BYTES} characters at most (fewer with accented letters)`)
    }
    const me = await send('/auth/v1/user', { method: 'GET', headers: callerHeaders })
    if (!me) return fail(502, 'the account server did not answer')
    if (me.status === 401 || me.status === 403) return fail(401, 'sign in again')
    const id = me.ok ? ((await me.json().catch(() => null)) as { id?: unknown } | null)?.id : undefined
    if (typeof id !== 'string' || !UUID.test(id)) return fail(502, 'the account server did not answer')
    // Only a volunteer on their forced first password change may use this; never an admin.
    const role = await rpc('my_role', {})
    if (!role.ok) return fail(502, 'could not check your access')
    const r = role.value as { role?: unknown; must_change_password?: unknown } | null
    if (r?.role !== 'volunteer' || r.must_change_password !== true) return fail(403, 'not allowed')
    const put = await admin(`/${id}`, 'PUT', { password })
    return put?.ok ? { status: 200, body: { ok: true } } : fail(502, 'could not set the password')
  }

  // Everything else is admin-only.
  const isAdmin = await rpc('is_admin', {})
  if (!isAdmin.ok) return fail(502, 'could not check your access')
  if (isAdmin.value !== true) return fail(403, 'admins only')

  const statusOf = async (args: Record<string, unknown>) => {
    const r = await rpc('account_status', args)
    const v = r.value as { user_id?: unknown; kind?: unknown } | null | undefined
    if (!r.ok || !v || typeof v.kind !== 'string') return null
    return { userId: typeof v.user_id === 'string' ? v.user_id : null, kind: v.kind }
  }

  if (action === 'create') {
    const email = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : ''
    if (!EMAIL.test(email)) return fail(400, 'enter a valid email address')
    const st = await statusOf({ p_email: email })
    if (!st) return fail(502, 'could not check that email')
    if (st.kind === 'admin' || st.kind === 'volunteer') return fail(409, 'already a volunteer')
    if (st.kind === 'other') return fail(409, NOT_VOLUNTEER)

    const password = makeTempPassword(random)
    if (st.kind === 'removed_volunteer' && st.userId) {
      const put = await admin(`/${st.userId}`, 'PUT', { password })
      if (!put?.ok) return fail(502, 'could not set the password')
      const grant = await rpc('add_volunteer', { p_user_id: st.userId })
      if (!grant.ok) return fail(502, 'could not restore the volunteer')
      return { status: 200, body: { user_id: st.userId, email, temp_password: password } }
    }
    if (st.kind !== 'none') return fail(502, 'could not check that email')

    const made = await admin('', 'POST', { email, password, email_confirm: true })
    const id = made?.ok ? ((await made.json().catch(() => null)) as { id?: unknown } | null)?.id : undefined
    if (typeof id !== 'string') return fail(502, 'could not create the account')
    const grant = await rpc('add_volunteer', { p_user_id: id })
    if (!grant.ok) {
      const undone = await admin(`/${id}`, 'DELETE') // no account without a role
      if (!undone?.ok) return fail(502, 'could not make them a volunteer, and the new account could not be undone: ask the developer')
      return fail(502, 'could not make them a volunteer; nothing was created')
    }
    return { status: 200, body: { user_id: id, email, temp_password: password } }
  }

  // reset
  const userId = typeof b?.user_id === 'string' ? b.user_id : ''
  if (!UUID.test(userId)) return fail(400, 'user_id must be a user id')
  const st = await statusOf({ p_user_id: userId })
  if (!st) return fail(502, 'could not check that account')
  if (st.kind === 'none') return fail(404, 'no such account')
  if (st.kind !== 'volunteer') return fail(409, 'not an active volunteer')
  // Flag first: if the flag fails nothing has changed; if the new password then fails, the old one
  // still works and they are only asked to choose a new one at sign-in.
  const flag = await rpc('require_password_change', { p_user_id: userId })
  if (!flag.ok) return fail(502, 'could not reset the password; nothing was changed')
  const password = makeTempPassword(random)
  const put = await admin(`/${userId}`, 'PUT', { password })
  if (!put?.ok) {
    return fail(502, 'could not set the new password; their old password still works and they will be asked to change it')
  }
  return { status: 200, body: { temp_password: password } }
}
