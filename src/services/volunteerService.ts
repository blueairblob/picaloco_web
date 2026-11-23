import { adminSupabase } from '@/lib/supabase/adminClient'

export interface Person {
  user_id: string
  email: string
  role: 'admin' | 'volunteer'
  in_training: boolean
  added_at: string
  removed_at: string | null
  held_count: number
}

export type PasswordResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; message: string }

const GENERIC = 'Something went wrong. Try again.'

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await adminSupabase.rpc('people')
  if (error) throw error
  return ((data ?? []) as Array<Omit<Person, 'held_count'> & { held_count: number | string }>).map((r) => ({
    ...r,
    held_count: Number(r.held_count),
  }))
}

async function callApi(body: Record<string, unknown>): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const { data } = await adminSupabase.auth.getSession()
  const token = data.session?.access_token ?? ''
  const res = await fetch('/api/volunteers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  let json: Record<string, unknown> = {}
  try {
    json = (await res.json()) ?? {}
  } catch {
    json = {}
  }
  return { ok: res.ok, json }
}

async function passwordCall(body: Record<string, unknown>): Promise<PasswordResult> {
  try {
    const { ok, json } = await callApi(body)
    if (!ok) return { ok: false, message: typeof json.error === 'string' ? json.error : GENERIC }
    return {
      ok: true,
      email: typeof json.email === 'string' ? json.email : '',
      tempPassword: String(json.temp_password ?? ''),
    }
  } catch {
    return { ok: false, message: GENERIC }
  }
}

export function addVolunteer(email: string): Promise<PasswordResult> {
  return passwordCall({ action: 'create', email })
}

export function resetPassword(userId: string): Promise<PasswordResult> {
  return passwordCall({ action: 'reset', user_id: userId })
}

export async function setVolunteer(
  userId: string,
  p: { inTraining?: boolean; active?: boolean },
): Promise<void> {
  const { error } = await adminSupabase.rpc('set_volunteer', {
    p_user_id: userId,
    p_in_training: p.inTraining ?? null,
    p_active: p.active ?? null,
  })
  if (error) throw error
}
