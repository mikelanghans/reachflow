// api/scheduler/run.js
//
// The campaign scheduler. Called every hour by cron-job.org.
// Finds all leads due for a message, respects timing windows and daily limits,
// sends via Unipile or drops into the review queue if review mode is on.
//
// Protect this endpoint with a secret so only cron-job.org can call it:
//   Header: x-scheduler-secret = SCHEDULER_SECRET env var

import { createClient } from "@supabase/supabase-js";
import { sendDailyDigest } from "../notifications/reply.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const OPT_OUT_PATTERNS = [
  /\bremove\s+me\b/i,
  /\bunsubscribe\b/i,
  /\bstop\s+(emailing|contacting|messaging)\b/i,
  /\bnot\s+interested\b/i,
  /\bplease\s+(remove|unsubscribe|stop)\b/i,
  /\bopt\s*-?\s*out\b/i,
];

export default async function handler(req, res) {
  // Security check — only allow calls with the correct secret
  const secret = req.headers["x-scheduler-secret"];
  if (secret !== process.env.SCHEDULER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("Scheduler run started:", new Date().toISOString());
  const results = { processed: 0, sent: 0, social_actions: 0, queued: 0, skipped: 0, errors: [] };

  try {
    // 1. Get all active agencies with their settings
    const { data: agencies, error: agenciesError } = await supabase
      .from("agencies")
      .select(
        "id, daily_send_limit, daily_action_limit, send_days, send_start, send_end, timing_preset, voice_profile, vary_messages",
      );

    if (agenciesError) {
      console.error("Failed to fetch agencies:", agenciesError);
      results.errors.push({
        error: `agencies query failed: ${agenciesError.message}`,
      });
    }
    console.log(`Fetched ${agencies?.length || 0} agencies`);

    for (const agency of agencies || []) {
      try {
        await processAgency(agency, results);
      } catch (err) {
        console.error(`Agency ${agency.id} error:`, err);
        results.errors.push({ agency_id: agency.id, error: err.message });
      }
    }
  } catch (err) {
    console.error("Scheduler fatal error:", err);
    return res.status(500).json({ error: err.message, results });
  }

  console.log("Scheduler complete:", results);
  return res.status(200).json({ ok: true, results });
}

async function processAgency(agency, results) {
  const now = new Date();

  // Send daily digest at 8am
  if (now.getHours() === 8) {
    await maybeSendDailyDigest(agency, now);
  }

  // 2. Check if we're within the send window for this agency
  if (!isWithinSendWindow(now, agency)) {
    console.log(`Agency ${agency.id}: outside send window, skipping`);
    return;
  }

  // 3. Check daily limit — how many have we sent today?
  const todayUTC = now.toISOString().split("T")[0];
  const { count: sentToday } = await supabase
    .from("messages")
    .select("id", { count: "exact" })
    .eq("agency_id", agency.id)
    .eq("direction", "out")
    .gte("sent_at", todayUTC + "T00:00:00Z");

  const limit = agency.daily_send_limit || 20;
  if (sentToday >= limit) {
    console.log(
      `Agency ${agency.id}: daily limit ${limit} reached (${sentToday} sent)`,
    );
    return;
  }

  let remainingQuota = limit - sentToday;

  // 3b. Separate quota for non-message LinkedIn actions (views, likes, follows,
  // withdraws). LinkedIn rate-limits these independently of messages — capping
  // them at the message limit alone would under-protect the account, since an
  // aggressive sequence could pile on dozens of likes/follows with no message
  // sent at all. We track these via activity_log entries tagged with the action.
  const { count: actionsToday } = await supabase
    .from("activity_log")
    .select("id", { count: "exact" })
    .eq("agency_id", agency.id)
    .eq("type", "reply")
    .gte("created_at", todayUTC + "T00:00:00Z")
    .in("meta->>action", [
      "view_profile",
      "like_post",
      "comment_post",
      "follow_profile",
      "withdraw_request",
      "follow_company",
    ]);

  const actionLimit = agency.daily_action_limit || limit * 3; // social actions are cheaper than messages, default to a more generous cap
  let remainingActionQuota = actionLimit - (actionsToday || 0);
  if (remainingActionQuota <= 0) {
    console.log(
      `Agency ${agency.id}: daily LinkedIn action limit ${actionLimit} reached (${actionsToday} done) — messages may still send`,
    );
  }

  // 4. Get all active campaigns for this agency
  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, name, status, flow, review_mode, client_id")
    .eq("agency_id", agency.id)
    .eq("status", "active");

  if (campaignsError)
    console.error(
      `Agency ${agency.id}: campaigns query failed:`,
      campaignsError,
    );
  console.log(
    `Agency ${agency.id}: found ${campaigns?.length || 0} active campaigns`,
  );

  for (const campaign of campaigns || []) {
    if (remainingQuota <= 0) break;
    if (!campaign.flow || campaign.flow.length === 0) {
      console.log(
        `Campaign ${campaign.id} (${campaign.name}): empty flow, skipping`,
      );
      continue;
    }

    // Get the client's Unipile account ID
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, unipile_account_id, linkedin_connected")
      .eq("id", campaign.client_id)
      .single();

    if (clientError)
      console.error(
        `Campaign ${campaign.id}: client lookup failed:`,
        clientError,
      );

    if (!client?.unipile_account_id || !client.linkedin_connected) {
      console.log(
        `Campaign ${campaign.id} (${campaign.name}): no LinkedIn connected (client_id=${campaign.client_id}), skipping`,
      );
      continue;
    }

    // 5. Get leads in this campaign due for their next step
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("campaign_id", campaign.id)
      .eq("sequence_status", "active")
      .order("step_entered_at", { ascending: true })
      .limit(remainingQuota * 2); // fetch more than needed, filter below

    if (leadsError)
      console.error(`Campaign ${campaign.id}: leads query failed:`, leadsError);
    console.log(
      `Campaign ${campaign.id} (${campaign.name}): found ${leads?.length || 0} active leads due for processing`,
    );

    for (const lead of leads || []) {
      if (remainingQuota <= 0) break;

      const flowNodes = await flattenFlowForLead(campaign.flow, lead);
      const currentNode = flowNodes[lead.current_step];

      if (!currentNode) {
        // Lead has completed the sequence
        await supabase
          .from("leads")
          .update({ sequence_status: "completed" })
          .eq("id", lead.id);
        continue;
      }

      // Check if enough time has passed since entering this step
      const stepEnteredAt = new Date(lead.step_entered_at);
      const delayDays = currentNode.delay || 0;
      const sendAfter = new Date(
        stepEnteredAt.getTime() + delayDays * 24 * 60 * 60 * 1000,
      );

      if (now < sendAfter) {
        // Not time yet
        continue;
      }

      // Check suppression
      if (lead.email) {
        const { data: suppressed } = await supabase
          .from("suppressions")
          .select("id")
          .eq("agency_id", agency.id)
          .eq("email", lead.email)
          .single();

        if (suppressed) {
          await supabase
            .from("leads")
            .update({ sequence_status: "suppressed" })
            .eq("id", lead.id);
          results.skipped++;
          continue;
        }
      }

      // Route by node type — social/connection actions (no message content) vs
      // content-bearing actions (message, connection request, inmail)
      const SOCIAL_ONLY_TYPES = [
        "view_profile",
        "like_post",
        "comment_post",
        "follow_profile",
        "withdraw_request",
        "follow_company",
      ];
      const CONTENT_TYPES = [
        "message",
        "send_connection_request",
        "send_inmail",
        "connection_request",
      ];

      // ai_convo is fundamentally different from the other social actions:
      // it's not a one-shot fire-and-advance step, it's an ongoing mode that
      // stays at this step indefinitely, replying each time the lead sends
      // a new message, until something actually signals the goal is met
      // (e.g. a meeting gets booked). Handling it here, separately, rather
      // than lumping it into SOCIAL_ONLY_TYPES below, since it can validly
      // do nothing this run (no new reply yet) without that counting as a
      // skip, error, or step-advance the way every other action type does.
      if (currentNode.type === "ai_convo") {
        const convoResult = await runAiConversation({
          accountId: client.unipile_account_id,
          lead,
          agency,
          campaign,
        });
        if (convoResult.action === "wait") {
          continue; // nothing new to respond to — leave the lead exactly where it is
        }
        results.processed++;
        if (convoResult.action === "error") {
          results.errors.push({ lead_id: lead.id, error: convoResult.error || "ai_convo failed" });
          continue;
        }
        if (convoResult.action === "queued") {
          results.queued++;
          await sleep(1000 + Math.random() * 4000);
          continue;
        }
        results.sent++;
        if (convoResult.action === "booked") {
          await supabase
            .from("leads")
            .update({ status: "meeting", sequence_status: "completed" })
            .eq("id", lead.id);
          await supabase.from("activity_log").insert({
            agency_id: agency.id,
            type: "reply",
            message: `Meeting booked via AI conversation · ${lead.name}`,
            meta: { lead_id: lead.id, campaign: campaign.name },
          });
        }
        await sleep(1000 + Math.random() * 4000);
        continue;
      }

      if (SOCIAL_ONLY_TYPES.includes(currentNode.type)) {
        if (remainingActionQuota <= 0) {
          // Out of social-action quota for today — leave this lead at the
          // current step, try again next scheduler run.
          continue;
        }
        results.processed++;
        const actionOk = await performSocialAction({
          accountId: client.unipile_account_id,
          lead,
          node: currentNode,
          voiceProfile: agency.voice_profile,
        });
        if (actionOk) {
          remainingActionQuota--;
          results.social_actions++;
          await supabase.from("activity_log").insert({
            agency_id: agency.id,
            type: "reply",
            message: `${SOCIAL_ACTION_LABEL[currentNode.type] || currentNode.type} · ${lead.name}`,
            meta: {
              lead_id: lead.id,
              campaign: campaign.name,
              action: currentNode.type,
            },
          });
        } else {
          results.errors.push({
            lead_id: lead.id,
            error: `${currentNode.type} failed`,
          });
        }
        await advanceLeadStep(
          lead,
          campaign,
          results,
          agency.id,
          "social_action",
        );
        await sleep(1000 + Math.random() * 4000);
        continue;
      }

      if (!CONTENT_TYPES.includes(currentNode.type)) {
        // Unknown node type (e.g. a future addition) — skip safely rather than crash
        await advanceLeadStep(
          lead,
          campaign,
          results,
          agency.id,
          "skipped_unknown_type",
        );
        continue;
      }

      // Build the personalised message
      let message = personalise(currentNode.content || "", lead);

      // Fill any [bracketed] placeholders (e.g. "[topic]", "[ICP]") with
      // something specific and plausible based on this lead's actual
      // profile data — these are template stand-ins, not {{tokens}}, so
      // personalise() above doesn't touch them and they'd otherwise go out
      // to real prospects with literal brackets in the text.
      message = await fillPlaceholders(message, lead, agency.voice_profile);

      // Vary the phrasing per-lead so identical templates don't go out
      // verbatim to everyone — defaults to on, agencies can disable in
      // Settings if they want exact template control.
      if (agency.vary_messages !== false && message.trim()) {
        message = await varyMessage(message, agency.voice_profile);
      }

      results.processed++;

      if (campaign.review_mode) {
        // Add to review queue instead of sending
        await supabase.from("review_queue").insert({
          agency_id: agency.id,
          campaign_id: campaign.id,
          lead_id: lead.id,
          message_type: currentNode.label || currentNode.type,
          channel: currentNode.channel || "linkedin",
          message_body: message,
          status: "pending",
          scheduled_for: new Date().toISOString(),
        });
        results.queued++;

        // Log activity
        await supabase.from("activity_log").insert({
          agency_id: agency.id,
          type: "reply",
          message: `Message queued for review: ${lead.name}`,
          meta: { lead_id: lead.id, campaign: campaign.name },
        });
      } else {
        // Send immediately via Unipile
        const sent = await sendViaUnipile({
          accountId: client.unipile_account_id,
          lead,
          message,
          type:
            currentNode.type === "connection_request" ||
            currentNode.type === "send_connection_request"
              ? "connection_request"
              : currentNode.type === "send_inmail"
                ? "inmail"
                : "message",
        });

        if (sent) {
          // Save outbound message
          await supabase.from("messages").insert({
            agency_id: agency.id,
            lead_id: lead.id,
            direction: "out",
            body: message,
            channel: currentNode.channel || "linkedin",
          });

          // Log activity
          await supabase.from("activity_log").insert({
            agency_id: agency.id,
            type: "reply",
            message: `Message sent to ${lead.name} · ${lead.company}`,
            meta: { lead_id: lead.id, campaign: campaign.name },
          });

          results.sent++;
          remainingQuota--;
        } else {
          results.errors.push({
            lead_id: lead.id,
            error: "Unipile send failed",
          });
          continue;
        }
      }

      // Advance to next step
      await advanceLeadStep(lead, campaign, results, agency.id);

      // Random delay between sends (1–5 seconds) to appear human-like
      await sleep(1000 + Math.random() * 4000);
    }
  }
}

const SOCIAL_ACTION_LABEL = {
  view_profile: "Viewed profile",
  like_post: "Liked post",
  comment_post: "Commented on post",
  ai_convo: "AI conversation step",
  follow_profile: "Followed profile",
  withdraw_request: "Withdrew connection request",
  follow_company: "Followed company",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWithinSendWindow(now, agency) {
  // IMPORTANT: now.getDay()/now.getHours() return UTC values on Vercel's
  // serverless runtime, not the agency's local time. That meant "8:00–17:00"
  // was actually being enforced as 8am–5pm UTC — for a US-based agency that
  // silently blocks sends during their actual workday (confirmed in
  // production: a 1:33pm Pacific test was rejected as "outside send window"
  // because that's 20:33 UTC, past the 17:00 cutoff). Use the agency's IANA
  // timezone so the window means what it says.
  //
  // NOTE: this only makes the AGENCY's own send window timezone-correct.
  // The Settings UI separately claims per-PROSPECT timezone targeting
  // (detecting each lead's timezone from their LinkedIn location) — that
  // feature doesn't actually exist anywhere in this scheduler and would be
  // a much larger separate build (geocoding location strings to timezones).
  // Don't confuse the two; this fix doesn't implement that.
  const tz = agency.timezone || "America/Los_Angeles";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[parts.find((p) => p.type === "weekday")?.value];
  let hour = parseInt(parts.find((p) => p.type === "hour")?.value, 10);
  if (hour === 24) hour = 0; // some runtimes return 24 instead of 0 for midnight with hour12:false

  const sendDays = agency.send_days || [1, 2, 3, 4]; // Mon-Thu default
  if (!sendDays.includes(dayOfWeek)) return false;

  const startHour = parseInt((agency.send_start || "08:00").split(":")[0], 10);
  const endHour = parseInt((agency.send_end || "17:00").split(":")[0], 10);

  return hour >= startHour && hour < endHour;
}

// Flatten flow nodes with behaviour-based branching
// Checks actual lead status to decide which branch to follow at condition nodes
async function flattenFlowForLead(flow, lead) {
  const nodes = [];

  for (const node of flow || []) {
    if (node.type === "end") continue;

    if (node.type === "condition") {
      nodes.push(node);
      // Check the actual condition against the lead's current status
      const conditionMet = await evaluateCondition(node, lead);
      const branch = conditionMet ? node.yes : node.no;
      if (branch) nodes.push(...(await flattenFlowForLead(branch, lead)));
    } else if (node.type === "ab_split") {
      nodes.push(node);
      // Determine which variant this lead is in (based on lead ID modulo)
      const useA =
        parseInt(lead.id?.replace(/-/g, "").slice(0, 8), 16) % 2 === 0;
      const branch = useA ? node.a : node.b;
      if (branch) nodes.push(...(await flattenFlowForLead(branch, lead)));
    } else {
      nodes.push(node);
    }
  }

  return nodes.filter((n) => n.type !== "end");
}

async function evaluateCondition(node, lead) {
  const trigger = node.trigger || "replied";

  if (trigger === "replied") {
    // Check if lead has replied since entering this step
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact" })
      .eq("lead_id", lead.id)
      .eq("direction", "in")
      .gte("sent_at", lead.step_entered_at || "2000-01-01");
    return count > 0;
  }

  if (trigger === "connected") {
    return (
      lead.status === "connected" ||
      lead.status === "replied" ||
      lead.status === "meeting"
    );
  }

  if (trigger === "no_reply") {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact" })
      .eq("lead_id", lead.id)
      .eq("direction", "in");
    return count === 0;
  }

  return false;
}

// Simple personalisation — replace {{tokens}} with lead data
function personalise(template, lead) {
  return template
    .replace(/\{\{first_name\}\}/gi, lead.name?.split(" ")[0] || "there")
    .replace(
      /\{\{last_name\}\}/gi,
      lead.name?.split(" ").slice(1).join(" ") || "",
    )
    .replace(/\{\{full_name\}\}/gi, lead.name || "")
    .replace(/\{\{company\}\}/gi, lead.company || "your company")
    .replace(/\{\{title\}\}/gi, lead.title || "your role");
}

// Rewrites a personalised message so it doesn't look identical to every
// other lead in the sequence — same intent, different phrasing/structure.
// Controlled by agency.vary_messages (default on) so agencies that want
// exact, predictable template control can turn it off.
// Generates a real, specific comment on a lead's actual post — used by the
// comment_post social action. Deliberately fails CLOSED (returns null/empty
// rather than a generic fallback) if generation fails, since a vague
// "Great post!" comment posted blind is worse than skipping the step.
async function generateComment(postText, promptHint, voiceProfile) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !postText?.trim()) return null;

  const voiceContext = buildVoiceContextForScheduler(voiceProfile);
  const hint = promptHint?.trim()
    ? `Specific guidance for this comment: ${promptHint.trim()}\n\n`
    : "";
  const prompt = `${voiceContext}${hint}Write a short, genuine LinkedIn comment (1-2 sentences, under 200 characters) on this post. Reference something specific from the post itself — don't write a generic compliment. No emojis, no hashtags, no "Great post!" filler.\n\nPost:\n"${postText.slice(0, 1500)}"\n\nRespond with only the comment text, nothing else.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        temperature: 1,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    return text || null;
  } catch (err) {
    console.error("generateComment failed:", err);
    return null;
  }
}

// Fills [bracketed] placeholders in a message template with specific,
// plausible content inferred from the lead's actual profile data (title,
// company) — e.g. "[topic]" -> "scaling past six figures" for a coach
// targeting founders. Templates use [brackets] for things meant to be
// filled per-lead/per-campaign and {{double_braces}} for exact-substitution
// tokens (handled separately by personalise()); this only touches the
// former and leaves {{tokens}} untouched. Skips the API call entirely if
// there's nothing bracketed to fill. Fails open — returns the original
// message (brackets and all) rather than blocking the send if generation
// fails, since a message with leftover brackets is still better than no
// message at all.
async function fillPlaceholders(message, lead, voiceProfile) {
  if (!/\[[^\]]+\]/.test(message)) return message; // nothing to fill

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return message;

  const voiceContext = buildVoiceContextForScheduler(voiceProfile);
  const leadContext = [
    lead.name ? `Name: ${lead.name}` : null,
    lead.title ? `Title: ${lead.title}` : null,
    lead.company ? `Company: ${lead.company}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `${voiceContext}This outreach message has [bracketed] placeholders meant to be filled in with something specific and plausible based on who this person is. Replace each [bracketed] placeholder with natural text that fits the sentence — infer something reasonable from their title/company below. Keep everything else exactly as written, including any {{tokens}} in double braces (leave those untouched). Don't add brackets, quotes, or notes — just the finished message.\n\nLead:\n${leadContext || "(no profile data available)"}\n\nMessage:\n"${message}"\n\nRespond with only the finished message, nothing else.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return message;
    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    return text || message;
  } catch (err) {
    console.error("fillPlaceholders failed, sending original:", err);
    return message; // fail open
  }
}

// Handles the ai_convo flow step: checks whether the lead has sent a new
// message we haven't responded to yet, and if so, generates a real reply
// with Claude (using the full conversation history + voice profile) and
// sends it. This is an ongoing mode, not a one-shot action — most runs will
// find nothing new and return {action:'wait'}, which is normal, not an
// error or a skip.
async function runAiConversation({ accountId, lead, agency, campaign }) {
  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("direction, body, sent_at")
    .eq("lead_id", lead.id)
    .order("sent_at", { ascending: true });

  if (historyError) {
    return { action: "error", error: "Couldn't load conversation history" };
  }
  if (!history || history.length === 0) {
    return { action: "wait" }; // conversation hasn't started yet
  }
  if (history[history.length - 1].direction !== "in") {
    return { action: "wait" }; // we already replied; waiting on them
  }
  // If review mode is on, also don't generate-and-reply again while a
  // previous AI reply is still sitting unreviewed in the queue — otherwise
  // every scheduler run would queue up another draft for the same message.
  if (campaign.review_mode) {
    const { count: pendingCount } = await supabase
      .from("review_queue")
      .select("id", { count: "exact" })
      .eq("lead_id", lead.id)
      .eq("status", "pending");
    if (pendingCount > 0) return { action: "wait" };
  }

  const transcript = history
    .map((m) => `${m.direction === "in" ? lead.name || "Lead" : "You"}: ${m.body}`)
    .join("\n");

  const voiceContext = buildVoiceContextForScheduler(agency.voice_profile);
  const prompt = `${voiceContext}You're continuing a real LinkedIn conversation with a prospect, working toward getting them on a call. Read the conversation below and write your next reply — natural, conversational, 1-3 sentences. Handle objections honestly; don't push past a clear "no." If they've explicitly agreed to a call/meeting in their most recent message, acknowledge it warmly rather than re-asking.\n\nConversation so far (oldest to newest):\n${transcript}\n\nRespond in exactly this format, nothing else:\nREPLY: <your next message>\nBOOKED: <yes only if they explicitly agreed to a meeting/call in their most recent message, otherwise no>`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { action: "wait" }; // fail closed — don't reply with nothing useful

  let replyText, booked = false;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        temperature: 0.8,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return { action: "error", error: `Claude API returned ${response.status}` };
    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text?.trim() || "";
    const match = text.match(/REPLY:\s*([\s\S]*?)\n+BOOKED:\s*(yes|no)/i);
    if (match) {
      replyText = match[1].trim();
      booked = match[2].toLowerCase() === "yes";
    } else {
      replyText = text; // fallback if Claude didn't follow the format exactly
    }
  } catch (err) {
    return { action: "error", error: err.message || "Claude API call failed" };
  }

  if (!replyText) return { action: "error", error: "Empty AI reply" };

  // Respect review mode — an AI-drafted reply going out to a real person
  // with no human in the loop is exactly the case review_mode exists for.
  // Queue it the same way regular outbound messages already are, rather
  // than sending directly.
  if (campaign.review_mode) {
    await supabase.from("review_queue").insert({
      agency_id: agency.id,
      campaign_id: campaign.id,
      lead_id: lead.id,
      message_type: "AI conversation reply",
      channel: "linkedin",
      message_body: replyText,
      status: "pending",
      scheduled_for: new Date().toISOString(),
    });
    await supabase.from("activity_log").insert({
      agency_id: agency.id,
      type: "reply",
      message: `AI reply queued for review: ${lead.name}`,
      meta: { lead_id: lead.id, campaign: campaign.name, preview: replyText.slice(0, 80) },
    });
    return { action: "queued", booked };
  }

  const sent = await sendViaUnipile({ accountId, lead, message: replyText, type: "message" });
  if (!sent) return { action: "error", error: "Unipile send failed" };

  await supabase.from("messages").insert({
    agency_id: agency.id,
    lead_id: lead.id,
    direction: "out",
    body: replyText,
    channel: "linkedin",
  });
  await supabase.from("activity_log").insert({
    agency_id: agency.id,
    type: "reply",
    message: `AI replied to ${lead.name}`,
    meta: { lead_id: lead.id, campaign: campaign.name, preview: replyText.slice(0, 80) },
  });

  return { action: booked ? "booked" : "replied" };
}

async function varyMessage(message, voiceProfile) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return message; // fail open — send the template as-is rather than block sending

  const voiceContext = buildVoiceContextForScheduler(voiceProfile);
  const prompt = `${voiceContext}Rewrite this outreach message so it reads naturally and doesn't look like a templated mass-message — vary sentence structure and word choice, but keep the same meaning, length, and any {{tokens}} exactly as they are. Don't add new claims or change the ask.\n\nMessage:\n"${message}"\n\nRespond with only the rewritten message, nothing else.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        temperature: 1,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return message;
    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    return text || message;
  } catch (err) {
    console.error("varyMessage failed, sending original:", err);
    return message; // fail open
  }
}

function buildVoiceContextForScheduler(voiceProfile) {
  if (!voiceProfile) return "";
  const { tone, description, doList, dontList } = voiceProfile;
  const TONE_LABEL = {
    warm_consultative: "warm and consultative",
    direct_confident: "direct and confident",
    casual_friendly: "casual and friendly",
    formal_executive: "formal and executive-level",
    playful_bold: "playful and bold",
  };
  const parts = [];
  if (tone && TONE_LABEL[tone]) parts.push(`Tone: ${TONE_LABEL[tone]}.`);
  if (description?.trim()) parts.push(description.trim());
  if (doList?.length) parts.push(`Do: ${doList.join("; ")}.`);
  if (dontList?.length) parts.push(`Avoid: ${dontList.join("; ")}.`);
  return parts.length ? `${parts.join(" ")}\n\n` : "";
}

async function advanceLeadStep(
  lead,
  campaign,
  results,
  agencyId,
  reason = "sent",
) {
  const flowNodes = await flattenFlowForLead(campaign.flow, lead);
  const nextStep = (lead.current_step || 0) + 1;
  const isComplete = nextStep >= flowNodes.length;

  await supabase
    .from("leads")
    .update({
      current_step: nextStep,
      step_entered_at: new Date().toISOString(),
      pipeline_stage: isComplete ? "contacted" : lead.pipeline_stage,
      sequence_status: isComplete ? "completed" : "active",
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", lead.id);
}

async function sendViaUnipile({ accountId, lead, message, type }) {
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!apiKey) return false;
  if (!lead.linkedin_urn) {
    console.warn(`Lead ${lead.id} has no linkedin_urn — skipping Unipile send`);
    return false;
  }

  try {
    let response;

    if (type === "connection_request") {
      // Confirmed against https://developer.unipile.com/reference/userscontroller_adduserbyidentifier —
      // POST /users/invite with provider_id/account_id/message in JSON.
      // The old code posted to /api/v1/linkedin/invitations, which doesn't
      // exist (confirmed 404 in production logs).
      response = await fetch("https://api49.unipile.com:17927/api/v1/users/invite", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: lead.linkedin_urn,
          account_id: accountId,
          message: message?.slice(0, 300) || undefined,
        }),
      });
    } else {
      // Confirmed against https://developer.unipile.com/docs/send-messages —
      // regular messages and InMail both go through POST /chats, and every
      // documented example (including the Node SDK internally) uses
      // multipart/form-data — there's no JSON variant shown anywhere for
      // this endpoint. The old code posted JSON to a nonexistent
      // /api/v1/linkedin/messages path.
      const form = new FormData();
      form.append("account_id", accountId);
      form.append("text", message || "");
      form.append("attendees_ids", lead.linkedin_urn);
      if (type === "inmail") {
        form.append("linkedin[api]", "classic");
        form.append("linkedin[inmail]", "true");
      }
      // Do NOT set Content-Type manually — fetch sets the correct
      // multipart boundary automatically when given a FormData body.
      response = await fetch("https://api49.unipile.com:17927/api/v1/chats", {
        method: "POST",
        headers: { "X-API-KEY": apiKey },
        body: form,
      });
    }

    if (!response.ok) {
      const rawErr = await response.text().catch(() => "");
      let err = {};
      try { err = JSON.parse(rawErr); } catch { err = { message: rawErr.slice(0, 300) }; }
      console.error("Unipile send error:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unipile send exception:", err);
    return false;
  }
}

// Performs a no-content LinkedIn action (view, like, follow, withdraw, comment)
// via Unipile. comment_post and ai_convo need richer handling (AI-generated
// content based on the lead's recent post / conversation) — for now they log
// the action and advance the step; full AI-driven content generation for
// these two is a follow-up, since it requires fetching the lead's actual
// recent post content from Unipile first.
async function performSocialAction({ accountId, lead, node, voiceProfile }) {
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!apiKey) return false;
  if (!lead.linkedin_urn) {
    console.warn(`Lead ${lead.id} has no linkedin_urn — skipping ${node.type}`);
    return false;
  }

  const base = "https://api49.unipile.com:17927/api/v1";

  try {
    let response;

    switch (node.type) {
      case "view_profile":
        response = await fetch(
          `${base}/users/${lead.linkedin_urn}?account_id=${accountId}`,
          {
            method: "GET",
            headers: { "X-API-KEY": apiKey },
          },
        );
        break;

      case "follow_profile":
        // There is no dedicated "follow a profile" endpoint in Unipile's
        // documented API (confirmed: the old /users/{urn}/follow path
        // 404'd in production). Following is done via Unipile's "Get raw
        // data" passthrough route, which replays a LinkedIn Voyager API
        // call on the user's behalf. See:
        // https://developer.unipile.com/docs/get-raw-data-example
        response = await fetch(`${base}/linkedin`, {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            method: "POST",
            request_url: `https://www.linkedin.com/voyager/api/feed/dash/followingStates/urn:li:fsd_followingState:urn:li:fsd_profile:${lead.linkedin_urn}`,
            body: { patch: { $set: { following: true } } },
            encoding: false,
          }),
        });
        break;

      case "follow_company":
        // Same raw-passthrough mechanism as follow_profile, targeting a
        // company URN instead of a profile URN. NOTE: this is inferred by
        // analogy with Unipile's documented profile-follow example rather
        // than confirmed against an explicit company-follow example —
        // watch the logs the first few times this runs.
        if (!lead.company_urn) {
          console.warn(
            `Lead ${lead.id} has no company_urn — skipping follow_company`,
          );
          return false;
        }
        response = await fetch(`${base}/linkedin`, {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            method: "POST",
            request_url: `https://www.linkedin.com/voyager/api/feed/dash/followingStates/urn:li:fsd_followingState:urn:li:fsd_company:${lead.company_urn}`,
            body: { patch: { $set: { following: true } } },
            encoding: false,
          }),
        });
        break;

      case "like_post": {
        // Confirmed against https://developer.unipile.com/reference/postscontroller_addpostreaction —
        // POST /posts/reaction with post_id/account_id/reaction_type in body.
        // post_id must be the post's `social_id` (confirmed in
        // https://developer.unipile.com/docs/posts-and-comments), which we
        // don't have stored anywhere — nothing populates last_post_urn on a
        // lead. Rather than depend on a column that's never written, fetch
        // their most recent post just-in-time via
        // https://developer.unipile.com/reference/userscontroller_listallposts.
        let postId = lead.last_post_urn;
        if (!postId) {
          const postsRes = await fetch(
            `${base}/users/${lead.linkedin_urn}/posts?account_id=${accountId}&limit=1`,
            { headers: { "X-API-KEY": apiKey } },
          );
          if (!postsRes.ok) {
            response = postsRes;
            break;
          }
          const postsData = await postsRes.json();
          const items = postsData.items || postsData.object?.items || [];
          postId = items[0]?.social_id;
          if (!postId) {
            console.warn(
              `Lead ${lead.id} has no recent posts to like — skipping like_post`,
            );
            return false;
          }
        }
        response = await fetch(`${base}/posts/reaction`, {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            post_id: postId,
            reaction_type: "like",
          }),
        });
        break;
      }

      case "withdraw_request": {
        // Confirmed against https://developer.unipile.com/reference/userscontroller_cancelinvitation —
        // cancelling needs the invitation's own id, not the recipient's
        // profile URN, so look up the pending sent invitation first. Field
        // names on the invitation object aren't confirmed from docs alone,
        // so we match defensively against several plausible names and log
        // the raw shape if none match (check Vercel logs to tighten this
        // up once we see a real example).
        const sentRes = await fetch(
          `${base}/users/invite/sent?account_id=${accountId}&limit=250`,
          { headers: { "X-API-KEY": apiKey } },
        );
        if (!sentRes.ok) {
          response = sentRes;
          break;
        }
        const sentData = await sentRes.json();
        const items = sentData.items || sentData.object?.items || [];
        const invite = items.find((inv) =>
          [
            inv.provider_id, inv.user_id, inv.invited_user_id,
            inv.recipient_id, inv.recipient_provider_id, inv.profile_id,
          ].includes(lead.linkedin_urn),
        );
        if (!invite) {
          console.warn(
            `No pending sent invitation found for lead ${lead.id} (urn ${lead.linkedin_urn}) — may already be withdrawn/accepted. Raw items for reference:`,
            JSON.stringify(items.slice(0, 3)),
          );
          return false;
        }
        response = await fetch(
          `${base}/users/invite/sent/${invite.id}?account_id=${accountId}`,
          { method: "DELETE", headers: { "X-API-KEY": apiKey } },
        );
        break;
      }

      case "comment_post": {
        // Confirmed against https://developer.unipile.com/reference/postscontroller_sendcomment —
        // POST /posts/{post_id}/comments with account_id/text in body,
        // where post_id is the post's social_id. Previously a deliberate
        // no-op; now generates a real, specific comment via Claude based
        // on the post's actual content, using the same pattern as
        // varyMessage below.
        const postsRes = await fetch(
          `${base}/users/${lead.linkedin_urn}/posts?account_id=${accountId}&limit=1`,
          { headers: { "X-API-KEY": apiKey } },
        );
        if (!postsRes.ok) {
          response = postsRes;
          break;
        }
        const postsData = await postsRes.json();
        const items = postsData.items || postsData.object?.items || [];
        const post = items[0];
        if (!post?.social_id) {
          console.warn(
            `Lead ${lead.id} has no recent posts to comment on — skipping comment_post`,
          );
          return false;
        }
        if (!post.text?.trim()) {
          console.warn(
            `Lead ${lead.id}'s most recent post has no text content (image/video-only?) — skipping comment_post rather than commenting blind`,
          );
          return false;
        }

        const commentText = await generateComment(
          post.text || "",
          node.promptHint,
          voiceProfile,
        );
        if (!commentText) {
          console.warn(
            `Lead ${lead.id}: comment generation failed/empty — skipping comment_post rather than posting something generic`,
          );
          return false;
        }

        response = await fetch(`${base}/posts/${post.social_id}/comments`, {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: accountId, text: commentText }),
        });
        break;
      }

      default:
        console.warn(`Unknown social action type: ${node.type}`);
        return false;
    }

    if (!response.ok) {
      const rawErr = await response.text().catch(() => "");
      let err = {};
      try { err = JSON.parse(rawErr); } catch { err = { message: rawErr.slice(0, 300) }; }
      console.error(`Unipile ${node.type} error:`, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Unipile ${node.type} exception:`, err);
    return false;
  }
}

async function maybeSendDailyDigest(agency, now) {
  try {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yday = yesterday.toISOString().split("T")[0];

    const [{ count: sent }, { data: replies }, { count: meetings }] =
      await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact" })
          .eq("agency_id", agency.id)
          .eq("direction", "out")
          .gte("sent_at", yday + "T00:00:00Z")
          .lt("sent_at", yday + "T23:59:59Z"),
        supabase
          .from("messages")
          .select("leads(name, company)")
          .eq("agency_id", agency.id)
          .eq("direction", "in")
          .gte("sent_at", yday + "T00:00:00Z"),
        supabase
          .from("leads")
          .select("id", { count: "exact" })
          .eq("agency_id", agency.id)
          .eq("status", "meeting")
          .gte("updated_at", yday + "T00:00:00Z"),
      ]);

    if (!sent && !replies?.length) return; // Nothing to report

    const { data: user } = await supabase
      .from("users")
      .select("email")
      .eq("agency_id", agency.id)
      .eq("role", "admin")
      .single();
    if (!user?.email) return;

    await sendDailyDigest({
      agencyEmail: user.email,
      stats: {
        sent: sent || 0,
        replies: replies?.length || 0,
        meetings: meetings || 0,
        replyNames:
          replies
            ?.slice(0, 5)
            .map((r) => `${r.leads?.name} · ${r.leads?.company}`)
            .filter(Boolean) || [],
      },
      appUrl: process.env.APP_URL || "https://app.reachflow.io",
    });
  } catch (err) {
    console.error("Daily digest error (non-fatal):", err);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
