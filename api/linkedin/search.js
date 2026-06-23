// api/linkedin/search.js
//
// Searches LinkedIn (Classic or Sales Navigator, depending on the connected
// account's subscription) on behalf of a client's connected LinkedIn account,
// via Unipile's unified search endpoint. Used by the "Find leads" flow —
// targeting a new audience by keyword/title/industry/location etc., then
// importing results straight into a Lead List.
//
// POST body:
// {
//   client_id: string,          // which client's LinkedIn account to search from
//   api: "classic" | "sales_navigator",  // defaults to "classic"
//   category: "people" | "companies",    // defaults to "people"
//   keywords: string,
//   title?: string,
//   location?: string[],
//   industry?: string[],
//   company_headcount?: { min, max },
//   cursor?: string,            // for pagination
// }

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

  const {
    client_id,
    api = 'classic',
    category = 'people',
    keywords,
    title,
    location,
    industry,
    company_headcount,
    cursor,
    limit = 25,
  } = req.body

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' })
  }

  // Look up the client's connected Unipile account
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('unipile_account_id, linkedin_connected')
    .eq('id', client_id)
    .single()

  if (clientErr || !client?.unipile_account_id || !client.linkedin_connected) {
    return res.status(400).json({ error: 'Client LinkedIn account not connected' })
  }

  // Build the search body — only include fields that were actually passed,
  // since Unipile's search schema differs slightly between classic and
  // sales_navigator and extra empty fields can cause validation errors.
  const searchBody = { api, category }
  if (keywords)          searchBody.keywords = keywords
  if (title)              searchBody.title = title
  if (location?.length)   searchBody.location = location
  if (industry?.length)   searchBody.industry = industry
  if (company_headcount)  searchBody.headcount = [company_headcount]
  if (cursor)              searchBody.cursor = cursor

  try {
    const url = new URL('https://api49.unipile.com:17927/api/v1/linkedin/search')
    url.searchParams.set('account_id', client.unipile_account_id)
    url.searchParams.set('limit', String(limit))

    const response = await fetch(url.toString(), {
      method:  'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(searchBody),
    })

    // Read as text first — Unipile (or a proxy/gateway in front of it) can
    // return a non-JSON body on outages, timeouts, or auth failures (an HTML
    // error page, an empty body, etc.). Calling response.json() directly on
    // that would throw an opaque "Unexpected token '<'" with no indication
    // of what actually went wrong, so we parse defensively and surface the
    // raw body (truncated) when it isn't JSON.
    const rawText = await response.text()
    let data
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error('Unipile search returned non-JSON response:', response.status, rawText.slice(0, 500))
      return res.status(502).json({
        error: `Unipile returned an unexpected response (HTTP ${response.status}) — likely an account/session issue or a Unipile-side outage, not a problem with the search itself.`,
        details: rawText.slice(0, 300),
      })
    }

    if (!response.ok) {
      console.error('Unipile search error:', data)
      // Surface the most common failure mode with a clearer message: the
      // connected account doesn't have Sales Navigator but api was requested.
      if (api === 'sales_navigator' && response.status === 403) {
        return res.status(403).json({
          error: 'This LinkedIn account does not have Sales Navigator access. Switch to Classic search or upgrade the connected account.',
          details: data,
        })
      }
      return res.status(response.status).json({ error: 'LinkedIn search failed', details: data })
    }

    // Normalize results into the shape the Lead Lists UI expects
    const results = (data.items || data.results || []).map(item => ({
      name:          item.name || item.display_name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      title:         item.headline || item.title || '',
      company:       item.company_name || item.current_company?.name || '',
      location:      item.location || '',
      linkedin_url:  item.public_profile_url || item.profile_url || '',
      linkedin_urn:  item.id || item.provider_id || item.member_urn || '',
      photo_url:     item.profile_picture_url || '',
    }))

    return res.status(200).json({
      ok: true,
      results,
      cursor: data.cursor || data.paging?.next_cursor || null,
      total:  data.total || data.paging?.total_count || results.length,
    })
  } catch (err) {
    console.error('LinkedIn search exception:', err)
    return res.status(500).json({ error: 'Search failed', details: err.message })
  }
}
