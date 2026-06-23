// api/linkedin/enrich.js
//
// Enriches leads with LinkedIn URNs and profile data via Unipile.
// Called after importing leads to get the data needed for sending.
//
// POST body: { leads: [{ id, linkedin_url }], account_id }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const apiKey = process.env.UNIPILE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'UNIPILE_API_KEY not configured' })

  const { leads, account_id } = req.body
  if (!leads?.length || !account_id) {
    return res.status(400).json({ error: 'leads and account_id required' })
  }

  const results = { enriched: 0, failed: 0, errors: [] }

  for (const lead of leads) {
    try {
      // Extract LinkedIn username from URL
      // e.g. https://linkedin.com/in/johndoe → johndoe
      const username = extractLinkedInUsername(lead.linkedin_url)
      if (!username) {
        results.failed++
        results.errors.push({ id: lead.id, error: 'Could not extract username from URL' })
        continue
      }

      // Look up the profile via Unipile
      const response = await fetch(
        `https://api49.unipile.com:17927/api/v1/linkedin/profiles/${username}?account_id=${account_id}`,
        { headers: { 'X-API-KEY': apiKey } }
      )

      if (!response.ok) {
        results.failed++
        const err = await response.json()
        results.errors.push({ id: lead.id, error: err.message || 'Profile lookup failed' })
        continue
      }

      const profile = await response.json()

      // Update the lead with real data from LinkedIn
      await supabase.from('leads').update({
        linkedin_urn:  profile.provider_id || profile.id,
        name:          profile.display_name || lead.name,
        title:         profile.headline     || lead.title,
        company:       profile.company_name || lead.company,
        initials:      getInitials(profile.display_name || lead.name),
        last_activity_at: new Date().toISOString(),
      }).eq('id', lead.id)

      results.enriched++

      // Polite rate limiting — 1 request per second
      await sleep(1000)

    } catch (err) {
      results.failed++
      results.errors.push({ id: lead.id, error: err.message })
    }
  }

  return res.status(200).json({ ok: true, results })
}

function extractLinkedInUsername(url) {
  if (!url) return null
  // Handle formats:
  // https://www.linkedin.com/in/johndoe
  // https://linkedin.com/in/johndoe/
  // linkedin.com/in/johndoe
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return match ? match[1] : null
}

function getInitials(name) {
  if (!name) return '??'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
