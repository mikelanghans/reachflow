// api/scheduler/run.js
//
// The campaign scheduler. Called every hour by cron-job.org.
// Finds all leads due for a message, respects timing windows and daily limits,
// sends via Unipile or drops into the review queue if review mode is on.
//
// Protect this endpoint with a secret so only cron-job.org can call it:
//   Header: x-scheduler-secret = SCHEDULER_SECRET env var

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const OPT_OUT_PATTERNS = [
  /\bremove\s+me\b/i, /\bunsubscribe\b/i,
  /\bstop\s+(emailing|contacting|messaging)\b/i,
  /\bnot\s+interested\b/i, /\bplease\s+(remove|unsubscribe|stop)\b/i,
  /\bopt\s*-?\s*out\b/i,
]

export default async function handler(req, res) {
  // Security check — only allow calls with the correct secret
  const secret = req.headers['x-scheduler-secret']
  if (secret !== process.env.SCHEDULER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('Scheduler run started:', new Date().toISOString())
  const results = { processed: 0, sent: 0, queued: 0, skipped: 0, errors: [] }

  try {
    // 1. Get all active agencies with their settings
    const { data: agencies } = await supabase
      .from('agencies')
      .select('id, daily_send_limit, send_days, send_start, send_end, timing_preset')

    for (const agency of (agencies || [])) {
      try {
        await processAgency(agency, results)
      } catch (err) {
        console.error(`Agency ${agency.id} error:`, err)
        results.errors.push({ agency_id: agency.id, error: err.message })
      }
    }
  } catch (err) {
    console.error('Scheduler fatal error:', err)
    return res.status(500).json({ error: err.message, results })
  }

  console.log('Scheduler complete:', results)
  return res.status(200).json({ ok: true, results })
}

async function processAgency(agency, results) {
  const now = new Date()

  // 2. Check if we're within the send window for this agency
  if (!isWithinSendWindow(now, agency)) {
    console.log(`Agency ${agency.id}: outside send window, skipping`)
    return
  }

  // 3. Check daily limit — how many have we sent today?
  const todayUTC = now.toISOString().split('T')[0]
  const { count: sentToday } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('agency_id', agency.id)
    .eq('direction', 'out')
    .gte('sent_at', todayUTC + 'T00:00:00Z')

  const limit = agency.daily_send_limit || 20
  if (sentToday >= limit) {
    console.log(`Agency ${agency.id}: daily limit ${limit} reached (${sentToday} sent)`)
    return
  }

  let remainingQuota = limit - sentToday

  // 4. Get all active campaigns for this agency
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, flow, review_mode, client_id')
    .eq('agency_id', agency.id)
    .eq('status', 'active')

  for (const campaign of (campaigns || [])) {
    if (remainingQuota <= 0) break
    if (!campaign.flow || campaign.flow.length === 0) continue

    // Get the client's Unipile account ID
    const { data: client } = await supabase
      .from('clients')
      .select('id, unipile_account_id, linkedin_connected')
      .eq('id', campaign.client_id)
      .single()

    if (!client?.unipile_account_id || !client.linkedin_connected) {
      console.log(`Campaign ${campaign.id}: no LinkedIn connected, skipping`)
      continue
    }

    // 5. Get leads in this campaign due for their next step
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('agency_id', agency.id)
      .eq('campaign_id', campaign.id)
      .eq('sequence_status', 'active')
      .order('step_entered_at', { ascending: true })
      .limit(remainingQuota * 2) // fetch more than needed, filter below

    for (const lead of (leads || [])) {
      if (remainingQuota <= 0) break

      const flowNodes = flattenFlow(campaign.flow)
      const currentNode = flowNodes[lead.current_step]

      if (!currentNode) {
        // Lead has completed the sequence
        await supabase.from('leads').update({ sequence_status: 'completed' }).eq('id', lead.id)
        continue
      }

      // Check if enough time has passed since entering this step
      const stepEnteredAt = new Date(lead.step_entered_at)
      const delayDays = currentNode.delay || 0
      const sendAfter = new Date(stepEnteredAt.getTime() + delayDays * 24 * 60 * 60 * 1000)

      if (now < sendAfter) {
        // Not time yet
        continue
      }

      // Check suppression
      if (lead.email) {
        const { data: suppressed } = await supabase
          .from('suppressions')
          .select('id')
          .eq('agency_id', agency.id)
          .eq('email', lead.email)
          .single()

        if (suppressed) {
          await supabase.from('leads').update({ sequence_status: 'suppressed' }).eq('id', lead.id)
          results.skipped++
          continue
        }
      }

      // Skip non-message nodes (conditions, social engagement etc — handled separately)
      if (!['message', 'connection_request'].includes(currentNode.type) && currentNode.type !== 'message') {
        // Social engagement nodes — advance step without sending a message
        if (['view_profile', 'like_post', 'comment_post', 'ai_convo'].includes(currentNode.type)) {
          await advanceLeadStep(lead, campaign, results, agency.id, 'social_action')
          continue
        }
      }

      // Build the personalised message
      const message = personalise(currentNode.content || '', lead)

      results.processed++

      if (campaign.review_mode) {
        // Add to review queue instead of sending
        await supabase.from('review_queue').insert({
          agency_id:    agency.id,
          campaign_id:  campaign.id,
          lead_id:      lead.id,
          message_type: currentNode.label || currentNode.type,
          channel:      currentNode.channel || 'linkedin',
          message_body: message,
          status:       'pending',
          scheduled_for: new Date().toISOString(),
        })
        results.queued++

        // Log activity
        await supabase.from('activity_log').insert({
          agency_id: agency.id,
          type:      'reply',
          message:   `Message queued for review: ${lead.name}`,
          meta:      { lead_id: lead.id, campaign: campaign.name },
        })
      } else {
        // Send immediately via Unipile
        const sent = await sendViaUnipile({
          accountId:  client.unipile_account_id,
          lead,
          message,
          type:       currentNode.type === 'connection_request' ? 'connection_request' : 'message',
        })

        if (sent) {
          // Save outbound message
          await supabase.from('messages').insert({
            agency_id:  agency.id,
            lead_id:    lead.id,
            direction:  'out',
            body:       message,
            channel:    currentNode.channel || 'linkedin',
          })

          // Log activity
          await supabase.from('activity_log').insert({
            agency_id: agency.id,
            type:      'reply',
            message:   `Message sent to ${lead.name} · ${lead.company}`,
            meta:      { lead_id: lead.id, campaign: campaign.name },
          })

          results.sent++
          remainingQuota--
        } else {
          results.errors.push({ lead_id: lead.id, error: 'Unipile send failed' })
          continue
        }
      }

      // Advance to next step
      await advanceLeadStep(lead, campaign, results, agency.id)

      // Random delay between sends (1–5 seconds) to appear human-like
      await sleep(1000 + Math.random() * 4000)
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWithinSendWindow(now, agency) {
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon ... 6=Sat
  const sendDays = agency.send_days || [1, 2, 3, 4] // Mon-Thu default
  if (!sendDays.includes(dayOfWeek)) return false

  const hour = now.getHours()
  const startHour = parseInt((agency.send_start || '08:00').split(':')[0])
  const endHour   = parseInt((agency.send_end   || '17:00').split(':')[0])

  return hour >= startHour && hour < endHour
}

// Flatten flow nodes (handles nested condition branches)
function flattenFlow(flow) {
  const nodes = []
  for (const node of (flow || [])) {
    if (node.type === 'end') continue
    if (node.type === 'condition') {
      // Follow the "no reply" branch by default (most common path)
      nodes.push(node)
      if (node.no) nodes.push(...flattenFlow(node.no))
    } else if (node.type === 'ab_split') {
      // Use variant A by default
      nodes.push(node)
      if (node.a) nodes.push(...flattenFlow(node.a))
    } else {
      nodes.push(node)
    }
  }
  return nodes.filter(n => n.type !== 'end')
}

// Simple personalisation — replace {{tokens}} with lead data
function personalise(template, lead) {
  return template
    .replace(/\{\{first_name\}\}/gi, lead.name?.split(' ')[0] || 'there')
    .replace(/\{\{last_name\}\}/gi,  lead.name?.split(' ').slice(1).join(' ') || '')
    .replace(/\{\{full_name\}\}/gi,  lead.name || '')
    .replace(/\{\{company\}\}/gi,    lead.company || 'your company')
    .replace(/\{\{title\}\}/gi,      lead.title || 'your role')
}

async function advanceLeadStep(lead, campaign, results, agencyId, reason = 'sent') {
  const flowNodes = flattenFlow(campaign.flow)
  const nextStep = (lead.current_step || 0) + 1
  const isComplete = nextStep >= flowNodes.length

  await supabase.from('leads').update({
    current_step:    nextStep,
    step_entered_at: new Date().toISOString(),
    pipeline_stage:  isComplete ? 'contacted' : lead.pipeline_stage,
    sequence_status: isComplete ? 'completed' : 'active',
    last_activity_at: new Date().toISOString(),
  }).eq('id', lead.id)
}

async function sendViaUnipile({ accountId, lead, message, type }) {
  const apiKey = process.env.UNIPILE_API_KEY
  if (!apiKey) return false
  if (!lead.linkedin_urn) {
    console.warn(`Lead ${lead.id} has no linkedin_urn — skipping Unipile send`)
    return false
  }

  try {
    const endpoint = type === 'connection_request'
      ? 'https://api.unipile.com:13465/api/v1/linkedin/invitations'
      : 'https://api.unipile.com:13465/api/v1/linkedin/messages'

    const body = type === 'connection_request'
      ? { account_id: accountId, linkedin_member_urn: lead.linkedin_urn, message }
      : { account_id: accountId, recipient_urn: lead.linkedin_urn, text: message }

    const response = await fetch(endpoint, {
      method:  'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Unipile send error:', err)
      return false
    }

    return true
  } catch (err) {
    console.error('Unipile send exception:', err)
    return false
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
