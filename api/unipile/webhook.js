// api/unipile/webhook.js
// Receives real-time events from Unipile when:
//   - A prospect replies to a LinkedIn message
//   - A connection request is accepted
//   - An InMail is received
//
// Configure this URL in your Unipile dashboard:
//   https://your-domain.com/api/unipile/webhook

import { createClient } from '@supabase/supabase-js'

// Use the service key here — this runs server-side and bypasses RLS intentionally
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Opt-out patterns — same list as the frontend
const OPT_OUT_PATTERNS = [
  /\bremove\s+me\b/i, /\bunsubscribe\b/i,
  /\bstop\s+(emailing|contacting|messaging|reaching out)\b/i,
  /\bdo\s+not\s+(contact|email|message)\b/i,
  /\bdon'?t\s+(contact|email|message|reach out)\b/i,
  /\bnot\s+interested\b/i, /\bplease\s+(remove|unsubscribe|stop)\b/i,
  /\btake\s+me\s+off\b/i, /\bopt\s*-?\s*out\b/i,
]

function isOptOut(text) {
  return OPT_OUT_PATTERNS.some(p => p.test(text))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Optional: verify Unipile signature
  // const sig = req.headers['x-unipile-signature']
  // if (!verifySignature(sig, req.body, process.env.UNIPILE_WEBHOOK_SECRET)) {
  //   return res.status(401).json({ error: 'Invalid signature' })
  // }

  const event = req.body
  console.log('Unipile webhook event:', event?.type, event?.id)

  try {
    if (event.type === 'MESSAGE_RECEIVED') {
      await handleMessageReceived(event)
    } else if (event.type === 'INVITATION_ACCEPTED') {
      await handleInvitationAccepted(event)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Return 200 so Unipile doesn't retry — we log internally
    return res.status(200).json({ ok: false, error: err.message })
  }
}

async function handleMessageReceived(event) {
  const { account_id, sender_profile_id, content, message_id } = event

  // Find the agency that owns this Unipile account
  const { data: client } = await supabase
    .from('clients')
    .select('id, agency_id')
    .eq('unipile_account_id', account_id)
    .single()

  if (!client) {
    console.warn('No client found for account_id:', account_id)
    return
  }

  // Find or create the lead by unipile_profile_id
  let { data: lead } = await supabase
    .from('leads')
    .select('id, agency_id, name, company, status, pipeline_stage')
    .eq('unipile_profile_id', sender_profile_id)
    .eq('agency_id', client.agency_id)
    .single()

  if (!lead) {
    // Create a minimal lead record — profile details will be enriched later
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        agency_id:         client.agency_id,
        client_id:         client.id,
        name:              event.sender_name || 'Unknown',
        unipile_profile_id: sender_profile_id,
        pipeline_stage:    'contacted',
        status:            'replied',
        unread:            true,
      })
      .select()
      .single()
    lead = newLead
  }

  // Deduplicate — don't insert the same message twice
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('unipile_message_id', message_id)
    .single()

  if (existing) {
    console.log('Duplicate message, skipping:', message_id)
    return
  }

  // Insert the inbound message
  await supabase.from('messages').insert({
    agency_id:         client.agency_id,
    lead_id:           lead.id,
    direction:         'in',
    body:              content,
    channel:           'linkedin',
    unipile_message_id: message_id,
  })

  // Update lead status
  await supabase
    .from('leads')
    .update({ status: 'replied', unread: true, pipeline_stage: 'engaged', last_activity_at: new Date().toISOString() })
    .eq('id', lead.id)

  // Check for opt-out
  if (isOptOut(content)) {
    const email = `${lead.name?.toLowerCase().replace(/\s+/g, '.')}@${lead.company?.toLowerCase() || 'unknown'}.com`
    await supabase
      .from('suppressions')
      .upsert({
        agency_id:  client.agency_id,
        email,
        name:       lead.name,
        company:    lead.company,
        reason:     content.slice(0, 120),
        method:     'auto-detected',
      })
      .onConflict('agency_id, email')
  }

  // Log activity
  await supabase.from('activity_log').insert({
    agency_id: client.agency_id,
    type:      'reply',
    message:   `${lead.name} replied`,
    meta:      { lead_id: lead.id, preview: content.slice(0, 80) },
  })
}

async function handleInvitationAccepted(event) {
  const { account_id, profile_id } = event

  const { data: client } = await supabase
    .from('clients')
    .select('id, agency_id')
    .eq('unipile_account_id', account_id)
    .single()

  if (!client) return

  await supabase
    .from('leads')
    .update({ status: 'connected', pipeline_stage: 'contacted', last_activity_at: new Date().toISOString() })
    .eq('unipile_profile_id', profile_id)
    .eq('agency_id', client.agency_id)

  await supabase.from('activity_log').insert({
    agency_id: client.agency_id,
    type:      'pipeline',
    message:   'Connection request accepted',
    meta:      { profile_id },
  })
}
