// api/ghl/sync.js
//
// Manual sync triggered by the "Push leads to GHL" / "Pull contacts from
// GHL" buttons in Settings. Uses the client's saved Private Integration
// Token (set via /api/ghl/connect).
//
// POST body: { client_id, direction: "push" | "pull" }
// Success:   { ok: true, results: { synced, failed } }       (push)
//            { ok: true, results: { imported, failed } }     (pull)
// Failure:   { error: string }

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const PULL_LIMIT = 100; // cap per sync run to stay well inside the function timeout

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, direction } = req.body || {};
  if (!client_id || !["push", "pull"].includes(direction)) {
    return res.status(400).json({ error: 'client_id and direction ("push" or "pull") are required' });
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, agency_id, name, ghl_location_id, ghl_private_token, ghl_connected, unipile_account_id")
    .eq("id", client_id)
    .single();

  if (clientErr || !client?.ghl_connected || !client.ghl_private_token) {
    return res.status(400).json({ error: "This client isn't connected to GoHighLevel yet" });
  }

  const ghlHeaders = {
    Authorization: `Bearer ${client.ghl_private_token}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    const results = direction === "push"
      ? await pushLeadsToGhl(client, ghlHeaders)
      : await pullContactsFromGhl(client, ghlHeaders, req);

    await supabase.from("clients").update({ ghl_last_synced_at: new Date().toISOString() }).eq("id", client_id);

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error(`GHL ${direction} sync failed:`, err);
    return res.status(500).json({ error: err.message || "Sync failed" });
  }
}

async function pushLeadsToGhl(client, ghlHeaders) {
  // Leads belonging to any campaign under this client, that haven't
  // already been pushed (no ghl_contact_id yet) — avoids creating
  // duplicate GHL contacts on repeated syncs.
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("client_id", client.id);
  const campaignIds = (campaigns || []).map((c) => c.id);
  if (campaignIds.length === 0) return { synced: 0, failed: 0 };

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, title, company, linkedin_url")
    .in("campaign_id", campaignIds)
    .is("ghl_contact_id", null);
  if (error) throw error;
  if (!leads?.length) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;
  for (const lead of leads) {
    try {
      const [firstName, ...rest] = (lead.name || "").split(" ");
      const res = await fetch(`${GHL_BASE}/contacts/`, {
        method: "POST",
        headers: ghlHeaders,
        body: JSON.stringify({
          locationId: client.ghl_location_id,
          firstName: firstName || lead.name || "Unknown",
          lastName: rest.join(" ") || undefined,
          companyName: lead.company || undefined,
          source: "ReachFlow",
          customFields: lead.linkedin_url ? [{ key: "linkedin_url", field_value: lead.linkedin_url }] : undefined,
        }),
      });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { data = {}; }

      if (!res.ok) {
        console.error(`GHL push failed for lead ${lead.id}:`, res.status, data);
        failed++;
        continue;
      }

      const ghlContactId = data.contact?.id || data.id;
      if (ghlContactId) {
        await supabase.from("leads").update({ ghl_contact_id: ghlContactId }).eq("id", lead.id);
      }
      synced++;
      await sleep(300); // light pacing — GHL rate-limits per-location
    } catch (err) {
      console.error(`GHL push exception for lead ${lead.id}:`, err);
      failed++;
    }
  }
  return { synced, failed };
}

async function pullContactsFromGhl(client, ghlHeaders, req) {
  // Try to auto-detect a LinkedIn URL custom field on this location, so
  // contacts that already have one resolve immediately (tier 1) instead of
  // falling back to a fuzzy name match every time.
  let linkedinFieldId = null;
  try {
    const fieldsRes = await fetch(`${GHL_BASE}/locations/${client.ghl_location_id}/customFields`, { headers: ghlHeaders });
    if (fieldsRes.ok) {
      const fieldsData = await fieldsRes.json();
      const fields = fieldsData.customFields || fieldsData.fields || [];
      const match = fields.find((f) => (f.name || f.key || "").toLowerCase().includes("linkedin"));
      linkedinFieldId = match?.id || match?.key || null;
    }
  } catch (err) {
    console.warn("GHL pull: couldn't fetch custom field definitions, continuing without LinkedIn field auto-detect:", err.message);
  }

  const contactsRes = await fetch(
    `${GHL_BASE}/contacts/?locationId=${client.ghl_location_id}&limit=${PULL_LIMIT}`,
    { headers: ghlHeaders },
  );
  const rawText = await contactsRes.text();
  let contactsData;
  try { contactsData = JSON.parse(rawText); } catch {
    throw new Error(`GoHighLevel returned an unexpected response (HTTP ${contactsRes.status})`);
  }
  if (!contactsRes.ok) {
    throw new Error(contactsData.message || contactsData.error || `Couldn't fetch contacts (HTTP ${contactsRes.status})`);
  }

  const contacts = contactsData.contacts || [];
  let imported = 0, failed = 0;

  for (const contact of contacts) {
    try {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("agency_id", client.agency_id)
        .eq("ghl_contact_id", contact.id)
        .maybeSingle();
      if (existing) continue; // already imported, not a failure — just skip

      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || contact.name || "";
      const company = contact.companyName || "";

      let linkedinUrl = null;
      if (linkedinFieldId && Array.isArray(contact.customFields)) {
        const field = contact.customFields.find((f) => f.id === linkedinFieldId);
        linkedinUrl = field?.value || field?.field_value || null;
      }

      let linkedinUrn = null;
      let needsReview = true;
      let reviewReason = null;

      if (linkedinUrl && client.unipile_account_id) {
        const lookupRes = await fetch(`${getBaseUrl(req)}/api/linkedin/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedin_url: linkedinUrl, account_id: client.unipile_account_id }),
        });
        const lookupData = await lookupRes.json();
        if (lookupData.ok) {
          linkedinUrn = lookupData.profile.linkedin_urn;
          needsReview = false;
        } else {
          reviewReason = `Couldn't verify LinkedIn URL: ${lookupData.error || "lookup failed"}`;
        }
      } else if (name && client.unipile_account_id) {
        const searchRes = await fetch(`${getBaseUrl(req)}/api/linkedin/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: client.id, keywords: [name, company].filter(Boolean).join(" ") }),
        });
        const searchData = await searchRes.json();
        const candidate = searchData.results?.[0];
        if (candidate) {
          linkedinUrl = candidate.linkedin_url || null;
          linkedinUrn = candidate.linkedin_urn || null;
          reviewReason = `Guessed match from name/company search — confirm this is the right "${name}" before activating`;
        } else {
          reviewReason = "No LinkedIn search match found for this name/company";
        }
      } else {
        reviewReason = "No LinkedIn URL field and no name to search with";
      }

      const { error: insertErr } = await supabase.from("leads").insert({
        agency_id: client.agency_id,
        name: name || "(unknown — from GHL)",
        company: company || null,
        linkedin_url: linkedinUrl,
        linkedin_urn: linkedinUrn,
        ghl_contact_id: contact.id,
        sequence_status: needsReview ? "needs_review" : "active",
        current_step: 0,
        step_entered_at: new Date().toISOString(),
        status: "pending",
        review_reason: reviewReason,
      });
      if (insertErr) { console.error("GHL pull insert failed:", insertErr); failed++; continue; }
      imported++;
    } catch (err) {
      console.error("GHL pull exception for contact", contact.id, err);
      failed++;
    }
  }
  return { imported, failed };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
