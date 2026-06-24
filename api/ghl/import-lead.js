// api/ghl/import-lead.js
//
// Webhook target for a GoHighLevel workflow's "Webhook" action. Add this
// action to any GHL workflow (e.g. triggered by a tag like "Send to
// ReachFlow") pointing at this URL, and each contact that hits it gets
// created as a ReachFlow lead.
//
// Required URL query params (set once when you build the webhook URL in
// Settings → GoHighLevel Integration):
//   secret        = GHL_WEBHOOK_SECRET env var
//   agency_id     = which agency this lead belongs to
//   client_id     = which client's connected LinkedIn account to search
//                    with, if we need to fuzzy-match a profile
//   linkedin_field = the GHL custom field KEY that holds a LinkedIn URL,
//                    if one exists (e.g. "linkedin_url")
//   campaign_id   = (optional) auto-assign into this campaign
//
// Resolution, in order:
//   1. Contact has a LinkedIn URL in the mapped custom field → resolve its
//      real linkedin_urn via /api/linkedin/lookup, sequence_status: active.
//   2. No LinkedIn URL, but we have a name → fuzzy-match via real LinkedIn
//      search using the given client's account, sequence_status:
//      needs_review (a guessed match should never auto-run a real outreach
//      sequence against a possibly-wrong person).
//   3. Neither → lead still gets created (so the contact isn't lost), but
//      flagged needs_review with no LinkedIn data at all.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { secret, agency_id, client_id, linkedin_field, campaign_id } = req.query;

  if (!process.env.GHL_WEBHOOK_SECRET || secret !== process.env.GHL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid or missing secret" });
  }
  if (!agency_id) return res.status(400).json({ error: "agency_id query param is required" });

  // GHL's webhook payload shape varies by workflow config, so read
  // defensively rather than assuming one exact structure.
  const body = req.body || {};
  const firstName = body.first_name || body.contact?.first_name || "";
  const lastName  = body.last_name  || body.contact?.last_name  || "";
  const name = [firstName, lastName].filter(Boolean).join(" ").trim()
    || body.full_name || body.contact?.full_name || body.name || "";
  const company = body.companyName || body.company_name || body.contact?.companyName || "";
  const title = body.title || body.jobTitle || body.contact?.title || "";
  const ghlContactId = body.contact_id || body.contactId || body.id || body.contact?.id || null;

  // Custom fields can arrive as an array of {key, value} or {id, value}
  // pairs, or as a flat object, depending on GHL workflow config — check
  // both shapes for whichever field key was configured as the LinkedIn URL.
  let linkedinUrlFromField = null;
  if (linkedin_field) {
    const customFields = body.customFields || body.contact?.customFields || body.custom_fields;
    if (Array.isArray(customFields)) {
      const match = customFields.find(
        (f) => f.key === linkedin_field || f.id === linkedin_field || f.name === linkedin_field,
      );
      linkedinUrlFromField = match?.value || match?.field_value || null;
    } else if (customFields && typeof customFields === "object") {
      linkedinUrlFromField = customFields[linkedin_field] || null;
    }
    // Some GHL workflows also flatten custom fields directly onto the body
    if (!linkedinUrlFromField && body[linkedin_field]) {
      linkedinUrlFromField = body[linkedin_field];
    }
  }

  if (!name && !linkedinUrlFromField) {
    return res.status(400).json({ error: "Contact has neither a name nor a LinkedIn URL — nothing to import" });
  }

  // Idempotency: if this exact GHL contact was already imported, don't
  // create a duplicate lead every time the workflow re-fires.
  if (ghlContactId) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("agency_id", agency_id)
      .eq("ghl_contact_id", ghlContactId)
      .maybeSingle();
    if (existing) {
      return res.status(200).json({ ok: true, action: "skipped", reason: "already imported", lead_id: existing.id });
    }
  }

  let linkedinUrl = linkedinUrlFromField || null;
  let linkedinUrn = null;
  let needsReview = true;
  let reviewReason = null;

  // Tier 1: real LinkedIn URL from the mapped field
  if (linkedinUrl) {
    const client = client_id
      ? await supabase.from("clients").select("unipile_account_id").eq("id", client_id).maybeSingle()
      : { data: null };
    if (client.data?.unipile_account_id) {
      try {
        const lookupRes = await fetch(
          `${getBaseUrl(req)}/api/linkedin/lookup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linkedin_url: linkedinUrl, account_id: client.data.unipile_account_id }),
          },
        );
        const lookupData = await lookupRes.json();
        if (lookupData.ok) {
          linkedinUrn = lookupData.profile.linkedin_urn;
          needsReview = false;
        } else {
          reviewReason = `Couldn't verify LinkedIn URL: ${lookupData.error || "lookup failed"}`;
        }
      } catch (err) {
        reviewReason = `LinkedIn lookup failed: ${err.message}`;
      }
    } else {
      reviewReason = "No connected LinkedIn account available to verify this URL";
    }
  }
  // Tier 2: no URL, but we have a name — try a fuzzy match via real search.
  // search.js does its own client → unipile_account_id lookup internally,
  // so just pass client_id straight through rather than duplicating that
  // lookup here (and critically: it expects client_id, not a raw account_id).
  else if (name && client_id) {
    try {
      const searchRes = await fetch(`${getBaseUrl(req)}/api/linkedin/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id,
          keywords: [name, company].filter(Boolean).join(" "),
        }),
      });
      const searchData = await searchRes.json();
      const candidate = searchData.results?.[0];
      if (candidate) {
        linkedinUrl = candidate.linkedin_url || null;
        linkedinUrn = candidate.linkedin_urn || null;
        reviewReason = `Guessed match from name/company search — confirm this is the right "${name}" before activating`;
      } else {
        reviewReason = searchData.error || "No LinkedIn search match found for this name/company";
      }
    } catch (err) {
      reviewReason = `LinkedIn search failed: ${err.message}`;
    }
  }
  // Tier 3: nothing to go on
  else {
    reviewReason = "No LinkedIn URL field mapped and no client account to search with";
  }

  const { data: inserted, error } = await supabase
    .from("leads")
    .insert({
      agency_id,
      campaign_id: campaign_id || null,
      name: name || "(unknown — from GHL)",
      title: title || null,
      company: company || null,
      linkedin_url: linkedinUrl,
      linkedin_urn: linkedinUrn,
      ghl_contact_id: ghlContactId,
      sequence_status: needsReview ? "needs_review" : "active",
      current_step: 0,
      step_entered_at: new Date().toISOString(),
      status: "pending",
      review_reason: reviewReason,
    })
    .select()
    .single();

  if (error) {
    console.error("GHL lead import failed:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.status(200).json({
    ok: true,
    action: "created",
    lead_id: inserted.id,
    needs_review: needsReview,
    review_reason: reviewReason,
  });
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
