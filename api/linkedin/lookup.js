// api/linkedin/lookup.js
//
// Resolves a single LinkedIn profile URL to real profile data via Unipile —
// no existing lead row required, no DB write. Used by the "Add by LinkedIn
// URL" import flow to populate real data (including linkedin_urn) BEFORE
// a lead is created, so leads never land in the database without a usable
// URN the way the old fake "Paste URL" preview did.
//
// POST body: { linkedin_url: string, account_id: string }
// Response:  { ok: true, profile: { linkedin_urn, name, title, company, linkedin_url } }
//         or { ok: false, error: string }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.UNIPILE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "UNIPILE_API_KEY not configured" });

  const { linkedin_url, account_id } = req.body || {};
  if (!linkedin_url) return res.status(400).json({ error: "linkedin_url is required" });
  if (!account_id) return res.status(400).json({ error: "account_id is required" });

  const username = extractLinkedInUsername(linkedin_url);
  if (!username) {
    return res.status(400).json({ ok: false, error: "Could not parse a LinkedIn username from that URL" });
  }

  try {
    const response = await fetch(
      `https://api49.unipile.com:17927/api/v1/linkedin/profiles/${username}?account_id=${account_id}`,
      { headers: { "X-API-KEY": apiKey } },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(200).json({ ok: false, error: err.message || `Profile lookup failed (${response.status})` });
    }

    const profile = await response.json();
    const name = profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null;

    return res.status(200).json({
      ok: true,
      profile: {
        linkedin_urn: profile.provider_id || profile.id || null,
        name,
        title: profile.headline || null,
        company: profile.company_name || null,
        location: profile.location || null,
        linkedin_url,
      },
    });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message || "Profile lookup failed" });
  }
}

function extractLinkedInUsername(url) {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1] : null;
}
