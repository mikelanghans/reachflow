import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true,
  },
})

// ── Typed helpers ──────────────────────────────────────────────────────────────

/** Returns the agency_id for the current session user. */
export async function getAgencyId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  return data?.agency_id ?? null
}

/** Logs an activity entry. */
export async function logActivity(agencyId, type, message, meta = {}) {
  await supabase.from('activity_log').insert({ agency_id: agencyId, type, message, meta })
}
