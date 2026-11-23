// Supabase/bcrypt ignore or reject anything past 72 bytes, so the form refuses it up front.
export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (new TextEncoder().encode(password).length > 72) return 'Use 72 characters or fewer.'
  return null
}
