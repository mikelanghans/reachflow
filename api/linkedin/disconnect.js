// api/linkedin/disconnect.js
//
// Disconnects a client's LinkedIn account: deletes it from Unipile and
// clears the connection fields on the client record in Supabase.
//
// POST body: { client_id: string }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.UNIPILE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'UNIPILE_API_KEY not configured' })
  }

  const { client_id } = req.body
  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' })
  }

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('unipile_account_id')
    .eq('id', client_id)
    .single()

  if (clientErr) {
    return res.status(404).json({ error: 'Client not found' })
  }

  // If there's a Unipile account id, try to actually delete it from Unipile.
  // Even if this fails (account already gone, network issue, etc.), we still
  // clear the local connection state below — a stale local "connected" flag
  // pointing at a dead account is worse than an orphaned Unipile account.
  if (client.unipile_account_id) {
    try {
      const response = await fetch(
        `https://api49.unipile.com:17927/api/v1/accounts/${client.unipile_account_id}`,
        { method: 'DELETE', headers: { 'X-API-KEY': apiKey } }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        console.warn('Unipile account deletion failed (clearing local state anyway):', err)
      }
    } catch (err) {
      console.warn('Unipile disconnect exception (clearing local state anyway):', err)
    }
  }

  const { error: updateErr } = await supabase
    .from('clients')
    .update({ unipile_account_id: null, linkedin_connected: false })
    .eq('id', client_id)

  if (updateErr) {
    console.error('Failed to clear client LinkedIn connection state:', updateErr)
    return res.status(500).json({ error: 'Failed to update client record', details: updateErr })
  }

  return res.status(200).json({ ok: true })
}
