// api/linkedin/send.js
// Sends a LinkedIn message or connection request via Unipile.
// Called by the campaign runner when a message is scheduled to go out.
//
// POST body: { client_id, lead_id, type: 'connection_request' | 'message', message }

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

  const { client_id, lead_id, type, message } = req.body

  // Fetch the client's Unipile account ID
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('unipile_account_id, agency_id')
    .eq('id', client_id)
    .single()

  if (clientErr || !client?.unipile_account_id) {
    return res.status(400).json({ error: 'Client LinkedIn account not connected' })
  }

  // Check suppression
  const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
  if (lead?.email) {
    const { data: suppressed } = await supabase
      .from('suppressions')
      .select('id')
      .eq('agency_id', client.agency_id)
      .eq('email', lead.email)
      .single()
    if (suppressed) {
      return res.status(200).json({ skipped: true, reason: 'suppressed' })
    }
  }

  // Check daily sending limit
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('agency_id', client.agency_id)
    .eq('direction', 'out')
    .gte('sent_at', today + 'T00:00:00Z')

  const { data: agency } = await supabase
    .from('agencies')
    .select('daily_send_limit')
    .eq('id', client.agency_id)
    .single()

  const limit = agency?.daily_send_limit || 20
  if (count >= limit) {
    return res.status(429).json({ error: `Daily limit of ${limit} reached`, count })
  }

  try {
    let endpoint, body

    if (type === 'connection_request') {
      endpoint = 'https://api49.unipile.com:17927/api/v1/linkedin/invitations'
      body = {
        account_id:           client.unipile_account_id,
        linkedin_member_urn:  lead?.linkedin_urn,
        message,
      }
    } else {
      endpoint = 'https://api49.unipile.com:17927/api/v1/linkedin/messages'
      body = {
        account_id:         client.unipile_account_id,
        recipient_urn:      lead?.linkedin_urn,
        text:               message,
      }
    }

    const response = await fetch(endpoint, {
      method:  'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Unipile send error:', data)
      return res.status(response.status).json({ error: 'Unipile send failed', details: data })
    }

    // Save the outbound message to the database
    await supabase.from('messages').insert({
      agency_id:         client.agency_id,
      lead_id,
      direction:         'out',
      body:              message,
      channel:           'linkedin',
      unipile_message_id: data.id,
    })

    // Update lead stage
    await supabase
      .from('leads')
      .update({ pipeline_stage: 'contacted', status: 'connected', last_activity_at: new Date().toISOString() })
      .eq('id', lead_id)

    return res.status(200).json({ ok: true, message_id: data.id })
  } catch (err) {
    console.error('LinkedIn send error:', err)
    return res.status(500).json({ error: 'Send failed', details: err.message })
  }
}
