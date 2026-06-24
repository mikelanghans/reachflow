// api/ghl/connect.js
//
// Validates a GoHighLevel Private Integration Token + Location ID by making
// a real test call to GHL before saving anything — never store credentials
// we haven't confirmed actually work.
//
// POST body: { client_id, location_id, private_token }
// Success:   { ok: true, location_name: string }
// Failure:   { error: string }

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, location_id, private_token } = req.body || {};
  if (!client_id || !location_id || !private_token) {
    return res.status(400).json({ error: "client_id, location_id, and private_token are all required" });
  }

  // Confirm the token actually works by fetching the location's own
  // details — same "validate before saving" discipline as everywhere else
  // tonight, rather than trusting that a save = a working integration.
  let locationName = location_id;
  try {
    const locRes = await fetch(`${GHL_BASE}/locations/${location_id}`, {
      headers: {
        Authorization: `Bearer ${private_token}`,
        Version: GHL_VERSION,
        Accept: "application/json",
      },
    });

    const rawText = await locRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("GHL connect: non-JSON response", locRes.status, rawText.slice(0, 500));
      return res.status(502).json({
        error: `GoHighLevel returned an unexpected response (HTTP ${locRes.status}) — double-check the Location ID and token.`,
      });
    }

    if (!locRes.ok) {
      return res.status(locRes.status).json({
        error: data.message || data.error || `Couldn't connect (HTTP ${locRes.status}) — check the token and Location ID`,
      });
    }

    locationName = data.location?.name || data.name || location_id;
  } catch (err) {
    console.error("GHL connect failed:", err);
    return res.status(500).json({ error: err.message || "Connection test failed" });
  }

  const { error } = await supabase
    .from("clients")
    .update({
      ghl_location_id: location_id,
      ghl_private_token: private_token,
      ghl_connected: true,
      ghl_last_synced_at: null,
    })
    .eq("id", client_id);

  if (error) {
    console.error("GHL connect: failed to save:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, location_name: locationName });
}
