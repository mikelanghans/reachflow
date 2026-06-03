import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import AuthScreen from "./AuthScreen.jsx";
import { useSupabaseData } from "./useSupabaseData.js";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const T = {
  bg: "#0d1117", surface: "#161b22", card: "#1c2128", border: "#30363d",
  accent: "#2dce98", accentBg: "rgba(45,206,152,0.12)", accentDim: "rgba(45,206,152,0.06)",
  text: "#e6edf3", muted: "#7d8590", faint: "#3d444d",
  blue: "#58a6ff", green: "#3fb950", yellow: "#d29922", red: "#f85149", purple: "#bc8cff",
};

const DEFAULT_BRAND = {
  name: "ReachFlow", tagline: "Agency Console",
  color: "#2dce98", logoUrl: "", darkBg: "#0d1117",
};

// ─── useLocalStorage hook ─────────────────────────────────────────────────────
function useLocalStorage(key, defaultValue) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : defaultValue; } catch { return defaultValue; }
  });
  const set = v => {
    const next = typeof v === "function" ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };
  return [val, set];
}

const DEFAULT_CLIENTS = [
  { id: 1, name: "TechCorp Solutions", initials: "TC", color: T.blue, campaigns: 3, active: true, messages: 1247, replies: 134, meetings: 12 },
  { id: 2, name: "Meridian Growth", initials: "MG", color: T.accent, campaigns: 2, active: true, messages: 834, replies: 98, meetings: 8 },
  { id: 3, name: "Apex Ventures", initials: "AV", color: T.purple, campaigns: 1, active: false, messages: 412, replies: 41, meetings: 4 },
  { id: 4, name: "Blue River Labs", initials: "BR", color: T.yellow, campaigns: 2, active: true, messages: 672, replies: 87, meetings: 9 },
];

const DEFAULT_CAMPAIGNS = [
  { id: 1, client: "TechCorp Solutions", name: "Q2 SaaS Outreach",          status: "active", leads: 450, sent: 312, replies: 47, meetings: 6, channel: "LinkedIn + Email", reviewMode: false },
  { id: 2, client: "TechCorp Solutions", name: "Enterprise Decision Makers", status: "active", leads: 280, sent: 198, replies: 28, meetings: 4, channel: "LinkedIn",        reviewMode: true  },
  { id: 3, client: "Meridian Growth",    name: "FinTech Founders",           status: "active", leads: 340, sent: 267, replies: 41, meetings: 5, channel: "LinkedIn + Email", reviewMode: false },
  { id: 4, client: "Apex Ventures",      name: "Series B Targets",           status: "paused", leads: 150, sent: 124, replies: 18, meetings: 2, channel: "Email",           reviewMode: true  },
  { id: 5, client: "Blue River Labs",    name: "DevOps Engineers",           status: "active", leads: 520, sent: 389, replies: 54, meetings: 7, channel: "LinkedIn",        reviewMode: false },
];

const DEFAULT_LEADS = [
  // ── Has inbox thread ──────────────────────────────────────────────────────
  { id: 1, name: "Marcus Williams", title: "CTO", company: "Notion",
    initials: "MW", color: "#58a6ff", clientColor: "#58a6ff",
    campaign: "Enterprise Decision Makers", client: "TechCorp Solutions",
    pipelineStage: "engaged", days: 2, status: "replied", unread: true, last: "5h ago",
    messages: [
      { id: 1, dir: "out", text: "Hi Marcus — I came across your work on Notion's API infrastructure. Really impressive how you've handled scale. I help CTOs in B2B SaaS streamline their outbound without adding headcount. Would a 20-min call be worth it?", time: "Mon 9:02am" },
      { id: 2, dir: "in",  text: "Thanks for reaching out! Sounds interesting. What does your solution actually do?", time: "Mon 2:17pm" },
      { id: 3, dir: "out", text: "We automate personalised outreach across LinkedIn and email — think of it as a senior SDR that never sleeps. Our clients typically see 3–5x more meetings within 30 days. Happy to show you a quick demo?", time: "Tue 9:30am" },
      { id: 4, dir: "in",  text: "Sure, I'm open to it. What does Thursday afternoon look like for you?", time: "Tue 11:45am" },
    ]
  },
  { id: 2, name: "Sarah Chen", title: "VP of Engineering", company: "Stripe",
    initials: "SC", color: "#2dce98", clientColor: "#58a6ff",
    campaign: "Q2 SaaS Outreach", client: "TechCorp Solutions",
    pipelineStage: "contacted", days: 1, status: "replied", unread: true, last: "2h ago",
    messages: [
      { id: 1, dir: "out", text: "Hi Sarah, your recent post on Stripe's infrastructure migration was a great read. I work with engineering leaders who are scaling their go-to-market — curious if that's on your radar at all?", time: "Wed 10:15am" },
      { id: 2, dir: "in",  text: "Hi! That's kind, thanks. We're actually exploring some new tooling right now. What do you offer?", time: "Wed 3:40pm" },
    ]
  },
  { id: 3, name: "Elena Kozlov", title: "Founder & CEO", company: "Linear",
    initials: "EK", color: "#bc8cff", clientColor: "#bc8cff",
    campaign: "Series B Targets", client: "Apex Ventures",
    pipelineStage: "converted", days: 2, status: "meeting", unread: false, last: "3d ago",
    messages: [
      { id: 1, dir: "out", text: "Elena — congrats on Linear's Series B. I'd love to connect and share how we've helped other post-Series B founders build pipeline without burning their team out.", time: "Mon 8:00am" },
      { id: 2, dir: "in",  text: "Thanks! We're definitely in growth mode. Would love to hear more.", time: "Mon 10:22am" },
      { id: 3, dir: "out", text: "Perfect — I'll send over a calendar link. How does next Tuesday work?", time: "Mon 11:00am" },
      { id: 4, dir: "in",  text: "Tuesday at 2pm works great!", time: "Mon 12:34pm" },
      { id: 5, dir: "out", text: "Confirmed — calendar invite sent. Looking forward to it!", time: "Mon 12:45pm" },
    ]
  },
  { id: 4, name: "David Kim", title: "Product Lead", company: "Vercel",
    initials: "DK", color: "#d29922", clientColor: "#58a6ff",
    campaign: "Q2 SaaS Outreach", client: "TechCorp Solutions",
    pipelineStage: "contacted", days: 3, status: "replied", unread: false, last: "3d ago",
    messages: [
      { id: 1, dir: "out", text: "Hi David — big fan of Vercel's DX focus. We help product-led companies like yours build their outbound motion without it feeling robotic. Worth a quick chat?", time: "Tue 9:00am" },
      { id: 2, dir: "in",  text: "Appreciate the note. We're growing fast but outbound hasn't been our focus. What would this look like for us?", time: "Tue 4:55pm" },
    ]
  },
  { id: 5, name: "Aisha Okonkwo", title: "VP Sales", company: "HubSpot",
    initials: "AO", color: "#f85149", clientColor: "#2dce98",
    campaign: "FinTech Founders", client: "Meridian Growth",
    pipelineStage: "prospecting", days: 1, status: "connected", unread: false, last: "4d ago",
    messages: [
      { id: 1, dir: "out", text: "Hi Aisha — I help VP Sales leaders at companies like HubSpot add a scalable outbound layer without disrupting their existing team. Open to a quick conversation?", time: "Thu 10:00am" },
    ]
  },
  { id: 6, name: "Priya Patel", title: "Head of Growth", company: "Figma",
    initials: "PP", color: "#2dce98", clientColor: "#2dce98",
    campaign: "FinTech Founders", client: "Meridian Growth",
    pipelineStage: "prospecting", days: 2, status: "pending", unread: false, last: "1d ago",
    messages: [
      { id: 1, dir: "out", text: "Hi Priya — loved your talk on Figma's PLG motion at SaaStr. I work with growth leaders to layer in outbound without killing the product-led magic. Would a quick call be useful?", time: "Fri 9:30am" },
    ]
  },
  // ── Pipeline only (no inbox thread yet) ──────────────────────────────────
  { id: 7, name: "James O'Brien", title: "Director of Sales", company: "Salesforce",
    initials: "JO", color: "#3fb950", clientColor: "#d29922",
    campaign: "DevOps Engineers", client: "Blue River Labs",
    pipelineStage: "converted", days: 6, status: "meeting", unread: false, last: "2d ago", messages: [] },
  { id: 8, name: "Tom Hartley", title: "Engineering Manager", company: "Shopify",
    initials: "TH", color: "#7d8590", clientColor: "#d29922",
    campaign: "DevOps Engineers", client: "Blue River Labs",
    pipelineStage: "prospecting", days: 0, status: "pending", unread: false, last: "5d ago", messages: [] },
  { id: 9, name: "Raj Mehta", title: "VP of Product", company: "Intercom",
    initials: "RM", color: "#58a6ff", clientColor: "#58a6ff",
    campaign: "Q2 SaaS Outreach", client: "TechCorp Solutions",
    pipelineStage: "engaged", days: 5, status: "connected", unread: false, last: "6d ago", messages: [] },
  { id: 10, name: "Lena Fischer", title: "Head of Product", company: "Personio",
    initials: "LF", color: "#bc8cff", clientColor: "#2dce98",
    campaign: "FinTech Founders", client: "Meridian Growth",
    pipelineStage: "engaged", days: 4, status: "connected", unread: false, last: "5d ago", messages: [] },
  { id: 11, name: "Carlos Rivera", title: "CPO", company: "Deel",
    initials: "CR", color: "#d29922", clientColor: "#58a6ff",
    campaign: "Enterprise Decision Makers", client: "TechCorp Solutions",
    pipelineStage: "converted", days: 3, status: "meeting", unread: false, last: "4d ago", messages: [] },
];

// Keep module-level aliases so read-only components still work without props
let CLIENTS = DEFAULT_CLIENTS;
let CAMPAIGNS = DEFAULT_CAMPAIGNS;
let LEADS = DEFAULT_LEADS;

const ANALYTICS = [
  { day: "Mon", sent: 87, replies: 14, meetings: 2 },
  { day: "Tue", sent: 112, replies: 18, meetings: 3 },
  { day: "Wed", sent: 95, replies: 12, meetings: 1 },
  { day: "Thu", sent: 134, replies: 22, meetings: 4 },
  { day: "Fri", sent: 98, replies: 16, meetings: 2 },
  { day: "Sat", sent: 43, replies: 7, meetings: 1 },
  { day: "Sun", sent: 31, replies: 4, meetings: 0 },
];

const STATUS_COLOR = { active: T.green, paused: T.yellow, pending: T.muted, connected: T.blue, replied: T.accent, meeting: T.purple };
const STATUS_LABEL = { active: "Active", paused: "Paused", pending: "Pending", connected: "Connected", replied: "Replied", meeting: "Meeting Booked" };

function Badge({ status }) {
  const c = STATUS_COLOR[status] || T.muted;
  return (
    <span style={{ background: c + "22", color: c, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ─── ONBOARDING WIZARD ───────────────────────────────────────────────────────
function OnboardingWizard({ onComplete, onBack, brand = DEFAULT_BRAND }) {
  const [step, setStep] = useState(0);
  const [linked, setLinked] = useState(false);
  const [clientName, setClientName] = useState("");
  const [icp, setIcp] = useState({ title: "", industry: "", size: "", location: "" });
  const [seq, setSeq] = useState([
    { day: 0, type: "Connection Request", msg: "" },
    { day: 3, type: "Follow-up", msg: "" },
    { day: 7, type: "Value Add", msg: "" },
  ]);
  const [generating, setGenerating] = useState(null);

  const STEPS = ["Connect LinkedIn", "Define Your ICP", "Build Sequence", "Launch"];

  const generateMsg = async (i) => {
    setGenerating(i);
    const typeMap = { "Connection Request": "a short LinkedIn connection request note", "Follow-up": "a short LinkedIn follow-up message (day 3)", "Value Add": "a short LinkedIn value-add message (day 7)" };
    const prompt = `Write ${typeMap[seq[i].type]} for a ${icp.title || "tech executive"} in ${icp.industry || "SaaS"}. 2–3 sentences max. No generic openers. Sound human, not salesy. Return only the message text.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setSeq(s => s.map((x, j) => j === i ? { ...x, msg: text } : x));
    } catch (e) {}
    setGenerating(null);
  };

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", width: "100%", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const sel = { ...inp };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
          <button onClick={onBack} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← Back</button>
          <div style={{ flex: 1 }}>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt={brand.name} style={{ height: 24, objectFit: "contain" }} />
              : <div style={{ color: T.text, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {brand.name === "ReachFlow"
                    ? <span>reach<span style={{ color: brand.color }}>flow</span></span>
                    : <span style={{ color: brand.color }}>{brand.name}</span>}
                </div>
            }
          </div>
        </div>

        {/* Step bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: "2rem" }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? T.accent : T.faint, marginBottom: 6, transition: "background 0.3s" }} />
              <div style={{ color: i === step ? T.accent : i < step ? T.accent : T.muted, fontSize: 11, fontWeight: i === step ? 700 : 400, opacity: i > step ? 0.5 : 1 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "2rem" }}>

          {/* STEP 0 */}
          {step === 0 && (
            <div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Connect your LinkedIn</div>
              <div style={{ color: T.muted, fontSize: 14, marginBottom: "1.25rem", lineHeight: 1.6 }}>One-click OAuth — no browser extension, no manual cookie setup. Your account stays safe with human-like pacing built right in.</div>

              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Client name</div>
                <input style={inp} placeholder="e.g. Acme Corp" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.5rem", textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{ width: 52, height: 52, background: "#0077b5", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontWeight: 900, color: "#fff", fontSize: 22 }}>in</div>
                {!linked ? (
                  <>
                    <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>LinkedIn OAuth 2.0</div>
                    <div style={{ color: T.muted, fontSize: 13, marginBottom: "1rem" }}>Secure · No password stored · Revokable anytime</div>
                    <button onClick={() => setLinked(true)} style={{ background: "#0077b5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, width: "100%" }}>Connect LinkedIn Account</button>
                  </>
                ) : (
                  <>
                    <div style={{ color: T.accent, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✓ Connected</div>
                    <div style={{ color: T.muted, fontSize: 13 }}>LinkedIn account linked successfully</div>
                  </>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["No extension install — works in the cloud 24/7", "Built-in human-like pacing, zero configuration needed", "Safe rate limits applied automatically per LinkedIn guidelines"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: T.muted, fontSize: 13 }}>
                    <span style={{ color: T.accent, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Who are you targeting?</div>
              <div style={{ color: T.muted, fontSize: 14, marginBottom: "1.5rem", lineHeight: 1.6 }}>Define your ideal customer. The AI uses this context to personalise every single message — no extra prompting needed.</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Job Title</div>
                  <input style={inp} placeholder="e.g. VP of Sales" value={icp.title} onChange={e => setIcp(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Industry</div>
                  <select style={sel} value={icp.industry} onChange={e => setIcp(d => ({ ...d, industry: e.target.value }))}>
                    <option value="">Select...</option>
                    {["SaaS / Software", "FinTech", "E-Commerce", "Healthcare", "Real Estate", "Professional Services", "Manufacturing", "Recruitment"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Company Size</div>
                  <select style={sel} value={icp.size} onChange={e => setIcp(d => ({ ...d, size: e.target.value }))}>
                    <option value="">Any size</option>
                    {["1–10", "11–50", "51–200", "201–500", "500+"].map(o => <option key={o}>{o} employees</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Location</div>
                  <input style={inp} placeholder="e.g. United States" value={icp.location} onChange={e => setIcp(d => ({ ...d, location: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Build your sequence</div>
              <div style={{ color: T.muted, fontSize: 14, marginBottom: "1.5rem", lineHeight: 1.6 }}>Click <strong style={{ color: T.accent }}>Generate</strong> to get AI-written messages based on your ICP, or write your own. Each message auto-personalises per prospect at send time.</div>

              {seq.map((item, i) => (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{item.type}</span>
                      <span style={{ color: T.faint, fontSize: 12 }}>· Day {item.day}</span>
                    </div>
                    <button
                      onClick={() => generateMsg(i)}
                      disabled={generating === i}
                      style={{ background: generating === i ? T.faint : T.accentBg, color: T.accent, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: generating === i ? "default" : "pointer", fontWeight: 700, opacity: generating === i ? 0.7 : 1 }}>
                      {generating === i ? "Generating…" : "✦ Generate"}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    style={{ ...inp, resize: "vertical", fontSize: 13, lineHeight: 1.6 }}
                    placeholder={`Your ${item.type.toLowerCase()} message — or click Generate`}
                    value={item.msg}
                    onChange={e => setSeq(s => s.map((x, j) => j === i ? { ...x, msg: e.target.value } : x))}
                  />
                </div>
              ))}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: "1rem" }}>🚀</div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You're ready to launch</div>
              <div style={{ color: T.muted, fontSize: 14, marginBottom: "1.5rem", lineHeight: 1.7 }}>ReachFlow handles all the timing, personalisation, and follow-ups. You'll see results flowing in within 24 hours.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: "2rem" }}>
                {[["~20", "Daily actions"], ["3", "Sequence steps"], ["AI", "Per-prospect personalisation"]].map(([v, l]) => (
                  <div key={l} style={{ background: T.card, borderRadius: 10, padding: "0.875rem", border: `1px solid ${T.border}` }}>
                    <div style={{ color: T.accent, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{v}</div>
                    <div style={{ color: T.muted, fontSize: 11 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            {step > 0
              ? <button onClick={() => setStep(s => s - 1)} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14 }}>← Back</button>
              : <div />}
            <button
              onClick={() => {
                if (step < STEPS.length - 1) {
                  setStep(s => s + 1);
                } else {
                  const colors = [T.blue, T.accent, T.purple, T.yellow, T.green, "#f85149", "#bc8cff"];
                  const name = clientName.trim() || "New Client";
                  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const color = colors[Math.floor(Math.random() * colors.length)];
                  onComplete({ id: Date.now(), name, initials, color, campaigns: 0, active: true, messages: 0, replies: 0, meetings: 0 });
                }
              }}
              style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
              {step === STEPS.length - 1 ? "Launch Campaign →" : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, onAddClient, onSearch, brand = DEFAULT_BRAND }) {
  const accentBg = brand.color + "22";
  const pendingReviewCount = DEFAULT_QUEUE.filter(q => q.status === "pending").length;
  const NAV = [
    { id: "dashboard",    label: "Dashboard",        icon: "▦" },
    { id: "inbox",        label: "Inbox",             icon: "◫", badge: LEADS.filter(l => l.unread).length },
    { id: "pipeline",     label: "Pipeline",          icon: "◧" },
    { id: "campaigns",    label: "Campaigns",         icon: "◎" },
    { id: "queue",        label: "Review Queue",      icon: "🔍", badge: pendingReviewCount, badgeColor: "#d29922" },
    { id: "leads",        label: "Lead Lists",        icon: "◉" },
    { id: "triggers",     label: "Triggers",          icon: "⚡" },
    { id: "social",       label: "Social",            icon: "◈" },
    { id: "analytics",    label: "Analytics",         icon: "▣" },
    { id: "seo",          label: "Copy & SEO",        icon: "✍" },
    { id: "suppression",  label: "Suppression",       icon: "🚫" },
    { id: "settings",     label: "Settings",          icon: "⊙" },
  ];
  const COACH_NAV = { id: "coach", label: "AI Coach", icon: "✦" };
  return (
    <div style={{ width: 220, background: T.surface, borderRight: `1px solid ${T.border}`, height: "100vh", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0 }}>
      <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: `1px solid ${T.border}` }}>
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} style={{ height: 28, maxWidth: 160, objectFit: "contain", marginBottom: 4 }} onError={e => e.target.style.display = "none"} />
        ) : (
          <div style={{ color: T.text, fontSize: 17, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {brand.name === "ReachFlow"
              ? <span>reach<span style={{ color: brand.color }}>flow</span></span>
              : <span style={{ color: T.text }}>{brand.name}</span>}
          </div>
        )}
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{brand.tagline}</div>
      </div>

      <div style={{ padding: "0.75rem 0.75rem 0" }}>
        {NAV.map(n => (
          <div
            key={n.id}
            onClick={() => setView(n.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              color: view === n.id ? T.text : T.muted,
              background: view === n.id ? accentBg : "transparent",
              fontSize: 14, fontWeight: view === n.id ? 600 : 400,
            }}>
            <span style={{ fontSize: 14, opacity: view === n.id ? 1 : 0.6 }}>{n.icon}</span>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.badge > 0 && <span style={{ background: n.badgeColor || brand.color, color: n.badgeColor ? "#0d1117" : "#0d1117", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 8, minWidth: 16, textAlign: "center" }}>{n.badge}</span>}
          </div>
        ))}
      </div>

      <div style={{ padding: "0.75rem" }}>
        <button
          onClick={onSearch}
          style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14 }}>⌕</span>
          <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
          <kbd style={{ background: T.faint, color: T.faint, border: `1px solid ${T.faint}`, borderRadius: 3, padding: "1px 5px", fontSize: 10 }}>⌘K</kbd>
        </button>
        <button
          onClick={onAddClient}
          style={{ background: brand.color, color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>+</span> Add Client
        </button>
      </div>

      <div style={{ marginTop: "auto", padding: "0.75rem 0.75rem 0" }}>
        <div
          onClick={() => setView("coach")}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 6,
            color: view === "coach" ? T.text : brand.color,
            background: view === "coach" ? accentBg : brand.color + "11",
            border: `1px solid ${view === "coach" ? brand.color : brand.color + "44"}`,
            fontSize: 14, fontWeight: 600,
          }}>
          <span style={{ fontSize: 14 }}>{COACH_NAV.icon}</span>
          <span style={{ flex: 1 }}>{COACH_NAV.label}</span>
        </div>
      </div>

      <div style={{ padding: "0.5rem 1rem 1.25rem" }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>Agency Plan</div>
            <span style={{ background: accentBg, color: brand.color, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>PRO</span>
          </div>
          <div style={{ color: T.muted, fontSize: 11, marginBottom: 6 }}>4 / 10 client seats used</div>
          <div style={{ background: T.faint, height: 3, borderRadius: 2 }}>
            <div style={{ background: brand.color, height: 3, borderRadius: 2, width: "40%", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CLIENT REPORT ───────────────────────────────────────────────────────────
function ClientReport({ client, campaigns, onClose, brand = DEFAULT_BRAND }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const clientCampaigns = campaigns.filter(c => c.client === client.name);
  const replyRate = Math.round(client.replies / client.messages * 100);
  const convRate = Math.round(client.meetings / client.replies * 100);
  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  const WINS = [
    { name: "Elena Kozlov", title: "Founder & CEO", company: "Linear", day: "Tues 29 Apr" },
    { name: "James O'Brien", title: "Director of Sales", company: "Salesforce", day: "Mon 28 Apr" },
    { name: "Marcus Williams", title: "CTO", company: "Notion", day: "Fri 25 Apr" },
  ].slice(0, client.meetings > 8 ? 3 : 2);

  useEffect(() => {
    (async () => {
      const prompt = `Write a short, professional outreach performance summary for a client report. Tone: confident, clear, like a senior consultant writing to a client. No fluff.

Client: ${client.name}
Period: ${month}
Messages sent: ${client.messages.toLocaleString()}
Replies received: ${client.replies} (${replyRate}% reply rate)  
Meetings booked: ${client.meetings}
Active campaigns: ${client.campaigns}
Trend: improving month-on-month

Write 3 short paragraphs:
1. Overall performance headline — what the numbers mean in plain English
2. What's working — the strongest signal from this period
3. What comes next — one specific recommendation for next month

Keep it under 120 words total. No bullet points. Sound like a human expert, not a report template.`;
      try {
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
        });
        const data = await res.json();
        setSummary(data.content?.find(b => b.type === "text")?.text || "");
      } catch {
        setSummary(`${client.name} had a strong month. ${client.messages.toLocaleString()} messages generated ${client.replies} replies — a ${replyRate}% reply rate that outperforms the industry average of 8–12%. The ${client.meetings} meetings booked represent a ${convRate}% reply-to-meeting conversion, suggesting strong message-market fit.\n\nThe highest-performing sequences were connection requests targeting senior decision-makers, where personalised openers referencing recent company activity drove above-average acceptance rates.\n\nFor next month, we recommend expanding the lead list to include second-degree connections in adjacent verticals — early data suggests a 15–20% uplift in reply rate from warmer network proximity.`);
      }
      setLoading(false);
    })();
  }, []);

  const copyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const R = {
    overlay: { position: "fixed", inset: 0, background: "rgba(13,17,23,0.85)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "2rem 1rem" },
    page: { background: "#ffffff", borderRadius: 16, width: "100%", maxWidth: 720, marginBottom: "2rem" },
    header: { background: "#0d1117", borderRadius: "16px 16px 0 0", padding: "2rem 2.5rem" },
    body: { padding: "2.5rem" },
    section: { marginBottom: "2rem" },
    label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 8 },
    statCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.25rem", textAlign: "center" },
    statVal: { fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#0d1117", marginBottom: 4 },
    statLabel: { fontSize: 12, color: "#64748b" },
    campaignRow: { display: "flex", alignItems: "center", gap: 12, padding: "0.875rem 1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 8 },
    winRow: { display: "flex", alignItems: "center", gap: 12, padding: "0.875rem 0", borderBottom: "1px solid #f1f5f9" },
    p: { color: "#334155", fontSize: 14, lineHeight: 1.75, margin: "0 0 1rem" },
  };

  return (
    <div style={R.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={R.page}>
        {/* Dark header — brand anchor */}
        <div style={R.header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ marginBottom: 6 }}>
                {brand.logoUrl
                  ? <img src={brand.logoUrl} alt={brand.name} style={{ height: 22, objectFit: "contain" }} />
                  : <span style={{ color: brand.color, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {brand.name === "ReachFlow"
                        ? <span>reach<span style={{ color: "#fff" }}>flow</span></span>
                        : brand.name}
                      <span style={{ color: "#64748b" }}> · Client Report</span>
                    </span>}
              </div>
              <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{client.name}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>{month} · Prepared by {brand.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: client.color + "33", color: client.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, marginBottom: 6, marginLeft: "auto" }}>{client.initials}</div>
              <div style={{ color: "#475569", fontSize: 11 }}>{client.campaigns} campaigns</div>
            </div>
          </div>

          {/* Hero metric */}
          <div style={{ background: "rgba(45,206,152,0.1)", border: "1px solid rgba(45,206,152,0.25)", borderRadius: 12, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "2rem" }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Meetings booked this month</div>
              <div style={{ color: T.accent, fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{client.meetings}</div>
            </div>
            <div style={{ flex: 1, borderLeft: "1px solid rgba(45,206,152,0.2)", paddingLeft: "2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {[
                ["Reply rate", replyRate + "%", replyRate > 10 ? "↑ Above avg" : "On track"],
                ["Reply → Meeting", convRate + "%", "Strong conversion"],
              ].map(([l, v, note]) => (
                <div key={l}>
                  <div style={{ color: "#64748b", fontSize: 11, marginBottom: 2 }}>{l}</div>
                  <div style={{ color: "#ffffff", fontSize: 20, fontWeight: 800 }}>{v}</div>
                  <div style={{ color: T.accent, fontSize: 11, marginTop: 2 }}>{note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Light body */}
        <div style={R.body}>
          {/* Key metrics */}
          <div style={R.section}>
            <div style={R.label}>Activity overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                ["Messages Sent", client.messages.toLocaleString(), "#3b82f6"],
                ["Replies Received", client.replies, "#8b5cf6"],
                ["Connection Rate", Math.round(client.replies / client.messages * 100) + "%", "#f59e0b"],
              ].map(([l, v, col]) => (
                <div key={l} style={R.statCard}>
                  <div style={{ ...R.statVal, color: col }}>{v}</div>
                  <div style={R.statLabel}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI summary */}
          <div style={{ ...R.section, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.accent }}>✦</div>
              <div style={{ ...R.label, margin: 0 }}>Agency commentary</div>
            </div>
            {loading ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Writing performance summary…</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              summary?.split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} style={R.p}>{para}</p>
              ))
            )}
          </div>

          {/* Campaigns */}
          <div style={R.section}>
            <div style={R.label}>Campaigns this month</div>
            {clientCampaigns.length > 0 ? clientCampaigns.map(c => {
              const rr = Math.round(c.replies / c.sent * 100);
              const barW = Math.min(100, Math.round(c.sent / c.leads * 100));
              return (
                <div key={c.id} style={R.campaignRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ color: "#0d1117", fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                      <span style={{ color: "#64748b", fontSize: 12 }}>{c.sent}/{c.leads} sent</span>
                    </div>
                    <div style={{ background: "#e2e8f0", borderRadius: 3, height: 4, marginBottom: 6 }}>
                      <div style={{ background: T.accent, height: 4, borderRadius: 3, width: barW + "%" }} />
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      {[["Replies", c.replies], ["Reply rate", rr + "%"], ["Meetings", c.meetings]].map(([l, v]) => (
                        <span key={l} style={{ color: "#64748b", fontSize: 11 }}><span style={{ color: "#0d1117", fontWeight: 700 }}>{v}</span> {l}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>No campaigns this month.</div>
            )}
          </div>

          {/* Meetings won */}
          <div style={R.section}>
            <div style={R.label}>Meetings booked — recent wins</div>
            {WINS.map((w, i) => (
              <div key={i} style={{ ...R.winRow, borderBottom: i === WINS.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f1f5f9", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                  {w.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#0d1117", fontSize: 13, fontWeight: 600 }}>{w.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{w.title} · {w.company}</div>
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{w.day}</div>
                <div style={{ background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>Meeting</div>
              </div>
            ))}
          </div>

          {/* Footer CTAs */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · reachflow agency console</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyLink} style={{ background: copied ? "#dcfce7" : "#f8fafc", color: copied ? "#166534" : "#475569", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {copied ? "✓ Link copied!" : "🔗 Copy share link"}
              </button>
              <button style={{ background: "#0d1117", color: "#ffffff", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>↓ Download PDF</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT CLIENT MODAL ───────────────────────────────────────────────────────
function EditClientModal({ client, onClose, onSave }) {
  const [icp, setIcp]     = useState(client.icp     || { title: "", industry: "", size: "", location: "" });
  const [seq, setSeq]     = useState(client.sequence || [
    { day: 0, type: "Connection Request", msg: "" },
    { day: 3, type: "Follow-up", msg: "" },
    { day: 7, type: "Value Add", msg: "" },
  ]);
  const [generating, setGenerating] = useState(null);
  const [tab, setTab] = useState("icp");

  const generateMsg = async (i) => {
    setGenerating(i);
    const typeMap = { "Connection Request": "a short LinkedIn connection request note", "Follow-up": "a short LinkedIn follow-up message (day 3)", "Value Add": "a short LinkedIn value-add message (day 7)" };
    const prompt = `Write ${typeMap[seq[i].type]} for a ${icp.title || "tech executive"} in ${icp.industry || "SaaS"}. 2–3 sentences max. No generic openers. Sound human, not salesy. Return only the message text.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setSeq(s => s.map((x, j) => j === i ? { ...x, msg: text } : x));
    } catch {}
    setGenerating(null);
  };

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const label = { color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: "1rem" }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: client.color + "22", color: client.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{client.initials}</div>
              <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>{client.name}</div>
            </div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>Edit ICP & outreach sequence</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {[["icp", "ICP Settings"], ["sequence", "Sequence"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: "transparent", border: "none", borderBottom: `2px solid ${tab === id ? T.accent : "transparent"}`, color: tab === id ? T.accent : T.muted, padding: "10px 20px 12px", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, marginBottom: -1 }}>{lbl}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {tab === "icp" && (
            <div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.25rem", lineHeight: 1.6 }}>Update who this client is targeting. The AI uses this to personalise every message.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={label}>Job title</label><input style={inp} placeholder="e.g. VP of Sales" value={icp.title} onChange={e => setIcp(d => ({ ...d, title: e.target.value }))} /></div>
                <div>
                  <label style={label}>Industry</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={icp.industry} onChange={e => setIcp(d => ({ ...d, industry: e.target.value }))}>
                    <option value="">Select…</option>
                    {["SaaS / Software","FinTech","E-Commerce","Healthcare","Real Estate","Professional Services","Manufacturing","Recruitment"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={label}>Company size</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={icp.size} onChange={e => setIcp(d => ({ ...d, size: e.target.value }))}>
                    <option value="">Any size</option>
                    {["1–10","11–50","51–200","201–500","500+"].map(o => <option key={o}>{o} employees</option>)}
                  </select>
                </div>
                <div><label style={label}>Location</label><input style={inp} placeholder="e.g. United States" value={icp.location} onChange={e => setIcp(d => ({ ...d, location: e.target.value }))} /></div>
              </div>
            </div>
          )}

          {tab === "sequence" && (
            <div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.25rem", lineHeight: 1.6 }}>Edit the outreach messages for this client. Click Generate to rewrite using their current ICP.</div>
              {seq.map((item, i) => (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{item.type}</span>
                      <span style={{ color: T.faint, fontSize: 12 }}>· Day {item.day}</span>
                    </div>
                    <button onClick={() => generateMsg(i)} disabled={generating === i}
                      style={{ background: generating === i ? T.faint : T.accentBg, color: T.accent, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: generating === i ? "default" : "pointer", fontWeight: 700 }}>
                      {generating === i ? "Generating…" : "✦ Regenerate"}
                    </button>
                  </div>
                  <textarea rows={3} style={{ ...inp, resize: "vertical", fontSize: 13, lineHeight: 1.6 }}
                    placeholder={`Your ${item.type.toLowerCase()} message`}
                    value={item.msg} onChange={e => setSeq(s => s.map((x, j) => j === i ? { ...x, msg: e.target.value } : x))} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={() => onSave({ ...client, icp, sequence: seq })} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────
const ACTIVITY_ICONS = {
  client:   { icon: "👥", color: "#58a6ff" },
  campaign: { icon: "◎",  color: "#2dce98" },
  import:   { icon: "◉",  color: "#bc8cff" },
  pipeline: { icon: "◧",  color: "#d29922" },
  reply:    { icon: "◫",  color: "#2dce98" },
  meeting:  { icon: "📅", color: "#3fb950" },
  flow:     { icon: "⑃",  color: "#bc8cff" },
};

function ActivityFeed({ activity, setView }) {
  const DEMO_ACTIVITY = [
    { id: -1, type: "meeting",  message: "Meeting booked with Marcus Williams · Notion",    time: new Date(Date.now() - 1000*60*18).toISOString() },
    { id: -2, type: "reply",    message: "Reply sent to Sarah Chen",                        time: new Date(Date.now() - 1000*60*47).toISOString() },
    { id: -3, type: "pipeline", message: "Raj Mehta moved to engaged",                     time: new Date(Date.now() - 1000*60*60*2).toISOString() },
    { id: -4, type: "import",   message: "8 leads imported: VP Product — SaaS — US",       time: new Date(Date.now() - 1000*60*60*5).toISOString() },
    { id: -5, type: "campaign", message: "Campaign created: FinTech Decision Makers",       time: new Date(Date.now() - 1000*60*60*8).toISOString() },
  ];

  const entries = activity.length > 0 ? activity : DEMO_ACTIVITY;

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000)  return "just now";
    if (diff < 3600000) return Math.round(diff/60000) + "m ago";
    if (diff < 86400000) return Math.round(diff/3600000) + "h ago";
    return Math.round(diff/86400000) + "d ago";
  };

  const navMap = { meeting: "inbox", reply: "inbox", pipeline: "pipeline", import: "leads", campaign: "campaigns", client: "dashboard", flow: "campaigns" };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "0.875rem 1rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Recent activity</div>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
      {entries.slice(0, 8).map((e, i) => {
        const cfg = ACTIVITY_ICONS[e.type] || { icon: "·", color: T.muted };
        return (
          <div key={e.id} onClick={() => setView(navMap[e.type] || "dashboard")}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "0.75rem 1rem", borderBottom: i < entries.slice(0,8).length - 1 ? `1px solid ${T.faint}` : "none", cursor: "pointer" }}
            onMouseEnter={el => el.currentTarget.style.background = T.surface}
            onMouseLeave={el => el.currentTarget.style.background = "transparent"}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.color + "22", color: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{cfg.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.text, fontSize: 12, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.message}</div>
              <div style={{ color: T.faint, fontSize: 11, marginTop: 2 }}>{timeAgo(e.time)}</div>
            </div>
          </div>
        );
      })}
      {entries.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: T.muted, fontSize: 13 }}>No activity yet — actions will appear here</div>
      )}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ setView, clients, campaigns, onDeleteClient, onEditClient, activity }) {
  const [reportClient, setReportClient] = useState(null);
  const totMsg  = clients.reduce((s, c) => s + c.messages, 0);
  const totRep  = clients.reduce((s, c) => s + c.replies, 0);
  const totMeet = clients.reduce((s, c) => s + c.meetings, 0);

  return (
    <div>
      {reportClient && <ClientReport client={reportClient} campaigns={campaigns} onClose={() => setReportClient(null)} />}

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Agency Overview</h1>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>All clients · This month</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: "1.75rem" }}>
        {[
          { label: "Active Clients",  val: clients.filter(c => c.active).length, note: `${clients.length} total`, col: T.accent },
          { label: "Messages Sent",   val: totMsg.toLocaleString(), note: "+18% vs last month", col: T.blue },
          { label: "Reply Rate",      val: totMsg ? Math.round(totRep / totMsg * 100) + "%" : "—", note: "+2.1% vs last month", col: T.green },
          { label: "Meetings Booked", val: totMeet, note: "+33% vs last month", col: T.purple },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ color: T.text, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.val}</div>
            <div style={{ color: s.col, fontSize: 11, fontWeight: 600 }}>↑ {s.note}</div>
          </div>
        ))}
      </div>

      {/* Two column layout: left = main content, right = activity feed */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem", alignItems: "start" }}>
        <div>
          {/* Campaign health strip */}
          {campaigns.length > 0 && (
            <div style={{ marginBottom: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h2 style={{ color: T.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Campaign health</h2>
                <button onClick={() => setView("campaigns")} style={{ background: "transparent", color: T.muted, border: "none", cursor: "pointer", fontSize: 12 }}>View all →</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {campaigns.slice(0, 4).map(c => {
                  const score = calcHealth(c);
                  const grade = healthGrade(score);
                  const rr = c.sent ? Math.round(c.replies / c.sent * 100) : 0;
                  return (
                    <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                        <div style={{ color: T.muted, fontSize: 11 }}>{c.client}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ color: T.muted, fontSize: 11 }}>{rr}% reply rate · {c.meetings} meetings</span>
                      </div>
                      <div style={{ width: 80, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <div style={{ flex: 1, background: T.faint, borderRadius: 3, height: 4 }}>
                          <div style={{ background: grade.color, height: 4, borderRadius: 3, width: score + "%", transition: "width 0.4s" }} />
                        </div>
                        <span style={{ color: grade.color, fontSize: 11, fontWeight: 700, minWidth: 24 }}>{score}</span>
                      </div>
                      <Badge status={c.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clients grid */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 style={{ color: T.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Clients</h2>
            <button onClick={() => setView("campaigns")} style={{ background: "transparent", color: T.muted, border: "none", cursor: "pointer", fontSize: 12 }}>View all campaigns →</button>
          </div>

          {clients.length === 0 && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3rem", textAlign: "center", color: T.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>No clients yet</div>
              <div style={{ fontSize: 13 }}>Click "+ Add Client" in the sidebar to get started</div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {clients.map(c => (
              <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.875rem" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: c.color + "22", color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{c.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.text, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ color: T.muted, fontSize: 11 }}>{campaigns.filter(cp => cp.client === c.name).length} campaigns{c.icp?.title ? ` · ${c.icp.title}` : ""}</div>
                  </div>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.active ? T.green : T.yellow, flexShrink: 0 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: "0.75rem" }}>
                  {[["Sent", c.messages.toLocaleString()], ["Replies", c.replies], ["Meetings", c.meetings]].map(([k, v]) => (
                    <div key={k} style={{ background: T.surface, borderRadius: 7, padding: "7px 8px" }}>
                      <div style={{ color: T.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{k}</div>
                      <div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setReportClient(c)} style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <span>📊</span> Report
                  </button>
                  <button onClick={() => onEditClient && onEditClient(c)} style={{ flex: 1, background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 7, padding: "7px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    ✏ Edit ICP
                  </button>
                  <button onClick={() => { if (window.confirm(`Remove ${c.name}?`)) onDeleteClient(c.id); }} style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}33`, borderRadius: 7, padding: "7px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <ActivityFeed activity={activity || []} setView={setView} />
        </div>
      </div>
    </div>
  );
}

// ─── CAMPAIGN HEALTH ─────────────────────────────────────────────────────────
function calcHealth(c) {
  // Deterministic score based on campaign stats — no AI needed for the number
  const rr  = c.sent  ? c.replies  / c.sent  : 0;
  const mr  = c.replies ? c.meetings / c.replies : 0;
  const pct = c.leads  ? c.sent    / c.leads  : 0;

  let score = 50;
  // Reply rate (industry avg ~10%)
  if (rr >= 0.18) score += 25;
  else if (rr >= 0.12) score += 15;
  else if (rr >= 0.07) score += 5;
  else if (rr > 0)     score -= 10;
  // Meeting conversion
  if (mr >= 0.12) score += 15;
  else if (mr >= 0.07) score += 8;
  else if (mr > 0)     score += 3;
  // Sequence progress
  if (pct >= 0.8) score += 10;
  else if (pct >= 0.5) score += 5;
  else if (pct < 0.2 && c.sent > 0) score -= 5;
  // Paused penalty
  if (c.status === "paused") score -= 15;
  // No sends yet
  if (c.sent === 0) score = 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function healthGrade(score) {
  if (score >= 80) return { label: "Excellent", color: T.accent,  bg: T.accentBg };
  if (score >= 60) return { label: "Good",      color: T.green,   bg: T.green + "18" };
  if (score >= 40) return { label: "Fair",      color: T.yellow,  bg: T.yellow + "18" };
  return               { label: "Needs work",  color: T.red,     bg: T.red + "18" };
}

function healthIssues(c) {
  const issues = [];
  const rr  = c.sent    ? c.replies  / c.sent  : 0;
  const mr  = c.replies ? c.meetings / c.replies : 0;
  const pct = c.leads   ? c.sent     / c.leads  : 0;

  if (c.sent === 0)        issues.push({ type: "warn",  text: "No messages sent yet — assign a lead list to get started." });
  if (c.status === "paused") issues.push({ type: "warn",  text: "Campaign is paused — resume it to keep momentum." });
  if (rr < 0.07 && c.sent > 30)  issues.push({ type: "bad",   text: `Reply rate is ${Math.round(rr*100)}% — below the 8% minimum. Review your connection request message.` });
  if (rr >= 0.15)          issues.push({ type: "good",  text: `Strong ${Math.round(rr*100)}% reply rate — top 20% of campaigns. Consider scaling the lead list.` });
  if (mr < 0.05 && c.replies > 10) issues.push({ type: "warn",  text: "Low reply-to-meeting conversion. Your follow-up message may be too generic — try a more specific CTA." });
  if (pct < 0.3 && c.sent > 0) issues.push({ type: "warn",  text: `Only ${Math.round(pct*100)}% of leads have been contacted. Import more leads or check your daily limit in Settings.` });
  if (pct >= 0.9)          issues.push({ type: "warn",  text: "Lead list nearly exhausted — import new leads to keep the pipeline full." });
  if (c.meetings >= 5)     issues.push({ type: "good",  text: `${c.meetings} meetings booked — strong result. Share the client report to show progress.` });

  if (issues.length === 0) issues.push({ type: "good", text: "All metrics look healthy. Keep the campaign running." });
  return issues;
}

const ISSUE_STYLE = {
  good: { icon: "✓", color: T.accent },
  warn: { icon: "⚠", color: T.yellow },
  bad:  { icon: "✕", color: T.red },
};

function HealthPanel({ c, onClose }) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading]     = useState(false);
  const score   = calcHealth(c);
  const grade   = healthGrade(score);
  const issues  = healthIssues(c);
  const rr      = c.sent    ? Math.round(c.replies  / c.sent    * 100) : 0;
  const mr      = c.replies ? Math.round(c.meetings / c.replies * 100) : 0;
  const pct     = c.leads   ? Math.round(c.sent     / c.leads   * 100) : 0;

  const getDiagnosis = async () => {
    setLoading(true);
    const prompt = `You are an outreach campaign analyst. Write a short, plain-English performance diagnosis (3–4 sentences) for this campaign. Be specific. Identify the #1 thing to fix or double down on. No bullet points, no fluff.

Campaign: ${c.name}
Client: ${c.client}
Status: ${c.status}
Leads: ${c.leads} total, ${c.sent} sent (${pct}% progress)
Reply rate: ${rr}% (industry avg: 10–12%)
Reply-to-meeting: ${mr}%
Meetings booked: ${c.meetings}
Health score: ${score}/100

Write only the diagnosis text, nothing else.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setDiagnosis(data.content?.find(b => b.type === "text")?.text || "");
    } catch { setDiagnosis("Unable to generate diagnosis — check your connection."); }
    setLoading(false);
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "1.25rem 1.125rem" }}>

      {/* Score + grade */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: "1.125rem" }}>
        {/* Circular score */}
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke={T.faint} strokeWidth="6" />
            <circle cx="36" cy="36" r="30" fill="none" stroke={grade.color} strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 30 * score / 100} ${2 * Math.PI * 30 * (1 - score / 100)}`}
              strokeLinecap="round" strokeDashoffset={2 * Math.PI * 30 * 0.25}
              style={{ transition: "stroke-dasharray 0.6s" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: grade.color, fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{score}</div>
            <div style={{ color: T.muted, fontSize: 9, fontWeight: 600 }}>/100</div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ background: grade.bg, color: grade.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5 }}>{grade.label}</span>
            <span style={{ color: T.muted, fontSize: 12 }}>Campaign health score</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[
              ["Reply rate", rr + "%",  rr >= 12 ? T.accent : rr >= 7 ? T.yellow : T.red],
              ["Reply→Mtg",  mr + "%",  mr >= 8  ? T.accent : mr >= 4  ? T.yellow : T.muted],
              ["Progress",   pct + "%", pct >= 50 ? T.accent : T.muted],
            ].map(([l, v, col]) => (
              <div key={l} style={{ background: T.card, borderRadius: 7, padding: "7px 10px", border: `1px solid ${T.border}` }}>
                <div style={{ color: col, fontSize: 15, fontWeight: 800 }}>{v}</div>
                <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues list */}
      <div style={{ marginBottom: "1rem" }}>
        {issues.map((issue, i) => {
          const s = ISSUE_STYLE[issue.type];
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ color: s.color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
              <span style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>{issue.text}</span>
            </div>
          );
        })}
      </div>

      {/* AI diagnosis */}
      {!diagnosis && !loading && (
        <button onClick={getDiagnosis} style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, marginBottom: "1rem" }}>
          ✦ Get AI diagnosis
        </button>
      )}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 12, marginBottom: "1rem" }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Analysing campaign…
        </div>
      )}
      {diagnosis && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "0.875rem 1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ color: T.accent, fontSize: 13 }}>✦</span>
            <span style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>AI Diagnosis</span>
          </div>
          <div style={{ color: T.text, fontSize: 13, lineHeight: 1.7 }}>{diagnosis}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12 }}>Close</button>
      </div>
    </div>
  );
}

function HealthBadge({ score, small = false }) {
  const grade = healthGrade(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: small ? 24 : 32, height: small ? 24 : 32, borderRadius: "50%", background: grade.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: grade.color, fontSize: small ? 9 : 11, fontWeight: 900 }}>{score}</span>
      </div>
      {!small && <span style={{ color: grade.color, fontSize: 11, fontWeight: 700 }}>{grade.label}</span>}
    </div>
  );
}

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────
function Campaigns({ onNew, onTemplates, onEditFlow, campaigns, clients, onDeleteCampaign, onToggleCampaign, onToggleReviewMode }) {
  const [expanded, setExpanded]   = useState(null);
  const [healthOpen, setHealthOpen] = useState(null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Campaigns</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onTemplates} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13 }}>Browse templates</button>
          <button onClick={onNew} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ New Campaign</button>
        </div>
      </div>

      {campaigns.length === 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3rem", textAlign: "center", color: T.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
          <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>No campaigns yet</div>
          <div style={{ fontSize: 13 }}>Click "+ New Campaign" to create your first one</div>
        </div>
      )}

      {campaigns.map(c => {
        const score = calcHealth(c);
        const grade = healthGrade(score);
        return (
          <div key={c.id} style={{ marginBottom: 8 }}>
            <div
              onClick={() => { setExpanded(expanded === c.id ? null : c.id); setHealthOpen(null); }}
              style={{ background: T.card, border: `1px solid ${expanded === c.id ? T.accent : T.border}`, borderRadius: expanded === c.id ? "10px 10px 0 0" : 10, padding: "1rem 1.125rem", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "border-color 0.15s" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{c.name}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>{c.client} · {c.channel}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>{c.sent} / {c.leads} sent</div>
                <div style={{ color: T.muted, fontSize: 12 }}>{c.replies} replies · {c.meetings} meetings</div>
              </div>
              {/* Health badge */}
              <HealthBadge score={score} small />
              <Badge status={c.status} />
              <span style={{ color: T.muted, fontSize: 12 }}>{expanded === c.id ? "▲" : "▼"}</span>
            </div>

            {expanded === c.id && healthOpen !== c.id && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "1rem 1.125rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: "1rem" }}>
                  {[
                    { label: "Leads",      val: c.leads, col: T.blue },
                    { label: "Sent",       val: c.sent,  col: T.text },
                    { label: "Reply Rate", val: c.sent ? Math.round(c.replies / c.sent * 100) + "%" : "—", col: T.accent },
                    { label: "Meetings",   val: c.meetings, col: T.purple },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center", background: T.card, borderRadius: 8, padding: "10px 8px", border: `1px solid ${T.border}` }}>
                      <div style={{ color: s.col, fontSize: 20, fontWeight: 800 }}>{s.val}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={e => { e.stopPropagation(); setHealthOpen(c.id); }} style={{ flex: 1, background: grade.bg, color: grade.color, border: `1px solid ${grade.color}44`, borderRadius: 7, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    ◎ Health: {score}/100 · {grade.label}
                  </button>
                  <button
                    onClick={() => onToggleReviewMode && onToggleReviewMode(c.id)}
                    style={{ flex: 1, background: c.reviewMode ? T.yellow + "22" : "transparent", color: c.reviewMode ? T.yellow : T.muted, border: `1px solid ${c.reviewMode ? T.yellow + "66" : T.border}`, borderRadius: 7, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: c.reviewMode ? 700 : 400 }}>
                    {c.reviewMode ? "🔍 Review mode on" : "🔍 Review mode"}
                  </button>
                  <button onClick={() => onToggleCampaign(c.id)} style={{ flex: 1, background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 7, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{c.status === "active" ? "⏸ Pause" : "▶ Resume"}</button>
                  <button onClick={() => onEditFlow(c)} style={{ flex: 1, background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 7, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏ Sequence</button>
                  <button style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px", cursor: "pointer", fontSize: 13 }}>↓ Export</button>
                  <button onClick={() => { if (window.confirm(`Delete "${c.name}"?`)) { onDeleteCampaign(c.id); setExpanded(null); }}} style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}33`, borderRadius: 7, padding: "8px 10px", cursor: "pointer", fontSize: 13 }}>✕</button>
                </div>
              </div>
            )}

            {expanded === c.id && healthOpen === c.id && (
              <HealthPanel c={c} onClose={() => setHealthOpen(null)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── LEADS ───────────────────────────────────────────────────────────────────
// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
const SCRAPED_PREVIEW = [
  { id: 101, name: "Raj Mehta", title: "VP of Product", company: "Intercom", size: "501–1000", location: "San Francisco, CA", selected: true },
  { id: 102, name: "Lena Fischer", title: "Head of Product", company: "Personio", size: "1001–5000", location: "Munich, Germany", selected: true },
  { id: 103, name: "Carlos Rivera", title: "Chief Product Officer", company: "Deel", size: "1001–5000", location: "New York, NY", selected: true },
  { id: 104, name: "Amy Thornton", title: "VP Product Management", company: "Pendo", size: "201–500", location: "Raleigh, NC", selected: true },
  { id: 105, name: "Kenji Watanabe", title: "Senior PM", company: "Mercari", size: "1001–5000", location: "Tokyo, Japan", selected: false },
  { id: 106, name: "Simone Dubois", title: "Director of Product", company: "Contentsquare", size: "501–1000", location: "Paris, France", selected: true },
  { id: 107, name: "Ben Howarth", title: "Product Lead", company: "Monzo", size: "501–1000", location: "London, UK", selected: true },
  { id: 108, name: "Fatima Al-Rashid", title: "CPO", company: "Careem", size: "1001–5000", location: "Dubai, UAE", selected: true },
];

function ImportModal({ onClose, onImport }) {
  const [tab, setTab] = useState("linkedin");
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState("input"); // input | scraping | preview | done
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState(SCRAPED_PREVIEW);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [listName, setListName] = useState("");

  const isValidUrl = url.includes("linkedin.com") || url.includes("sales-navigator");

  const startScrape = () => {
    if (!isValidUrl) return;
    setStage("scraping");
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 6;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => setStage("preview"), 400); }
      setProgress(Math.min(Math.round(p), 100));
    }, 220);
  };

  const toggleRow = (id) => setRows(r => r.map(x => x.id === id ? { ...x, selected: !x.selected } : x));
  const toggleAll = () => { const allOn = rows.every(r => r.selected); setRows(r => r.map(x => ({ ...x, selected: !allOn }))); };
  const selectedCount = rows.filter(r => r.selected).length;

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const th = { color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "9px 12px", textAlign: "left", borderBottom: `1px solid ${T.border}` };
  const td = { color: T.text, fontSize: 12, padding: "10px 12px", borderBottom: `1px solid ${T.faint}` };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: stage === "preview" ? 680 : 520, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>Add leads to list</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        {/* Tabs */}
        {stage === "input" && (
          <div style={{ display: "flex", gap: 0, padding: "0.875rem 1.5rem 0", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            {[["linkedin", "LinkedIn Search URL"], ["csv", "CSV Upload"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: "transparent", border: "none", borderBottom: `2px solid ${tab === id ? T.accent : "transparent"}`, color: tab === id ? T.accent : T.muted, padding: "0 0 0.75rem", marginRight: "1.5rem", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, transition: "all 0.15s" }}>{label}</button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>

          {/* ── LinkedIn URL input ── */}
          {tab === "linkedin" && stage === "input" && (
            <div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.25rem", lineHeight: 1.6 }}>
                Paste any LinkedIn search URL — standard search or Sales Navigator. We'll scrape the results and show you a preview before anything is imported.
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>LinkedIn Search URL</div>
                <input style={{ ...inp, borderColor: url && !isValidUrl ? T.red : T.border }} placeholder="https://www.linkedin.com/search/results/people/..." value={url} onChange={e => setUrl(e.target.value)} />
                {url && !isValidUrl && <div style={{ color: T.red, fontSize: 11, marginTop: 4 }}>Paste a valid LinkedIn or Sales Navigator search URL</div>}
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>List Name</div>
                <input style={inp} placeholder="e.g. VP Product — SaaS — US" value={listName} onChange={e => setListName(e.target.value)} />
              </div>

              {/* Tips */}
              <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "1rem" }}>
                <div style={{ color: T.accent, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Tips for better results</div>
                {[
                  "Use LinkedIn filters before copying the URL — title, industry, company size",
                  "Sales Navigator URLs give richer data (title, company size, location)",
                  "Keep searches under 500 results for fastest import",
                ].map(t => (
                  <div key={t} style={{ color: T.muted, fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                    <span style={{ color: T.accent, flexShrink: 0 }}>→</span>{t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Scraping progress ── */}
          {stage === "scraping" && (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: 40, marginBottom: "1rem" }}>🔍</div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Scraping LinkedIn…</div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.5rem" }}>Reading search results and enriching profiles</div>
              <div style={{ background: T.faint, borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ background: T.accent, height: "100%", width: `${progress}%`, transition: "width 0.2s", borderRadius: 4 }} />
              </div>
              <div style={{ color: T.accent, fontSize: 13, fontWeight: 700 }}>{progress}%</div>
              <div style={{ color: T.muted, fontSize: 12, marginTop: "1rem" }}>
                {progress < 30 ? "Fetching search results…" : progress < 60 ? "Enriching profile data…" : progress < 90 ? "Deduplicating against existing leads…" : "Finalising…"}
              </div>
            </div>
          )}

          {/* ── Preview table ── */}
          {stage === "preview" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Preview — {rows.length} leads found</div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{selectedCount} selected · deselect any you want to skip</div>
                </div>
                <button onClick={toggleAll} style={{ background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>
                  {rows.every(r => r.selected) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 32 }}></th>
                      <th style={th}>Name</th>
                      <th style={th}>Title</th>
                      <th style={th}>Company</th>
                      <th style={th}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} onClick={() => toggleRow(row.id)} style={{ cursor: "pointer", background: row.selected ? T.accentDim : "transparent", opacity: row.selected ? 1 : 0.4 }}>
                        <td style={{ ...td, textAlign: "center" }}>
                          <div style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${row.selected ? T.accent : T.border}`, background: row.selected ? T.accent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            {row.selected && <span style={{ color: "#0d1117", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                          </div>
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>{row.name}</td>
                        <td style={{ ...td, color: T.muted }}>{row.title}</td>
                        <td style={td}>{row.company}</td>
                        <td style={{ ...td, color: T.muted, fontSize: 11 }}>{row.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CSV tab ── */}
          {tab === "csv" && stage === "input" && (
            <div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.25rem", lineHeight: 1.6 }}>
                Upload a CSV exported from LinkedIn, Sales Navigator, Apollo, or any spreadsheet. We'll map the columns automatically.
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                onDragLeave={() => setCsvDragging(false)}
                onDrop={e => { e.preventDefault(); setCsvDragging(false); setCsvFile(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${csvDragging ? T.accent : T.border}`, borderRadius: 12, padding: "2.5rem", textAlign: "center", background: csvDragging ? T.accentDim : T.card, transition: "all 0.15s", marginBottom: "1.25rem", cursor: "pointer" }}>
                {csvFile ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>{csvFile.name}</div>
                    <div style={{ color: T.muted, fontSize: 12 }}>Ready to import · <span style={{ color: T.accent, cursor: "pointer" }} onClick={() => setCsvFile(null)}>Remove</span></div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>☁</div>
                    <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>Drop your CSV here</div>
                    <div style={{ color: T.muted, fontSize: 12 }}>or <span style={{ color: T.accent }}>browse files</span></div>
                  </>
                )}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>List Name</div>
                <input style={inp} placeholder="e.g. Apollo Export — May 2026" value={listName} onChange={e => setListName(e.target.value)} />
              </div>
              <div style={{ color: T.muted, fontSize: 12 }}>Expected columns: <span style={{ color: T.text }}>First Name, Last Name, Title, Company, LinkedIn URL</span> (others ignored)</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          {stage === "preview"
            ? <div style={{ color: T.muted, fontSize: 12 }}>{selectedCount} leads will be added to <span style={{ color: T.text }}>"{listName || "New List"}"</span></div>
            : <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            {stage === "input" && tab === "linkedin" && (
              <button onClick={startScrape} disabled={!isValidUrl} style={{ background: isValidUrl ? T.accent : T.faint, color: isValidUrl ? "#0d1117" : T.muted, border: "none", borderRadius: 7, padding: "8px 18px", cursor: isValidUrl ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>Scrape & Preview →</button>
            )}
            {stage === "input" && tab === "csv" && (
              <button onClick={() => csvFile && setStage("preview")} disabled={!csvFile} style={{ background: csvFile ? T.accent : T.faint, color: csvFile ? "#0d1117" : T.muted, border: "none", borderRadius: 7, padding: "8px 18px", cursor: csvFile ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>Preview Import →</button>
            )}
            {stage === "preview" && (
              <button onClick={() => {
                const selectedRows = rows.filter(r => r.selected);
                const newLeads = selectedRows.map((r, i) => ({
                  id: Date.now() + i,
                  name: r.name, title: r.title, company: r.company,
                  initials: r.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(),
                  color: ["#58a6ff","#2dce98","#bc8cff","#d29922","#f85149"][i % 5],
                  clientColor: "#2dce98",
                  campaign: listName || "New List",
                  client: "", pipelineStage: "prospecting",
                  days: 0, status: "pending", unread: false,
                  last: "Just now", messages: [],
                }));
                onImport(newLeads, listName || "New List"); onClose();
              }} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Import {selectedCount} leads →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BOOKMARKLET SETUP ───────────────────────────────────────────────────────
const BOOKMARKLET_CODE = `javascript:(function(){var u=encodeURIComponent(window.location.href);var d=window.location.hostname;if(!d.includes('linkedin.com')){alert('Please run this from a LinkedIn search page.');return;}window.open('https://app.reachflow.io/import?url='+u,'_blank');})();`;

function BookmarkletSetup({ onDismiss }) {
  const [step, setStep] = useState(0); // 0=intro, 1=drag, 2=done
  const [dragged, setDragged] = useState(false);

  return (
    <div style={{ background: T.surface, border: `1.5px solid ${T.accent}44`, borderRadius: 14, padding: "1.5rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔖</div>
          <div>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>Set up one-click LinkedIn import</div>
            <div style={{ color: T.muted, fontSize: 12 }}>Import leads directly from LinkedIn — no copy/paste needed</div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>×</button>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
        {["Open LinkedIn", "Drag to toolbar", "Import leads"].map((label, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ height: 2, borderRadius: 2, background: i <= step ? T.accent : T.faint, marginBottom: 4 }} />
            <div style={{ color: i <= step ? T.accent : T.muted, fontSize: 10, fontWeight: i === step ? 700 : 400 }}>{label}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.7, marginBottom: "1.25rem" }}>
            Instead of copying and pasting search URLs, you can add a button to your browser toolbar. When you're on a LinkedIn search page, one click sends those leads straight into ReachFlow.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
            {[
              { icon: "🔍", label: "Search on LinkedIn", desc: "Filter by title, industry, location — exactly as you do today" },
              { icon: "🖱", label: "Click the button", desc: "Hit the ReachFlow button in your browser toolbar" },
              { icon: "✓", label: "Leads appear here", desc: "Preview and import — no spreadsheet, no copy/paste" },
            ].map(s => (
              <div key={s.label} style={{ background: T.card, borderRadius: 10, padding: "1rem", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep(1)} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Set it up — takes 10 seconds →</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.7, marginBottom: "1.25rem" }}>
            Drag the button below up to your browser's bookmarks toolbar. If you don't see the toolbar, press <kbd style={{ background: T.faint, color: T.text, padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>Ctrl+Shift+B</kbd> (Windows) or <kbd style={{ background: T.faint, color: T.text, padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>⌘+Shift+B</kbd> (Mac) to show it.
          </div>

          {/* Visual browser mockup */}
          <div style={{ background: "#1a1a2e", borderRadius: 10, overflow: "hidden", marginBottom: "1.25rem", border: `1px solid ${T.border}` }}>
            {/* Browser chrome */}
            <div style={{ background: "#0d0d1a", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#ff5f57", "#ffbd2e", "#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ flex: 1, background: "#1e1e3a", borderRadius: 5, padding: "4px 10px", color: "#666", fontSize: 11 }}>linkedin.com/search/results/people/?keywords=VP+Sales...</div>
            </div>
            {/* Bookmarks bar */}
            <div style={{ background: "#141428", padding: "5px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#555", fontSize: 11 }}>Bookmarks:</span>
              <span style={{ color: "#555", fontSize: 11 }}>Gmail</span>
              <span style={{ color: "#555", fontSize: 11 }}>Notion</span>
              <span style={{ color: "#555", fontSize: 11 }}>GitHub</span>
              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={() => { setDragged(true); setTimeout(() => setStep(2), 600); }}
                style={{ background: dragged ? T.accentBg : "rgba(45,206,152,0.06)", border: `1.5px dashed ${T.accent}`, borderRadius: 5, padding: "3px 10px", fontSize: 11, color: T.accent, fontWeight: 600, minWidth: 120, textAlign: "center", transition: "all 0.2s" }}>
                {dragged ? "✓ Added!" : "← drop here"}
              </div>
            </div>
            {/* Page content hint */}
            <div style={{ padding: "1rem", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0077b5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 13, flexShrink: 0 }}>in</div>
              <div>
                <div style={{ color: "#888", fontSize: 11 }}>LinkedIn · Search results · 247 people</div>
                <div style={{ color: "#555", fontSize: 10, marginTop: 2 }}>VP Sales · Software · United States</div>
              </div>
            </div>
          </div>

          {/* The actual draggable bookmarklet */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Drag this button to your bookmarks toolbar</div>
              <div style={{ color: T.muted, fontSize: 12 }}>Then visit any LinkedIn search and click it</div>
            </div>
            <a
              href={BOOKMARKLET_CODE}
              draggable
              onDragStart={e => e.dataTransfer.setData("text/plain", BOOKMARKLET_CODE)}
              onClick={e => e.preventDefault()}
              style={{ background: T.accent, color: "#0d1117", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", cursor: "grab", display: "flex", alignItems: "center", gap: 6, userSelect: "none", flexShrink: 0 }}>
              <span>🔖</span> Import to ReachFlow
            </a>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>I've added it ✓</button>
            <button onClick={() => setStep(0)} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12 }}>← Back</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ fontSize: 36 }}>🎉</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>You're set up!</div>
            <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.7, marginBottom: "1rem" }}>
              Next time you're on a LinkedIn search page, click the <strong style={{ color: T.accent }}>Import to ReachFlow</strong> button in your toolbar. The leads will appear here instantly — no copying, no spreadsheets.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ background: T.accentBg, border: `1px solid ${T.accent}44`, borderRadius: 7, padding: "5px 12px", color: T.accent, fontSize: 12, fontWeight: 600 }}>✓ Bookmarklet active</div>
              <button onClick={onDismiss} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEADS VIEW ───────────────────────────────────────────────────────────────
function Leads({ leads, setLeads, logActivity }) {
  const [filter, setFilter]         = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast]           = useState(null);
  const [showBookmarklet, setShowBookmarklet] = useLocalStorage("rf_show_bookmarklet", true);
  const [selected, setSelected]     = useState(new Set());

  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);

  const handleImport = (newLeads, name) => {
    setLeads(existing => {
      const existingIds = new Set(existing.map(l => l.id));
      const fresh = newLeads.filter(l => !existingIds.has(l.id));
      return [...existing, ...fresh];
    });
    if (logActivity) logActivity("import", `${newLeads.length} leads imported: ${name}`, { count: newLeads.length, listName: name });
    setToast(`✓ ${newLeads.length} leads imported into "${name}"`);
    setTimeout(() => setToast(null), 3500);
  };

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll    = () => setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)));
  const clearSel     = () => setSelected(new Set());

  const bulkDelete   = () => { if (window.confirm(`Delete ${selected.size} lead${selected.size > 1 ? "s" : ""}?`)) { setLeads(ls => ls.filter(l => !selected.has(l.id))); clearSel(); } };
  const bulkStatus   = (status) => { setLeads(ls => ls.map(l => selected.has(l.id) ? { ...l, status } : l)); clearSel(); };
  const bulkExport   = () => {
    const rows = [["Name","Title","Company","Campaign","Status"]];
    leads.filter(l => selected.has(l.id)).forEach(l => rows.push([l.name, l.title, l.company, l.campaign, l.status]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url); clearSel();
  };

  const th = { color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  const td = { color: T.text, fontSize: 13, padding: "11px 14px", borderBottom: `1px solid ${T.faint}` };
  const cbStyle = { width: 15, height: 15, cursor: "pointer", accentColor: T.accent };

  return (
    <div>
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}

      {toast && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: T.card, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "12px 18px", color: T.accent, fontSize: 13, fontWeight: 600, zIndex: 200, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Lead Lists</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{leads.length} leads across all campaigns</p>
        </div>
        <button onClick={() => setShowImport(true)} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Add Leads</button>
      </div>

      {showBookmarklet && <BookmarkletSetup onDismiss={() => setShowBookmarklet(false)} />}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: T.accent, fontSize: 13, fontWeight: 700 }}>{selected.size} selected</span>
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            <button onClick={bulkDelete} style={{ background: T.red + "22", color: T.red, border: `1px solid ${T.red}44`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✕ Delete</button>
            {["pending","connected","replied","meeting"].map(s => (
              <button key={s} onClick={() => bulkStatus(s)} style={{ background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>
                → {STATUS_LABEL[s]}
              </button>
            ))}
            <button onClick={bulkExport} style={{ background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>↓ Export</button>
          </div>
          <button onClick={clearSel} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: "1.125rem", flexWrap: "wrap" }}>
        {["all", "pending", "connected", "replied", "meeting"].map(f => {
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{ background: active ? T.accentBg : "transparent", color: active ? T.accent : T.muted, border: `1px solid ${active ? T.accent : T.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400 }}>
              {f === "all" ? "All" : STATUS_LABEL[f]}
            </button>
          );
        })}
        {!showBookmarklet && (
          <button onClick={() => setShowBookmarklet(true)} style={{ marginLeft: "auto", background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11 }}>🔖 Set up quick import</button>
        )}
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 40, paddingRight: 0 }}>
                <input type="checkbox" style={cbStyle} checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
              </th>
              <th style={th}>Name</th>
              <th style={th}>Title</th>
              <th style={th}>Company</th>
              <th style={th}>Campaign</th>
              <th style={th}>Status</th>
              <th style={th}>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id} style={{ cursor: "pointer", background: selected.has(lead.id) ? T.accentDim : "transparent" }}>
                <td style={{ ...td, paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" style={cbStyle} checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{lead.name}</td>
                <td style={{ ...td, color: T.muted }}>{lead.title}</td>
                <td style={td}>{lead.company}</td>
                <td style={{ ...td, color: T.muted, fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.campaign}</td>
                <td style={td}><Badge status={lead.status} /></td>
                <td style={{ ...td, color: T.muted, fontSize: 12 }}>{lead.last}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: T.muted, padding: "2rem" }}>No leads match this filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
function Analytics() {
  const [clientId, setClientId] = useState("all");
  const ttStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "6px 10px" };
  const tickStyle = { fill: T.muted, fontSize: 11 };
  const sel = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "7px 10px", fontSize: 13, outline: "none", fontFamily: "inherit", cursor: "pointer" };

  const client = clientId === "all" ? null : CLIENTS.find(c => c.id === Number(clientId));
  const sent    = client ? client.messages : CLIENTS.reduce((s, c) => s + c.messages, 0);
  const replies = client ? client.replies  : CLIENTS.reduce((s, c) => s + c.replies, 0);
  const meetings= client ? client.meetings : CLIENTS.reduce((s, c) => s + c.meetings, 0);
  const rr = Math.round(replies / sent * 100);

  const scaledAnalytics = ANALYTICS.map(d => client
    ? { ...d, sent: Math.round(d.sent * client.messages / 600), replies: Math.round(d.replies * client.replies / 93), meetings: Math.round(d.meetings * client.meetings / 13) }
    : d);
  const perClient = CLIENTS.map(c => ({ name: c.initials, sent: c.messages, replies: c.replies, meetings: c.meetings }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Analytics</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>This week · {client ? client.name : "All clients"}</p>
        </div>
        <select style={sel} value={clientId} onChange={e => setClientId(e.target.value)}>
          <option value="all">All clients</option>
          {CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.5rem" }}>
        {[
          { label: "Messages Sent", val: sent.toLocaleString(), note: "this week", col: T.blue },
          { label: "Reply Rate",    val: rr + "%",              note: "+1.4% vs last week", col: T.accent },
          { label: "Meetings",      val: meetings,              note: "this week", col: T.purple },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{s.label}</div>
            <div style={{ color: T.text, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.val}</div>
            <div style={{ color: s.col, fontSize: 11, fontWeight: 600 }}>↑ {s.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: "1rem" }}>Daily Messages Sent</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={scaledAnalytics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.faint} vertical={false} />
              <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ttStyle} cursor={{ fill: T.accentDim }} />
              <Bar dataKey="sent" fill={T.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: "1rem" }}>Replies & Meetings</div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={scaledAnalytics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.faint} vertical={false} />
              <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Line type="monotone" dataKey="replies"  stroke={T.blue}   strokeWidth={2} dot={false} name="Replies" />
              <Line type="monotone" dataKey="meetings" stroke={T.purple} strokeWidth={2} dot={false} name="Meetings" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {clientId === "all" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: "1rem" }}>Performance by Client</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perClient} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.faint} vertical={false} />
              <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="sent"     fill={T.blue}   radius={[3,3,0,0]} name="Sent" />
              <Bar dataKey="replies"  fill={T.accent} radius={[3,3,0,0]} name="Replies" />
              <Bar dataKey="meetings" fill={T.purple} radius={[3,3,0,0]} name="Meetings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {client && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem" }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: "1rem" }}>{client.name} — Campaign breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CAMPAIGNS.filter(c => c.client === client.name).map(c => {
              const rr = Math.round(c.replies / c.sent * 100);
              return (
                <div key={c.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "0.875rem 1rem", display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: T.muted, fontSize: 11 }}>{c.channel}</div>
                  </div>
                  {[["Sent", c.sent, T.text], ["Replies", c.replies, T.blue], ["Reply rate", rr + "%", rr > 12 ? T.accent : T.muted], ["Meetings", c.meetings, T.purple]].map(([l, v, col]) => (
                    <div key={l} style={{ textAlign: "center", minWidth: 54 }}>
                      <div style={{ color: col, fontSize: 15, fontWeight: 800 }}>{v}</div>
                      <div style={{ color: T.muted, fontSize: 10 }}>{l}</div>
                    </div>
                  ))}
                  <Badge status={c.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* ── Send timing insights ── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem", marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>Send timing performance</div>
          <span style={{ background: T.accentBg, color: T.accent, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>Smart timing active</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: "1.25rem" }}>
          {[
            { day: "Mon", rr: 11, best: false }, { day: "Tue", rr: 16, best: true  },
            { day: "Wed", rr: 14, best: false }, { day: "Thu", rr: 15, best: true  },
            { day: "Fri", rr: 8,  best: false }, { day: "Sat", rr: 4,  best: false },
            { day: "Sun", rr: 3,  best: false },
          ].map(d => (
            <div key={d.day} style={{ textAlign: "center" }}>
              <div style={{ background: d.best ? T.accentBg : T.surface, border: `1px solid ${d.best ? T.accent : T.border}`, borderRadius: 8, padding: "8px 4px", marginBottom: 4 }}>
                <div style={{ color: d.best ? T.accent : T.text, fontSize: 14, fontWeight: 800 }}>{d.rr}%</div>
                <div style={{ color: T.muted, fontSize: 9 }}>reply</div>
              </div>
              <div style={{ color: d.best ? T.accent : T.muted, fontSize: 10, fontWeight: d.best ? 700 : 400 }}>{d.day}</div>
              {d.best && <div style={{ fontSize: 8, color: T.accent, fontWeight: 700 }}>★ BEST</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[
            { slot: "6–9am",  rr: 12, icon: "🌅" }, { slot: "9–12pm", rr: 17, icon: "☀️", best: true },
            { slot: "12–3pm", rr: 13, icon: "🌤"  }, { slot: "3–6pm",  rr: 9,  icon: "🌆" },
          ].map(s => (
            <div key={s.slot} style={{ background: s.best ? T.accentBg : T.surface, border: `1px solid ${s.best ? T.accent : T.border}`, borderRadius: 9, padding: "0.75rem", textAlign: "center" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ color: s.best ? T.accent : T.text, fontSize: 14, fontWeight: 800 }}>{s.rr}%</div>
              <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>{s.slot}</div>
              {s.best && <div style={{ color: T.accent, fontSize: 10, fontWeight: 700 }}>Best window</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: "1rem", background: T.surface, borderRadius: 8, padding: "0.75rem 1rem", color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
          <span style={{ color: T.accent, fontWeight: 700 }}>Recommendation:</span> Your best reply rates come on <strong style={{ color: T.text }}>Tuesday and Thursday, 9am–12pm</strong> in the prospect's local timezone. ReachFlow is currently scheduling all outreach within this window. <span style={{ color: T.accent, cursor: "pointer" }}>Adjust in Settings →</span>
        </div>
      </div>
    </div>
  );
}
const OPT_OUT_PATTERNS = [
  /\bremove\s+me\b/i, /\bunsubscribe\b/i, /\bstop\s+(emailing|contacting|messaging|reaching out)\b/i,
  /\bdo\s+not\s+(contact|email|message)\b/i, /\bdon'?t\s+(contact|email|message|reach out)\b/i,
  /\bnot\s+interested\b/i, /\bplease\s+(remove|unsubscribe|stop)\b/i,
  /\btake\s+me\s+off\b/i, /\bopt\s*-?\s*out\b/i, /\bno\s+thanks?,?\s*(not\s+for\s+me)?\b/i,
  /\bleave\s+me\s+alone\b/i, /\bstop\s+sending\b/i,
];

function isOptOut(text) {
  return OPT_OUT_PATTERNS.some(p => p.test(text));
}

// Shared suppression state — accessed by both Inbox and SuppressionList
let _suppressedEmails = {};
let _suppressListeners = [];
function getSuppressions() { return _suppressedEmails; }
function addSuppression(entry) {
  _suppressedEmails = { ..._suppressedEmails, [entry.email]: entry };
  _suppressListeners.forEach(fn => fn(_suppressedEmails));
}
function useSuppression() {
  const [suppressions, setSuppressions] = useState(_suppressedEmails);
  useEffect(() => {
    const listener = s => setSuppressions({ ...s });
    _suppressListeners.push(listener);
    return () => { _suppressListeners = _suppressListeners.filter(l => l !== listener); };
  }, []);
  return [suppressions, addSuppression];
}

// Seeded demo suppressions
const DEMO_SUPPRESSIONS = {
  "kenji.watanabe@mercari.com": { name: "Kenji Watanabe", email: "kenji.watanabe@mercari.com", company: "Mercari", campaign: "FinTech Founders", client: "Meridian Growth", date: "2026-05-14T09:23:00Z", method: "Auto-detected", reason: "Please stop messaging me, I'm not interested." },
  "ben.howarth@monzo.com":      { name: "Ben Howarth",    email: "ben.howarth@monzo.com",    company: "Monzo",   campaign: "DevOps Engineers", client: "Blue River Labs", date: "2026-05-10T14:07:00Z", method: "Auto-detected", reason: "Not interested, please remove me from your list." },
};
Object.values(DEMO_SUPPRESSIONS).forEach(addSuppression);

function SuppressionList() {
  const [suppressions, ] = useSuppression();
  const [search, setSearch] = useState("");
  const [toast, setToast]   = useState(null);

  const entries = Object.values(suppressions).filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.company?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  const removeEntry = (email) => {
    _suppressedEmails = Object.fromEntries(Object.entries(_suppressedEmails).filter(([k]) => k !== email));
    _suppressListeners.forEach(fn => fn(_suppressedEmails));
    setToast("Contact removed from suppression list");
    setTimeout(() => setToast(null), 2500);
  };

  const exportCSV = () => {
    const rows = [["Name","Email","Company","Campaign","Client","Date","Method","Reason"]];
    entries.forEach(e => rows.push([e.name, e.email, e.company, e.campaign, e.client, new Date(e.date).toLocaleDateString(), e.method, e.reason]));
    const csv = rows.map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "suppressions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const th = { color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  const td = { color: T.text, fontSize: 13, padding: "11px 14px", borderBottom: `1px solid ${T.faint}`, verticalAlign: "top" };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: T.card, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "12px 18px", color: T.accent, fontSize: 13, fontWeight: 600, zIndex: 200 }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Suppression List</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{entries.length} contact{entries.length !== 1 ? "s" : ""} opted out · Never contacted again</p>
        </div>
        <button onClick={exportCSV} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontSize: 13 }}>↓ Export CSV</button>
      </div>

      {/* Compliance notice */}
      <div style={{ background: "rgba(88,166,255,0.08)", border: `1px solid ${T.blue}44`, borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1.25rem", display: "flex", gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🛡</span>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.65 }}>
          <strong style={{ color: T.blue }}>GDPR & CAN-SPAM compliance.</strong> Contacts on this list are permanently suppressed from all outreach. Opt-outs are detected automatically from replies and logged with a timestamp for audit purposes. Do not manually remove contacts unless you have a documented legitimate reason.
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or company…"
          style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: 320 }}
        />
      </div>

      {entries.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3rem", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>No suppressions</div>
          <div style={{ color: T.muted, fontSize: 13 }}>Opt-outs will appear here automatically when detected from replies</div>
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Contact</th>
                <th style={th}>Campaign</th>
                <th style={th}>Opted-out reply</th>
                <th style={th}>Date</th>
                <th style={th}>Method</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.email}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{e.name}</div>
                    <div style={{ color: T.muted, fontSize: 12 }}>{e.company}</div>
                    <div style={{ color: T.faint, fontSize: 11, marginTop: 2 }}>{e.email}</div>
                  </td>
                  <td style={{ ...td }}>
                    <div style={{ fontSize: 12 }}>{e.campaign}</div>
                    <div style={{ color: e.client ? T.accent : T.muted, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{e.client}</div>
                  </td>
                  <td style={{ ...td, maxWidth: 240 }}>
                    <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5, fontStyle: "italic" }}>"{e.reason}"</div>
                  </td>
                  <td style={{ ...td, color: T.muted, fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    <div style={{ color: T.faint, fontSize: 11 }}>{new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td style={td}>
                    <span style={{ background: e.method === "Auto-detected" ? T.accentBg : T.faint + "44", color: e.method === "Auto-detected" ? T.accent : T.muted, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>
                      {e.method}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => { if (window.confirm(`Remove ${e.name} from suppression list? Only do this if you have a documented reason.`)) removeEntry(e.email); }}
                      style={{ background: "transparent", color: T.faint, border: `1px solid ${T.faint}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── UNIFIED INBOX ───────────────────────────────────────────────────────────
const INTENT_CONFIG = {
  interested:   { label: "Interested",    color: T.accent,  icon: "🔥", bg: "rgba(45,206,152,0.12)"  },
  not_now:      { label: "Not now",       color: T.yellow,  icon: "⏳", bg: "rgba(210,153,34,0.12)"  },
  wrong_person: { label: "Wrong person",  color: T.muted,   icon: "↪",  bg: "rgba(125,133,144,0.12)" },
  referral:     { label: "Referral",      color: T.blue,    icon: "👤", bg: "rgba(88,166,255,0.12)"  },
  objection:    { label: "Has objection", color: T.purple,  icon: "⚡", bg: "rgba(188,140,255,0.12)" },
  unknown:      { label: "Analysing…",   color: T.faint,   icon: "·",  bg: "transparent"             },
};

const INTENT_ACTIONS = {
  interested:   [{ id: "book",    label: "📅 Book meeting",      primary: true  }, { id: "reply",   label: "✦ Draft reply",         primary: false }],
  not_now:      [{ id: "nurture", label: "🔁 Add to nurture",    primary: true  }, { id: "snooze",  label: "⏸ Snooze 30 days",      primary: false }],
  wrong_person: [{ id: "refer",   label: "↪ Ask for referral",   primary: true  }, { id: "remove",  label: "✕ Remove from sequence", primary: false }],
  referral:     [{ id: "reply",   label: "✦ Draft thank-you",    primary: true  }, { id: "add",     label: "+ Add referred person",   primary: false }],
  objection:    [{ id: "address", label: "✦ Address objection",  primary: true  }, { id: "reply",   label: "✦ Draft reply",         primary: false }],
  unknown:      [],
};

function IntentBadge({ intent, small = false }) {
  const cfg = INTENT_CONFIG[intent] || INTENT_CONFIG.unknown;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: small ? 10 : 11, fontWeight: 700, padding: small ? "2px 6px" : "3px 8px", borderRadius: 4, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span>{cfg.icon}</span>{cfg.label}
    </span>
  );
}

function Inbox({ leads, setLeads, logActivity }) {
  const conversations = (leads || []).filter(l => l.messages && l.messages.length > 0);

  const [selectedId, setSelectedId]     = useState(null);
  const [filter, setFilter]             = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [reply, setReply]               = useState("");
  const [suggesting, setSuggesting]     = useState(false);
  const [intents, setIntents]           = useState({});
  const [actionDone, setActionDone]     = useState(null);
  const [suppressions, suppress]        = useSuppression();

  const selected = conversations.find(l => l.id === selectedId) || conversations[0] || null;

  const updateLead = (id, patch) => setLeads(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));

  // Check if a conversation's contact is suppressed
  const isSuppressed = (conv) => {
    if (!conv) return false;
    const email = `${conv.name.toLowerCase().replace(/\s+/g, ".")}@${conv.company.toLowerCase()}.com`;
    return !!suppressions[email];
  };

  // Auto-detect opt-out in inbound messages and add to suppression list
  const checkForOptOut = (conv) => {
    const lastIn = [...conv.messages].reverse().find(m => m.dir === "in");
    if (!lastIn || !isOptOut(lastIn.text)) return false;
    const email = `${conv.name.toLowerCase().replace(/\s+/g, ".")}@${conv.company.toLowerCase()}.com`;
    if (!suppressions[email]) {
      suppress({ name: conv.name, email, company: conv.company, campaign: conv.campaign, client: conv.client, date: new Date().toISOString(), method: "Auto-detected", reason: lastIn.text.slice(0, 120) });
    }
    return true;
  };

  const filtered = conversations.filter(c => {
    const matchStatus = filter === "all" || (filter === "unread" ? c.unread : c.status === filter);
    const matchClient = clientFilter === "all" || c.client === clientFilter;
    return matchStatus && matchClient;
  });

  const unreadCount = conversations.filter(c => c.unread).length;

  // Classify a conversation using Claude
  const classifyIntent = async (conv) => {
    if (intents[conv.id]?.intent && intents[conv.id].intent !== "unknown") return; // already classified
    const lastInbound = [...conv.messages].reverse().find(m => m.dir === "in");
    if (!lastInbound) return;
    setIntents(i => ({ ...i, [conv.id]: { intent: "unknown", reason: "", nextStep: "", loading: true } }));

    const history = conv.messages.slice(-6).map(m => `${m.dir === "out" ? "You" : conv.name}: ${m.text}`).join("\n");
    const prompt = `Classify this LinkedIn reply for a salesperson. Read the full conversation then classify the LAST inbound message.

Conversation:
${history}

Classify into exactly one of: interested, not_now, wrong_person, referral, objection

Respond with JSON only:
{
  "intent": "one of the above",
  "confidence": "high|medium|low",
  "reason": "one sentence explaining why, referencing specific words from their reply",
  "nextStep": "one very specific action the salesperson should take right now (max 12 words)"
}`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setIntents(i => ({ ...i, [conv.id]: { ...parsed, loading: false } }));
    } catch {
      setIntents(i => ({ ...i, [conv.id]: { intent: "unknown", reason: "Could not classify", nextStep: "", loading: false } }));
    }
  };

  const suggestReply = async (overridePrompt = null) => {
    if (!selected) return;
    setSuggesting(true);
    const history = selected.messages.map(m => `${m.dir === "out" ? "You" : selected.name}: ${m.text}`).join("\n");
    const intent = intents[selected.id];
    const contextHint = overridePrompt || (intent?.intent === "objection"
      ? `Address their objection: "${intent.reason}". Don't be defensive, acknowledge it and reframe.`
      : intent?.intent === "not_now"
      ? "They said not now. Write a warm 'no problem, I'll check back in' message that leaves the door open."
      : intent?.intent === "wrong_person"
      ? "They're not the right person. Politely ask who the best person would be to speak to."
      : "Move toward booking a meeting if the prospect seems warm.");
    const prompt = `You are a sales rep. Based on this LinkedIn conversation, write a short natural reply (2–3 sentences). ${contextHint}\n\nConversation:\n${history}\n\nWrite only the reply message, nothing else.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setReply(data.content?.find(b => b.type === "text")?.text || "");
    } catch {}
    setSuggesting(false);
  };

  const sendReply = () => {
    if (!reply.trim() || !selected || isSuppressed(selected)) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newMsg = { id: Date.now(), dir: "out", text: reply.trim(), time: `Today ${timeStr}` };
    updateLead(selected.id, { messages: [...selected.messages, newMsg], last: "Just now", unread: false });
    if (logActivity) logActivity("reply", `Reply sent to ${selected.name}`, { name: selected.name, campaign: selected.campaign });
    setReply("");
  };

  const markMeeting = () => {
    if (!selected) return;
    updateLead(selected.id, { status: "meeting", pipelineStage: "converted", unread: false });
    if (logActivity) logActivity("meeting", `Meeting booked with ${selected.name} · ${selected.company}`, { name: selected.name, company: selected.company });
  };

  const markRead = (conv) => {
    updateLead(conv.id, { unread: false });
    setSelectedId(conv.id);
    checkForOptOut(conv);
    classifyIntent(conv);
  };

  const handleAction = (actionId) => {
    if (actionId === "book") { markMeeting(); setActionDone("meeting"); }
    else if (actionId === "reply" || actionId === "address") { suggestReply(); }
    else if (actionId === "refer") { suggestReply("Ask who the right person would be to speak to about this. Keep it brief and friendly."); }
    else if (actionId === "nurture") { setActionDone("nurture"); }
    else if (actionId === "snooze") { setActionDone("snoozed"); }
    else if (actionId === "remove") { setActionDone("removed"); }
    else if (actionId === "add") { setActionDone("added"); }
    setTimeout(() => setActionDone(null), 2500);
  };

  const clientNames = [...new Set(conversations.map(c => c.client).filter(Boolean))];
  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" };
  const selectedIntent = selected ? intents[selected.id] : null;
  const intentCfg = selectedIntent ? (INTENT_CONFIG[selectedIntent.intent] || INTENT_CONFIG.unknown) : null;
  const actions = selectedIntent ? (INTENT_ACTIONS[selectedIntent.intent] || []) : [];

  // Auto-classify selected conversation on mount/change
  useEffect(() => { if (selected) classifyIntent(selected); }, [selected?.id]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* Left: Conversation list */}
      <div style={{ width: 300, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "1.25rem 1rem 0.75rem", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>
              Inbox
              {unreadCount > 0 && <span style={{ background: T.accent, color: "#0d1117", fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 10, marginLeft: 8 }}>{unreadCount}</span>}
            </div>
            <select style={{ ...inp, padding: "5px 8px", fontSize: 12, color: T.muted }} value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
              <option value="all">All clients</option>
              {clientNames.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["all", "All"], ["unread", "Unread"], ["replied", "Replied"], ["meeting", "Meeting"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{ background: filter === val ? T.accentBg : "transparent", color: filter === val ? T.accent : T.muted, border: `1px solid ${filter === val ? T.accent : "transparent"}`, borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontSize: 11, fontWeight: filter === val ? 700 : 400 }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: T.muted, fontSize: 13 }}>No conversations</div>}
          {filtered.map(conv => {
            const ci = intents[conv.id];
            const hasBadge = ci && ci.intent !== "unknown" && !ci.loading;
            return (
              <div key={conv.id} onClick={() => markRead(conv)} style={{ padding: "0.875rem 1rem", borderBottom: `1px solid ${T.faint}`, cursor: "pointer", background: selected?.id === conv.id ? T.accentDim : conv.unread ? T.accent + "08" : "transparent", borderLeft: selected?.id === conv.id ? `3px solid ${T.accent}` : "3px solid transparent", transition: "background 0.12s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: conv.color + "22", color: conv.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{conv.initials}</div>
                    {conv.unread && <div style={{ position: "absolute", top: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: T.accent, border: `2px solid ${T.bg}` }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: conv.unread ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{conv.name}</span>
                      <span style={{ color: T.muted, fontSize: 11, flexShrink: 0 }}>{conv.last}</span>
                    </div>
                    <div style={{ color: T.muted, fontSize: 11, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conv.title} · {conv.company}</div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ background: conv.clientColor + "22", color: conv.clientColor, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3 }}>{conv.client}</span>
                      {isSuppressed(conv)
                        ? <span style={{ background: T.red + "22", color: T.red, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>🚫 Opted out</span>
                        : hasBadge ? <IntentBadge intent={ci.intent} small /> : <Badge status={conv.status} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Thread view */}
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Thread header */}
          <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: selected.color + "22", color: selected.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{selected.initials}</div>
              <div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>{selected.title} at {selected.company} · <span style={{ color: selected.clientColor }}>{selected.client}</span></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {selected.status !== "meeting"
                ? <button onClick={markMeeting} style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 7, padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>📅 Book Meeting</button>
                : <span style={{ background: T.purple + "22", color: T.purple, border: `1px solid ${T.purple}`, borderRadius: 7, padding: "7px 13px", fontSize: 12, fontWeight: 700 }}>✓ Meeting Booked</span>}
              <button style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 13px", cursor: "pointer", fontSize: 12 }}>Archive</button>
            </div>
          </div>

          {/* ── Intelligence panel ── */}
          {selectedIntent && (
            <div style={{ padding: "0.75rem 1.5rem", borderBottom: `1px solid ${T.border}`, background: intentCfg?.bg || "transparent", flexShrink: 0 }}>
              {selectedIntent.loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  Analysing reply…
                </div>
              ) : selectedIntent.intent !== "unknown" ? (
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <IntentBadge intent={selectedIntent.intent} />
                        {selectedIntent.confidence && (
                          <span style={{ color: T.faint, fontSize: 11 }}>{selectedIntent.confidence} confidence</span>
                        )}
                      </div>
                      {selectedIntent.reason && (
                        <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5, marginBottom: selectedIntent.nextStep ? 4 : 0 }}>{selectedIntent.reason}</div>
                      )}
                      {selectedIntent.nextStep && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: intentCfg?.color || T.accent, fontSize: 11, fontWeight: 700 }}>Suggested:</span>
                          <span style={{ color: T.text, fontSize: 12 }}>{selectedIntent.nextStep}</span>
                        </div>
                      )}
                    </div>
                    {/* Quick action buttons */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {actionDone ? (
                        <span style={{ background: T.accentBg, color: T.accent, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 7 }}>✓ Done</span>
                      ) : actions.map(a => (
                        <button key={a.id} onClick={() => handleAction(a.id)} style={{ background: a.primary ? (intentCfg?.color || T.accent) : "transparent", color: a.primary ? "#0d1117" : T.muted, border: `1px solid ${a.primary ? (intentCfg?.color || T.accent) : T.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: a.primary ? 700 : 400, whiteSpace: "nowrap" }}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Campaign tag */}
          <div style={{ padding: "0.5rem 1.5rem", borderBottom: `1px solid ${T.faint}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.muted, fontSize: 11 }}>Campaign:</span>
            <span style={{ color: T.text, fontSize: 11, background: T.faint, padding: "2px 8px", borderRadius: 4 }}>{selected.campaign}</span>
            <span style={{ color: T.muted, fontSize: 11, marginLeft: "auto" }}>{selected.messages.length} messages</span>
          </div>

          {/* Opt-out hard-stop banner */}
          {isSuppressed(selected) && (
            <div style={{ background: T.red + "18", border: `1px solid ${T.red}44`, borderRadius: 0, padding: "0.875rem 1.5rem", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>🚫</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.red, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>This contact has opted out</div>
                <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
                  {selected.name} requested to be removed from outreach. Sending further messages may violate GDPR and CAN-SPAM regulations. This contact is logged in your <strong style={{ color: T.text }}>Suppression List</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
            {selected.messages.map(msg => (
              <div key={msg.id} style={{ display: "flex", justifyContent: msg.dir === "out" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: msg.dir === "out" ? "flex-end" : "flex-start", gap: 4 }}>
                  <div style={{ background: msg.dir === "out" ? T.accentBg : T.card, border: `1px solid ${msg.dir === "out" ? T.accent + "44" : T.border}`, borderRadius: msg.dir === "out" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 14px", color: T.text, fontSize: 13, lineHeight: 1.6 }}>{msg.text}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{msg.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply composer */}
          <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            {isSuppressed(selected) ? (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🚫</span>
                <span style={{ color: T.muted, fontSize: 13 }}>Replies are disabled — this contact has opted out of outreach.</span>
              </div>
            ) : (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
              <textarea rows={3} value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
                placeholder="Write a reply… or use AI Suggest below"
                style={{ width: "100%", background: "transparent", border: "none", color: T.text, padding: "12px 14px", fontSize: 13, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: `1px solid ${T.faint}` }}>
                <button onClick={() => suggestReply()} disabled={suggesting}
                  style={{ background: suggesting ? T.faint : T.accentBg, color: T.accent, border: "none", borderRadius: 6, padding: "6px 12px", cursor: suggesting ? "default" : "pointer", fontSize: 12, fontWeight: 700, opacity: suggesting ? 0.7 : 1 }}>
                  {suggesting ? "Thinking…" : "✦ AI Suggest"}
                </button>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: T.muted, fontSize: 11 }}>⌘↵ to send</span>
                  <button onClick={sendReply} disabled={!reply.trim()} style={{ background: reply.trim() ? T.accent : T.faint, color: reply.trim() ? "#0d1117" : T.muted, border: "none", borderRadius: 7, padding: "7px 16px", cursor: reply.trim() ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>Send →</button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 14 }}>Select a conversation</div>
      )}
    </div>
  );
}

// ─── AI COACH ────────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
  { id: "meetings", label: "Book more sales meetings", icon: "📅" },
  { id: "leads",    label: "Generate leads for clients", icon: "🎯" },
  { id: "network",  label: "Grow my LinkedIn network", icon: "🤝" },
  { id: "pipeline", label: "Build a repeatable pipeline", icon: "🔁" },
];
const EXP_OPTIONS = [
  { id: "new",         label: "New to outreach",      sub: "I've never run a campaign before" },
  { id: "some",        label: "Some experience",       sub: "I've done manual outreach before" },
  { id: "experienced", label: "Pretty experienced",    sub: "I've used tools like this before" },
];

function Coach() {
  const [coachData, setCoachData] = useLocalStorage("rf_coach", {
    phase: "setup", goal: null, exp: null, weeklyTarget: 10,
    plan: null, checkedSteps: [], messages: [], tab: "plan"
  });

  const { phase, goal, exp, weeklyTarget, plan, checkedSteps, messages, tab } = coachData;
  const set = patch => setCoachData(d => ({ ...d, ...patch }));

  const [input, setInput]       = useState("");
  const [generating, setGenerating] = useState(false);
  const [thinking, setThinking] = useState(false);

  const completedCount = checkedSteps.length;
  const totalSteps     = plan?.steps?.length || 6;
  const pct = totalSteps ? Math.round(completedCount / totalSteps * 100) : 0;

  const appContext = `ReachFlow agency outreach platform. Features: Dashboard, Inbox, Pipeline, Campaigns (flow builder, A/B testing), Lead Lists (LinkedIn URL import, CSV), Analytics (per-client filter), AI Coach, Settings, Social Media.`;

  const generatePlan = async () => {
    if (!goal || !exp) return;
    setGenerating(true);
    const goalLabel = GOAL_OPTIONS.find(g => g.id === goal)?.label;
    const expLabel  = EXP_OPTIONS.find(e => e.id === exp)?.label;
    const prompt = `You are an outreach coach. Generate a personalised 6-step action plan.
User goal: ${goalLabel}
Experience: ${expLabel}
Weekly target: ${weeklyTarget} conversations

App context: ${appContext}

Respond JSON only:
{"greeting":"2-sentence warm intro","planTitle":"short title max 6 words","steps":[{"id":1,"title":"short title","detail":"1-2 sentences","feature":"feature name","effort":"X min"}]}`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      set({ plan: parsed, phase: "active", tab: "plan",
            messages: [{ role: "assistant", text: parsed.greeting + " Your plan is ready — check the Plan tab. I'm here whenever you have questions." }] });
    } catch {
      set({ plan: { greeting: "Let\'s get you started!", planTitle: "Your Launch Plan", steps: [
        { id: 1, title: "Connect LinkedIn", detail: "Add a client and complete OAuth. Takes 2 minutes.", feature: "Dashboard", effort: "2 min" },
        { id: 2, title: "Define your ICP", detail: "Fill in job title, industry and company size in the onboarding wizard.", feature: "Onboarding", effort: "3 min" },
        { id: 3, title: "Import leads", detail: "Paste a LinkedIn search URL in Lead Lists. Aim for 50–100 leads.", feature: "Lead Lists", effort: "10 min" },
        { id: 4, title: "Build your sequence", detail: "Use the Flow Builder to create a 3-step conditional sequence.", feature: "Campaigns", effort: "15 min" },
        { id: 5, title: "Launch campaign", detail: "Assign your lead list and go live.", feature: "Campaigns", effort: "5 min" },
        { id: 6, title: "Work your inbox daily", detail: "Replies land in Inbox. Use AI Suggest for fast responses.", feature: "Inbox", effort: "10 min/day" },
      ]}, phase: "active", tab: "plan",
      messages: [{ role: "assistant", text: "Your personalised plan is ready in the Plan tab. Ask me anything!" }] });
    }
    setGenerating(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    const newMsgs = [...messages, { role: "user", text: userMsg }];
    set({ messages: newMsgs });
    setThinking(true);
    const goalLabel = GOAL_OPTIONS.find(g => g.id === goal)?.label || "grow outreach";
    const expLabel  = EXP_OPTIONS.find(e => e.id === exp)?.label || "some experience";
    const done = plan?.steps?.filter(s => checkedSteps.includes(s.id)).map(s => s.title) || [];
    const todo = plan?.steps?.filter(s => !checkedSteps.includes(s.id)).map(s => s.title) || [];
    const sys = `You are a friendly outreach coach inside ReachFlow.
Context: ${appContext}
User: goal="${goalLabel}", experience="${expLabel}", target=${weeklyTarget}/week
Completed: ${done.join(", ") || "none"}
Remaining: ${todo.join(", ") || "all done!"}
Keep replies concise (2-4 sentences). Be specific and practical.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys,
          messages: newMsgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })) }),
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Try rephrasing that!";
      set({ messages: [...newMsgs, { role: "assistant", text: reply }] });
    } catch {
      set({ messages: [...newMsgs, { role: "assistant", text: "Something went wrong — try again!" }] });
    }
    setThinking(false);
  };

  const toggleStep = id => set({ checkedSteps: checkedSteps.includes(id) ? checkedSteps.filter(x => x !== id) : [...checkedSteps, id] });
  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" };

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.accentBg, border: `1px solid ${T.accent}44`, borderRadius: 8, padding: "5px 12px", marginBottom: "1rem" }}>
          <span style={{ color: T.accent }}>✦</span>
          <span style={{ color: T.accent, fontSize: 12, fontWeight: 700 }}>AI Coach</span>
        </div>
        <h1 style={{ color: T.text, fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Let\'s build your plan</h1>
        <p style={{ color: T.muted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>Answer three quick questions and I\'ll create a personalised action plan — and stay on hand to guide you through every step. Your progress is saved automatically.</p>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: "0.75rem" }}>What\'s your main goal?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GOAL_OPTIONS.map(g => (
            <div key={g.id} onClick={() => set({ goal: g.id })} style={{ background: goal === g.id ? T.accentBg : T.card, border: `1.5px solid ${goal === g.id ? T.accent : T.border}`, borderRadius: 10, padding: "0.875rem", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{g.icon}</div>
              <div style={{ color: goal === g.id ? T.accent : T.text, fontSize: 13, fontWeight: 600 }}>{g.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: "0.75rem" }}>How experienced are you with outreach?</div>
        {EXP_OPTIONS.map(e => (
          <div key={e.id} onClick={() => set({ exp: e.id })} style={{ background: exp === e.id ? T.accentBg : T.card, border: `1.5px solid ${exp === e.id ? T.accent : T.border}`, borderRadius: 10, padding: "0.875rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, transition: "all 0.15s" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${exp === e.id ? T.accent : T.border}`, background: exp === e.id ? T.accent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {exp === e.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0d1117" }} />}
            </div>
            <div>
              <div style={{ color: exp === e.id ? T.accent : T.text, fontSize: 13, fontWeight: 600 }}>{e.label}</div>
              <div style={{ color: T.muted, fontSize: 12 }}>{e.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: "0.75rem" }}>
          Weekly conversations target: <span style={{ color: T.accent, fontWeight: 800 }}>{weeklyTarget}</span>
        </div>
        <input type="range" min={5} max={100} step={5} value={weeklyTarget} onChange={e => set({ weeklyTarget: Number(e.target.value) })} style={{ width: "100%", accentColor: T.accent }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: T.muted, fontSize: 11, marginTop: 4 }}>
          <span>5 — light</span><span>50 — active</span><span>100 — aggressive</span>
        </div>
      </div>

      <button onClick={generatePlan} disabled={!goal || !exp || generating}
        style={{ background: goal && exp && !generating ? T.accent : T.faint, color: goal && exp && !generating ? "#0d1117" : T.muted, border: "none", borderRadius: 10, padding: "12px 24px", cursor: goal && exp && !generating ? "pointer" : "default", fontSize: 14, fontWeight: 700, width: "100%" }}>
        {generating ? "Building your plan…" : "Build my action plan →"}
      </button>
    </div>
  );

  // ── Active phase (tabbed) ─────────────────────────────────────────────────
  const TABS = [
    { id: "plan",     label: "Action Plan" },
    { id: "progress", label: `Progress ${pct > 0 ? pct + "%" : ""}` },
    { id: "chat",     label: `Chat${messages.filter(m => m.role === "assistant").length > 1 ? " ·" + (messages.length) : ""}` },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: T.accent }}>✦</span>
            <span style={{ color: T.accent, fontSize: 12, fontWeight: 700 }}>AI Coach</span>
            <span style={{ background: T.faint, color: T.muted, fontSize: 11, padding: "1px 7px", borderRadius: 4 }}>{GOAL_OPTIONS.find(g => g.id === goal)?.label}</span>
          </div>
          <h1 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: "0 0 2px" }}>{plan?.planTitle || "Your Plan"}</h1>
          <div style={{ color: T.muted, fontSize: 12 }}>{EXP_OPTIONS.find(e => e.id === exp)?.label} · {weeklyTarget} conversations/week target</div>
        </div>
        <button onClick={() => set({ phase: "setup", plan: null, checkedSteps: [], messages: [], tab: "plan" })}
          style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>↺ Restart</button>
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.25rem" }}>
        <div style={{ flex: 1, background: T.faint, borderRadius: 4, height: 6 }}>
          <div style={{ background: pct === 100 ? T.green : T.accent, height: 6, borderRadius: 4, width: pct + "%", transition: "width 0.4s" }} />
        </div>
        <span style={{ color: pct === 100 ? T.green : T.accent, fontSize: 12, fontWeight: 700, minWidth: 36 }}>{pct}%</span>
        {pct === 100 && <span style={{ color: T.green, fontSize: 12 }}>🎉 Plan complete!</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: "1.5rem" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => set({ tab: t.id })} style={{ background: "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`, color: tab === t.id ? T.accent : T.muted, padding: "8px 20px 10px", cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {/* ── Plan tab ── */}
      {tab === "plan" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(plan?.steps || []).map((step, i) => {
            const done = checkedSteps.includes(step.id);
            return (
              <div key={step.id} onClick={() => toggleStep(step.id)}
                style={{ background: done ? T.accentDim : T.card, border: `1px solid ${done ? T.accent + "55" : T.border}`, borderRadius: 10, padding: "1rem", cursor: "pointer", opacity: done ? 0.7 : 1, transition: "all 0.2s" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${done ? T.accent : T.border}`, background: done ? T.accent : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                    {done ? <span style={{ color: "#0d1117", fontSize: 11, fontWeight: 900 }}>✓</span> : <span style={{ color: T.muted, fontSize: 10 }}>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: done ? T.muted : T.text, fontSize: 13, fontWeight: 600, textDecoration: done ? "line-through" : "none", marginBottom: done ? 0 : 4 }}>{step.title}</div>
                    {!done && <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>{step.detail}</div>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ background: T.faint, color: T.muted, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>{step.feature}</span>
                      <span style={{ background: T.faint, color: T.muted, fontSize: 10, padding: "2px 7px", borderRadius: 4 }}>⏱ {step.effort}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Progress tab ── */}
      {tab === "progress" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.5rem" }}>
            {[
              { label: "Steps done",    val: completedCount + " / " + totalSteps, col: T.accent },
              { label: "Completion",    val: pct + "%",                            col: pct === 100 ? T.green : T.blue },
              { label: "Target",        val: weeklyTarget + "/wk",                 col: T.purple },
            ].map(s => (
              <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.125rem", textAlign: "center" }}>
                <div style={{ color: s.col, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{s.val}</div>
                <div style={{ color: T.muted, fontSize: 11 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(plan?.steps || []).map((step, i) => {
              const done = checkedSteps.includes(step.id);
              return (
                <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${done ? T.accent + "44" : T.border}`, borderRadius: 9, padding: "0.875rem 1rem" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? T.accent : T.faint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {done ? <span style={{ color: "#0d1117", fontSize: 10, fontWeight: 900 }}>✓</span> : <span style={{ color: T.muted, fontSize: 10 }}>{i + 1}</span>}
                  </div>
                  <span style={{ flex: 1, color: done ? T.muted : T.text, fontSize: 13, textDecoration: done ? "line-through" : "none" }}>{step.title}</span>
                  <span style={{ background: T.faint, color: T.muted, fontSize: 10, padding: "2px 7px", borderRadius: 4 }}>{step.feature}</span>
                  {!done && <button onClick={() => set({ tab: "chat", messages: [...messages, { role: "user", text: "Help me with: " + step.title }] })} style={{ background: T.accentBg, color: T.accent, border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Ask coach →</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chat tab ── */}
      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: 520, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem", color: T.muted, fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                Your coach is ready — ask anything about outreach, the app, or your next step.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "78%", display: "flex", gap: 8, alignItems: "flex-end", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  {m.role === "assistant" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.accentBg, border: `1px solid ${T.accent}44`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.accent }}>✦</div>}
                  <div style={{ background: m.role === "user" ? T.accentBg : T.surface, border: `1px solid ${m.role === "user" ? T.accent + "44" : T.border}`, borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "9px 13px", color: T.text, fontSize: 13, lineHeight: 1.65 }}>{m.text}</div>
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.accentBg, border: `1px solid ${T.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.accent }}>✦</div>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px 12px 12px 4px", padding: "9px 16px", color: T.muted, fontSize: 13 }}><span style={{ letterSpacing: 3 }}>···</span></div>
              </div>
            )}
            <div ref={el => el?.scrollIntoView({ behavior: "smooth" })} />
          </div>
          {messages.length > 0 && messages.length <= 2 && (
            <div style={{ padding: "0 1rem 0.75rem", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["How do I write a good connection request?", "What reply rate should I aim for?", "Walk me through my next step"].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ background: T.surface, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>{q}</button>
              ))}
            </div>
          )}
          <div style={{ padding: "0.75rem 1rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="Ask your coach…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} />
            <button onClick={sendMessage} disabled={!input.trim() || thinking}
              style={{ background: input.trim() && !thinking ? T.accent : T.faint, color: input.trim() && !thinking ? "#0d1117" : T.muted, border: "none", borderRadius: 8, padding: "0 14px", cursor: input.trim() && !thinking ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PIPELINE ────────────────────────────────────────────────────────────────
const STAGES = [
  { id: "prospecting", label: "Prospecting", desc: "Not yet contacted", color: T.muted },
  { id: "contacted",   label: "Contacted",   desc: "Awaiting reply",    color: "#58a6ff" },
  { id: "engaged",     label: "Engaged",     desc: "Replied — follow up", color: "#d29922" },
  { id: "converted",   label: "Converted",   desc: "Meeting booked",    color: "#3fb950" },
];

function Pipeline({ leads, setLeads, logActivity }) {
  const [dragging, setDragging] = useState(null);
  const [hovering, setHovering] = useState(null);

  const move = (leadId, toStage) => {
    const lead = leads.find(l => l.id === leadId);
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, pipelineStage: toStage, days: 0 } : l));
    if (lead && logActivity) logActivity("pipeline", `${lead.name} moved to ${toStage}`, { leadName: lead.name, stage: toStage });
    setDragging(null); setHovering(null);
  };

  const stageLeads = (stageId) => leads.filter(l => l.pipelineStage === stageId);
  const totalConverted = leads.filter(l => l.pipelineStage === "converted").length;
  const convRate = leads.length ? Math.round(totalConverted / leads.length * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Pipeline</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{leads.length} leads · {convRate}% conversion rate · Drag cards to update stage</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["Total", leads.length, T.text], ["Converted", totalConverted, T.green]].map(([l, v, c]) => (
            <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 14px", textAlign: "center" }}>
              <div style={{ color: c, fontSize: 18, fontWeight: 800 }}>{v}</div>
              <div style={{ color: T.muted, fontSize: 11 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, alignItems: "start" }}>
        {STAGES.map(stage => {
          const sLeads = stageLeads(stage.id);
          const isOver = hovering === stage.id && dragging && dragging.pipelineStage !== stage.id;
          return (
            <div key={stage.id}
              onDragOver={e => { e.preventDefault(); setHovering(stage.id); }}
              onDragLeave={() => setHovering(null)}
              onDrop={() => dragging && move(dragging.id, stage.id)}
              style={{ background: isOver ? T.accentDim : T.surface, border: `1.5px dashed ${isOver ? T.accent : T.border}`, borderRadius: 12, padding: "0.875rem", minHeight: 200, transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                <div>
                  <div style={{ color: stage.color, fontSize: 12, fontWeight: 700 }}>{stage.label}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{stage.desc}</div>
                </div>
                <span style={{ background: stage.color + "22", color: stage.color, fontSize: 11, fontWeight: 800, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{sLeads.length}</span>
              </div>

              {sLeads.map(lead => (
                <div key={lead.id} draggable
                  onDragStart={() => setDragging(lead)}
                  onDragEnd={() => { setDragging(null); setHovering(null); }}
                  style={{ background: T.card, border: `1px solid ${dragging?.id === lead.id ? T.accent : T.border}`, borderRadius: 9, padding: "0.75rem", marginBottom: 8, cursor: "grab", opacity: dragging?.id === lead.id ? 0.5 : 1, transition: "opacity 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: (lead.color || "#7d8590") + "22", color: lead.color || "#7d8590", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{lead.initials || lead.name.slice(0,2).toUpperCase()}</div>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{lead.name}</div>
                  </div>
                  <div style={{ color: T.muted, fontSize: 11, marginBottom: 6 }}>{lead.title} · {lead.company}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ background: T.faint, color: T.muted, fontSize: 10, padding: "2px 6px", borderRadius: 3, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.campaign}</span>
                    <span style={{ color: lead.days > 4 ? T.yellow : T.muted, fontSize: 10 }}>{lead.days === 0 ? "Today" : `${lead.days}d`}</span>
                  </div>
                  {lead.messages?.length > 0 && (
                    <div style={{ marginTop: 5, display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ background: T.accentBg, color: T.accent, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3 }}>💬 {lead.messages.length} msgs</span>
                      {lead.unread && <span style={{ background: T.accent, color: "#0d1117", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3 }}>NEW</span>}
                    </div>
                  )}
                </div>
              ))}

              {sLeads.length === 0 && (
                <div style={{ color: T.faint, fontSize: 12, textAlign: "center", paddingTop: "1.5rem" }}>Drop leads here</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SEQUENCE TEMPLATES ───────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 1, name: "SaaS Sales Demo", tag: "Most popular", tagCol: T.accent,
    desc: "Book product demos with decision-makers at software companies. Works best for targeting VPs, Heads of, and C-suite.",
    replyRate: "14–18%", bestFor: "SaaS / Software companies",
    steps: [
      { day: 0, type: "Connection Request", msg: "Hi {{first_name}}, I noticed {{company}} is scaling fast — I work with similar teams on [specific problem]. Thought it'd be worth connecting.", why: "Short and specific. Mentioning their company growth gives a reason to connect without being salesy." },
      { day: 3, type: "Follow-up", msg: "Thanks for connecting, {{first_name}}. Quick question — is [specific challenge] something that's on your radar right now at {{company}}?", why: "A question, not a pitch. People reply to questions. 'On your radar' is low-pressure language." },
      { day: 7, type: "Value Add", msg: "Thought this might be useful — [relevant insight or resource]. Happy to walk you through how we've helped teams like {{company}} with this. Worth a 20 min call?", why: "Give before you ask. Sharing something useful builds trust before requesting time." },
    ],
  },
  {
    id: 2, name: "Technical Recruiting", tag: "High reply rate", tagCol: T.blue,
    desc: "Reach out to engineers and technical leads about open roles. Works best when you mention the tech stack upfront.",
    replyRate: "18–24%", bestFor: "Engineering, DevOps, Product roles",
    steps: [
      { day: 0, type: "Connection Request", msg: "Hi {{first_name}}, your work on [specific tech/project] caught my eye. I'm connecting with senior [role] engineers — would love to be in your network.", why: "Engineers ignore generic recruiter messages. Mentioning specific work shows you actually looked at their profile." },
      { day: 4, type: "Role Intro", msg: "{{first_name}}, working on something I think you'd find interesting — a [role] role at [company type] using [tech stack]. No pressure at all, but curious if you're open to a conversation?", why: "'No pressure' and 'curious if' removes the feeling of being recruited at. It's an invitation, not a pitch." },
      { day: 9, type: "Final Follow-up", msg: "Still thinking of you for this one, {{first_name}}. The team is strong and the problem space is genuinely interesting. Happy to share more if timing's ever right.", why: "A final nudge that doesn't beg. Leaving the door open without chasing." },
    ],
  },
  {
    id: 3, name: "Agency New Business", tag: "For agencies", tagCol: T.purple,
    desc: "Win new clients for your agency. Focuses on results and social proof rather than describing services.",
    replyRate: "10–14%", bestFor: "Agency owners targeting marketing/growth leads",
    steps: [
      { day: 0, type: "Connection Request", msg: "Hi {{first_name}}, I work with [industry] companies on [outcome — e.g. 'filling their pipeline with qualified meetings']. Thought we'd be worth connecting.", why: "Lead with outcome, not service. 'Filling pipeline with meetings' is more compelling than 'outreach agency'." },
      { day: 3, type: "Social Proof", msg: "We recently helped [similar company type] go from [X] to [Y] in [timeframe]. Not sure if the timing's right for {{company}}, but happy to share what we did if useful?", why: "A concrete result from a similar company is your strongest asset. 'Not sure if timing's right' reduces resistance." },
      { day: 8, type: "Soft CTA", msg: "Last message — I know inboxes are busy. If you ever want to compare notes on what's working for outreach in [their industry], I'm an open book. No pitch.", why: "The 'last message' opener has the highest open rate of any follow-up. Promising no pitch gets replies." },
    ],
  },
  {
    id: 4, name: "Warm Network Reactivation", tag: "Quick wins", tagCol: T.yellow,
    desc: "Re-engage existing connections who've gone cold. Much higher reply rates since there's already a relationship.",
    replyRate: "25–35%", bestFor: "People you're already connected with on LinkedIn",
    steps: [
      { day: 0, type: "Re-engagement", msg: "{{first_name}}! Been a while. I saw {{company}} has been [recent news/milestone] — congrats. Hope things are going well on your end.", why: "Acknowledge something real about them before anything else. This is a conversation restart, not a pitch." },
      { day: 2, type: "Soft Intro", msg: "I've been working on something I think you'd find interesting given your background in [area]. Would love to get your take on it over a quick call?", why: "'Get your take' positions the call as asking for their advice, not selling to them. Much higher yes rate." },
    ],
  },
  {
    id: 5, name: "Social Warming Sequence", tag: "New", tagCol: T.blue,
    desc: "Warm up cold prospects over 3–4 days by engaging with their content before connecting. They recognise your name when the request arrives.",
    replyRate: "22–30%", bestFor: "Cold outreach to senior prospects with active LinkedIn presence",
    steps: [
      { day: 0, type: "👤 View Profile",       msg: "AI visits the prospect's LinkedIn profile. They'll see your name in their 'Who viewed your profile' notifications.", why: "A profile view plants your name without any commitment. Many prospects check back — this is warm intent before you've said a word." },
      { day: 1, type: "♥ Like Post",            msg: "AI likes their most recent LinkedIn post.", why: "A second touchpoint with zero friction. They've now seen your name twice. This is social proof of genuine engagement, not mass outreach." },
      { day: 2, type: "💬 Comment on Post",     msg: "AI writes a genuine, contextual comment on their post — referencing what they actually wrote, not a template.", why: "The most powerful step. It's public, shows you read their content, and a thoughtful question invites a reply. AI reads the actual post to write this." },
      { day: 3, type: "💬 Comment on 2nd Post", msg: "AI comments on a different post from the previous week, on a different topic — shows breadth, not a one-off.", why: "Two comments over two days establishes a pattern of genuine interest. By now they've seen your name 4 times before you've asked for anything." },
      { day: 4, type: "✉ Connection Request",   msg: "Hi {{first_name}}, I've been following your posts on [topic] — your take on [specific thing] really resonated. I work with [ICP] on [outcome]. Would love to connect.", why: "Referencing their actual content shows it's not mass outreach. Acceptance rates for warmed prospects are typically 2–3x higher than cold requests." },
      { day: 5, type: "✦ AI Conversation",       msg: "Once connected, AI manages the conversation — responding to replies, handling objections, and steering toward a booked call at the right moment.", why: "The AI knows the full context: what you commented on, their ICP, past replies. It paces the conversation to feel natural rather than rushing to the pitch." },
    ],
  },
];

function TemplatesModal({ onClose, onUse }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>Sequence templates</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>Proven outreach playbooks — click any step to see why it works</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 20, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {TEMPLATES.map(t => (
            <div key={t.id} style={{ background: T.card, border: `1px solid ${open === t.id ? T.accent : T.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden", transition: "border-color 0.15s" }}>
              {/* Template header */}
              <div style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen(open === t.id ? null : t.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{t.name}</span>
                    <span style={{ background: t.tagCol + "22", color: t.tagCol, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>{t.tag}</span>
                  </div>
                  <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>{t.desc}</div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: T.muted, fontSize: 11 }}>📈 <span style={{ color: T.green, fontWeight: 700 }}>{t.replyRate}</span> reply rate</span>
                    <span style={{ color: T.muted, fontSize: 11 }}>✓ Best for: {t.bestFor}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <button onClick={e => { e.stopPropagation(); onUse(t); onClose(); }} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Use template</button>
                  <span style={{ color: T.muted, fontSize: 16, alignSelf: "center" }}>{open === t.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Steps */}
              {open === t.id && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
                  {t.steps.map((step, i) => (
                    <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
                      <div style={{ padding: "0.75rem 1rem", display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{step.type}</span>
                            <span style={{ color: T.muted, fontSize: 11 }}>· Day {step.day}</span>
                          </div>
                          <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6, marginBottom: 8, fontStyle: "italic" }}>"{step.msg}"</div>
                          <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 6, padding: "7px 10px", display: "flex", gap: 8 }}>
                            <span style={{ color: T.accent, fontSize: 12, flexShrink: 0 }}>💡</span>
                            <span style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>{step.why}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NEW CAMPAIGN MODAL ──────────────────────────────────────────────────────
function NewCampaignModal({ onClose, onLaunchFlow, clients = DEFAULT_CLIENTS }) {
  const [step, setStep] = useState(0); // 0=details, 1=ready
  const [name, setCampaignName] = useState("");
  const [client, setClient] = useState("");
  const [channel, setChannel] = useState("linkedin");

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const canContinue = name.trim() && client;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: "1rem" }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 480, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>New campaign</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          {step === 0 && (<>
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Campaign name</div>
              <input style={inp} placeholder="e.g. Q3 SaaS Outreach" value={name} onChange={e => setCampaignName(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Client</div>
              <select style={{ ...inp, cursor: "pointer" }} value={client} onChange={e => setClient(e.target.value)}>
                <option value="">Select a client…</option>
                {CLIENTS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Channel</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["linkedin", "LinkedIn", T.blue], ["email", "Email", T.purple], ["both", "LI + Email", T.accent]].map(([id, label, col]) => (
                  <button key={id} onClick={() => setChannel(id)} style={{ background: channel === id ? col + "22" : T.card, color: channel === id ? col : T.muted, border: `1.5px solid ${channel === id ? col : T.border}`, borderRadius: 8, padding: "10px 6px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={() => setStep(1)} disabled={!canContinue} style={{ flex: 2, background: canContinue ? T.accent : T.faint, color: canContinue ? "#0d1117" : T.muted, border: "none", borderRadius: 8, padding: "10px", cursor: canContinue ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>Continue →</button>
            </div>
          </>)}

          {step === 1 && (<>
            <div style={{ textAlign: "center", padding: "0.5rem 0 1.5rem" }}>
              <div style={{ fontSize: 36, marginBottom: "0.875rem" }}>🎯</div>
              <div style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{name}</div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.5rem" }}>{client} · {channel === "both" ? "LinkedIn + Email" : channel === "linkedin" ? "LinkedIn" : "Email"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => { onLaunchFlow({ name, client, channel }); onClose(); }} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Build flow in Flow Builder →</button>
                <button onClick={() => { onClose(); }} style={{ background: T.card, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 13 }}>Start from a template instead</button>
                <button onClick={onClose} style={{ background: "transparent", color: T.muted, border: "none", cursor: "pointer", fontSize: 12, padding: "6px" }}>Save as draft — build sequence later</button>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL SEARCH ───────────────────────────────────────────────────────────
function GlobalSearch({ onClose, onNavigate }) {
  const [q, setQ] = useState("");

  const ALL = [
    ...LEADS.map(l => ({ type: "lead", label: l.name, sub: `${l.title} · ${l.company}`, badge: l.status, nav: "leads" })),
    ...CAMPAIGNS.map(c => ({ type: "campaign", label: c.name, sub: `${c.client} · ${c.channel}`, badge: c.status, nav: "campaigns" })),
    ...LEADS.filter(l => l.messages?.length > 0).map(l => ({ type: "message", label: l.name, sub: `${l.campaign} · ${l.last}`, badge: l.status, nav: "inbox" })),
    ...CLIENTS.map(c => ({ type: "client", label: c.name, sub: `${c.campaigns} campaigns`, badge: c.active ? "active" : "paused", nav: "dashboard" })),
  ];

  const results = q.trim().length < 2 ? [] : ALL.filter(r =>
    r.label.toLowerCase().includes(q.toLowerCase()) ||
    r.sub.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 10);

  const TYPE_ICON = { lead: "◉", campaign: "◎", message: "◫", client: "▦" };
  const TYPE_COL  = { lead: T.accent, campaign: T.blue, message: T.yellow, client: T.purple };

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 400, padding: "80px 1rem 1rem" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, width: "100%", maxWidth: 560, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.875rem 1rem", borderBottom: q && results.length ? `1px solid ${T.border}` : "none" }}>
          <span style={{ color: T.muted, fontSize: 16 }}>⌕</span>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search leads, campaigns, clients, conversations…"
            style={{ flex: 1, background: "transparent", border: "none", color: T.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <kbd style={{ background: T.faint, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 11 }}>Esc</kbd>
        </div>

        {q.trim().length > 0 && results.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: T.muted, fontSize: 13 }}>No results for "{q}"</div>
        )}

        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => { onNavigate(r.nav); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.75rem 1rem", cursor: "pointer", borderBottom: `1px solid ${T.faint}` }}
                onMouseEnter={e => e.currentTarget.style.background = T.card}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: TYPE_COL[r.type] + "22", color: TYPE_COL[r.type], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{TYPE_ICON[r.type]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{r.sub}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge status={r.badge} />
                  <span style={{ color: T.faint, fontSize: 11 }}>{r.nav}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {q.trim().length < 2 && (
          <div style={{ padding: "1rem 1.125rem" }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Quick jump</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["Inbox", "inbox", T.yellow], ["Pipeline", "pipeline", T.accent], ["Social", "social", T.blue], ["Analytics", "analytics", T.purple], ["Settings", "settings", T.muted]].map(([label, nav, col]) => (
                <button key={nav} onClick={() => { onNavigate(nav); onClose(); }} style={{ background: col + "11", color: col, border: `1px solid ${col}33`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function Settings({ brand = DEFAULT_BRAND, onBrandChange }) {
  const [settings, setSettings] = useLocalStorage("rf_settings", {
    emailConnected: false, fromName: "Alex Johnson", replyTo: "", signature: "Best,\nAlex Johnson\nGrowth Agency", dailyLimit: 40
  });
  const set = patch => setSettings(s => ({ ...s, ...patch }));
  const [saved, setSaved] = useState(false);
  const [brandDraft, setBrandDraft] = useState(brand);
  const setBrand = patch => setBrandDraft(b => ({ ...b, ...patch }));
  const save = () => {
    onBrandChange(brandDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const sectionTitle = { color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 4 };
  const sectionSub   = { color: T.muted, fontSize: 12, marginBottom: "1.25rem" };
  const label        = { color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" };
  const card         = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.5rem", marginBottom: "1.25rem" };

  const PRESET_COLORS = ["#2dce98", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Settings</h1>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Manage your brand, accounts, and sending preferences</p>
      </div>

      {/* ── Brand Settings ── */}
      <div style={{ ...card, border: `1.5px solid ${brandDraft.color}44` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: brandDraft.color }} />
          <div style={sectionTitle}>Brand & white-labelling</div>
        </div>
        <div style={sectionSub}>Your clients see this name, logo, and colour throughout the platform — including onboarding, reports, and the AI coach.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Agency name</label>
            <input style={inp} value={brandDraft.name} onChange={e => setBrand({ name: e.target.value })} placeholder="Your Agency" />
          </div>
          <div>
            <label style={label}>Tagline / subtitle</label>
            <input style={inp} value={brandDraft.tagline} onChange={e => setBrand({ tagline: e.target.value })} placeholder="Outreach Platform" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Logo URL <span style={{ color: T.faint, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — paste a direct image link)</span></label>
          <input style={inp} value={brandDraft.logoUrl} onChange={e => setBrand({ logoUrl: e.target.value })} placeholder="https://youragency.com/logo.png" />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={label}>Primary colour</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {PRESET_COLORS.map(c => (
              <div key={c} onClick={() => setBrand({ color: c })}
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: brandDraft.color === c ? `3px solid ${T.text}` : "3px solid transparent", transition: "border 0.15s" }} />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <input type="color" value={brandDraft.color} onChange={e => setBrand({ color: e.target.value })}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", background: "transparent", padding: 0 }} />
              <span style={{ color: T.muted, fontSize: 11 }}>Custom</span>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Live preview</div>
          <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
            {/* Mini sidebar */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 8px", width: 110, flexShrink: 0 }}>
              <div style={{ marginBottom: 8 }}>
                {brandDraft.logoUrl
                  ? <img src={brandDraft.logoUrl} alt="" style={{ height: 16, objectFit: "contain", maxWidth: 90 }} onError={e => e.target.style.display = "none"} />
                  : <div style={{ fontSize: 11, fontWeight: 800, color: T.text, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: brandDraft.color }}>{brandDraft.name || "Agency"}</span>
                    </div>}
                <div style={{ color: T.muted, fontSize: 9, marginTop: 1 }}>{brandDraft.tagline || "Console"}</div>
              </div>
              {["Dashboard", "Inbox", "Campaigns"].map((l, i) => (
                <div key={l} style={{ background: i === 0 ? brandDraft.color + "22" : "transparent", borderRadius: 4, padding: "4px 6px", marginBottom: 2, color: i === 0 ? T.text : T.muted, fontSize: 9 }}>{l}</div>
              ))}
              <div style={{ marginTop: 6, background: brandDraft.color, borderRadius: 4, padding: "4px 6px", color: "#0d1117", fontSize: 9, fontWeight: 700, textAlign: "center" }}>+ Add Client</div>
            </div>
            {/* Mini report header */}
            <div style={{ flex: 1, background: T.bg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
              <div style={{ color: brandDraft.color, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{brandDraft.name || "Agency"} · Client Report</div>
              <div style={{ color: T.text, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>TechCorp Solutions</div>
              <div style={{ color: T.muted, fontSize: 9, marginBottom: 8 }}>May 2026 · Prepared by {brandDraft.name || "your agency"}</div>
              <div style={{ background: brandDraft.color + "22", border: `1px solid ${brandDraft.color}44`, borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ color: T.muted, fontSize: 8, marginBottom: 2 }}>Meetings booked</div>
                <div style={{ color: brandDraft.color, fontSize: 20, fontWeight: 900, lineHeight: 1 }}>12</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={card}>
        <div style={sectionTitle}>LinkedIn account</div>
        <div style={sectionSub}>Your connected LinkedIn profile used for outreach campaigns</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, background: "#0077b5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 18, flexShrink: 0 }}>in</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.text, fontWeight: 600, fontSize: 14 }}>Alex Johnson</div>
            <div style={{ color: T.muted, fontSize: 12 }}>alex.johnson@gmail.com · Connected via OAuth</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
            <span style={{ color: T.green, fontSize: 12, fontWeight: 600 }}>Active</span>
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[["Daily limit", settings.dailyLimit + " actions"], ["This week", "94 sent"], ["Account health", "Good ✓"]].map(([l, v]) => (
            <div key={l} style={{ background: T.surface, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ color: T.muted, fontSize: 10, marginBottom: 2 }}>{l}</div>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <button style={{ marginTop: "0.875rem", background: "transparent", color: T.red, border: `1px solid ${T.red}44`, borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12 }}>Disconnect account</button>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Email account</div>
        <div style={sectionSub}>Connect an inbox to send email outreach alongside LinkedIn campaigns</div>
        {!settings.emailConnected ? (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
              {[["Google", "🔵", "#4285f4"], ["Outlook", "🔷", "#0078d4"], ["Other SMTP", "✉️", T.muted]].map(([name, ico]) => (
                <button key={name} onClick={() => name !== "Other SMTP" && set({ emailConnected: true })} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "0.875rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 22 }}>{ico}</span>
                  <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{name}</span>
                </button>
              ))}
            </div>
            <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 8, padding: "10px 12px", color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
              <span style={{ color: T.accent }}>Why connect email?</span> LinkedIn limits ~20 actions/day. Email lets you reach the same prospects on a second channel, typically doubling reply rate.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem", background: T.surface, borderRadius: 9, padding: "0.875rem" }}>
              <span style={{ fontSize: 20 }}>🔵</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>Google Workspace connected</div>
                <div style={{ color: T.muted, fontSize: 12 }}>{(settings.fromName || "you").toLowerCase().replace(" ", ".")}@youragency.com</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
                <span style={{ color: T.green, fontSize: 12, fontWeight: 600 }}>Connected</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>From name</label>
                <input style={inp} value={settings.fromName} onChange={e => set({ fromName: e.target.value })} />
              </div>
              <div>
                <label style={label}>Reply-to email</label>
                <input style={inp} placeholder="replies@youragency.com" value={settings.replyTo} onChange={e => set({ replyTo: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Email signature</label>
              <textarea rows={3} style={{ ...inp, resize: "vertical" }} value={settings.signature} onChange={e => set({ signature: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={sectionTitle}>Sending limits</div>
        <div style={sectionSub}>Controls how aggressively ReachFlow operates. Lower = safer for your LinkedIn account.</div>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ ...label, margin: 0 }}>Daily LinkedIn actions</label>
            <span style={{ color: T.accent, fontSize: 14, fontWeight: 800 }}>{settings.dailyLimit}</span>
          </div>
          <input type="range" min={5} max={80} step={5} value={settings.dailyLimit} onChange={e => set({ dailyLimit: Number(e.target.value) })} style={{ width: "100%", accentColor: T.accent }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: T.muted, fontSize: 11, marginTop: 4 }}>
            <span>5 — very safe</span><span>40 — recommended</span><span>80 — aggressive</span>
          </div>
          {settings.dailyLimit > 50 && <div style={{ marginTop: 8, background: T.yellow + "22", border: `1px solid ${T.yellow}44`, borderRadius: 6, padding: "7px 10px", color: T.yellow, fontSize: 12 }}>⚠ Above 50/day increases LinkedIn restriction risk. We recommend staying under 40.</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: T.muted, fontSize: 12 }}>Random delays between actions: <span style={{ color: T.text }}>enabled</span></div>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: T.accent, display: "flex", alignItems: "center", padding: "0 3px", justifyContent: "flex-end", cursor: "pointer" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#0d1117" }} />
          </div>
        </div>
      </div>

      {/* ── Send Windows ── */}
      <div style={card}>
        <div style={sectionTitle}>Smart send timing</div>
        <div style={sectionSub}>Set the windows when your prospects are most likely to read and reply. ReachFlow schedules all outreach within these hours automatically.</div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={label}>Industry preset</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { id: "saas",       label: "SaaS / Tech",    windows: "Tue–Thu, 8–10am & 1–3pm", note: "Avoid Mon mornings and Fri afternoons" },
              { id: "finance",    label: "Finance / FS",   windows: "Mon–Wed, 7–9am & 12–1pm", note: "Early birds — catch them before markets open" },
              { id: "recruiting", label: "Recruiting",     windows: "Mon–Thu, 9–11am & 3–4pm", note: "Mid-morning has highest candidate response" },
            ].map(p => {
              const active = settings.timingPreset === p.id;
              return (
                <div key={p.id} onClick={() => set({ timingPreset: p.id })}
                  style={{ background: active ? T.accentBg : T.surface, border: `1.5px solid ${active ? T.accent : T.border}`, borderRadius: 9, padding: "0.875rem", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ color: active ? T.accent : T.text, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
                  <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5, marginBottom: 4 }}>{p.windows}</div>
                  <div style={{ color: T.faint, fontSize: 10, lineHeight: 1.4 }}>{p.note}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={label}>Active send days</label>
          <div style={{ display: "flex", gap: 6 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
              const days = settings.sendDays || [1,2,3,4];
              const on = days.includes(i);
              return (
                <button key={day} onClick={() => set({ sendDays: on ? days.filter(d => d !== i) : [...days, i].sort() })}
                  style={{ flex: 1, background: on ? T.accentBg : T.surface, color: on ? T.accent : T.muted, border: `1.5px solid ${on ? T.accent : T.border}`, borderRadius: 7, padding: "8px 4px", cursor: "pointer", fontSize: 12, fontWeight: on ? 700 : 400 }}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" }}>
          <div>
            <label style={label}>Send window start</label>
            <select style={{ ...inp, cursor: "pointer" }} value={settings.sendStart || "08:00"} onChange={e => set({ sendStart: e.target.value })}>
              {["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Send window end</label>
            <select style={{ ...inp, cursor: "pointer" }} value={settings.sendEnd || "17:00"} onChange={e => set({ sendEnd: e.target.value })}>
              {["13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10 }}>
          <span style={{ color: T.accent, fontSize: 14 }}>💡</span>
          <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
            <strong style={{ color: T.text }}>Timezone-aware:</strong> ReachFlow detects each prospect's timezone from their LinkedIn location and sends within your window in <em>their</em> local time — so an 8am message lands at 8am whether they're in New York or Berlin.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} style={{ background: saved ? T.green : T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "background 0.2s" }}>
          {saved ? "✓ Saved" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ─── SOCIAL MEDIA ─────────────────────────────────────────────────────────────
const SOCIAL_FEEDS = {
  linkedin: [
    { id: 1, author: "Sarah Chen", handle: "VP Engineering @ Stripe", avatar: "SC", col: "#58a6ff", time: "2h ago", content: "Just shipped our new API rate limiting system — took 3 months but the performance gains are wild. 40% reduction in p99 latency. Happy to share what we learned.", likes: 284, comments: 47, signal: "high" },
    { id: 2, author: "Marcus Williams", handle: "CTO @ Notion", avatar: "MW", col: "#2dce98", time: "5h ago", content: "We're hiring 3 senior engineers to help us scale our collaboration infrastructure. If you know anyone who loves hard distributed systems problems, send them my way.", likes: 156, comments: 31, signal: "medium" },
    { id: 3, author: "Priya Patel", handle: "Head of Growth @ Figma", avatar: "PP", col: "#bc8cff", time: "1d ago", content: "Fascinating data from our PLG analysis: users who invite 3+ teammates in week 1 have 4x higher 6-month retention. The aha moment is genuinely social.", likes: 412, comments: 89, signal: "low" },
    { id: 4, author: "Carlos Rivera", handle: "CPO @ Deel", avatar: "CR", col: "#d29922", time: "1d ago", content: "Just got back from SaaStr. The conversation everyone was having: how do you maintain culture and velocity when you're scaling from 200 to 2000 people? No easy answers.", likes: 203, comments: 44, signal: "high" },
    { id: 5, author: "Elena Kozlov", handle: "Founder & CEO @ Linear", avatar: "EK", col: "#f85149", time: "2d ago", content: "3 years of building Linear and the thing I underestimated most: how much of your job as CEO is really just editing — the product, the team, the story you tell.", likes: 891, comments: 167, signal: "high" },
  ],
  twitter: [
    { id: 6, author: "David Kim", handle: "@dkim_product", avatar: "DK", col: "#58a6ff", time: "1h ago", content: "Hot take: most 'data-driven' decisions are actually HiPPO-driven decisions with a spreadsheet attached. Change my mind.", likes: 847, comments: 203, signal: "medium" },
    { id: 7, author: "Amy Thornton", handle: "@amytVP", avatar: "AT", col: "#2dce98", time: "3h ago", content: "If your outbound motion relies on 100+ touchpoints per rep per day you don't have a sales process you have a spam cannon. Quality > quantity every time.", likes: 1243, comments: 89, signal: "high" },
    { id: 8, author: "Raj Mehta", handle: "@rajmehta_pm", avatar: "RM", col: "#d29922", time: "6h ago", content: "Just tried 4 different outreach tools this week. The UX gap between the best and worst is genuinely shocking. Some of these things feel like they were designed in 2009.", likes: 334, comments: 71, signal: "high" },
  ],
};

const SIGNAL_STYLES = {
  high:   { bg: T.accentBg,           col: T.accent, label: "High signal" },
  medium: { bg: T.yellow + "22",      col: T.yellow, label: "Medium" },
  low:    { bg: T.faint + "44",       col: T.muted,  label: "Low signal" },
};

function SocialMedia() {
  const [platform, setPlatform] = useState("linkedin");
  const [filter,   setFilter]   = useState("all");
  const [composed, setComposed] = useState(null);
  const [draftMsg, setDraftMsg] = useState("");
  const [drafting, setDrafting] = useState(false);

  const posts = SOCIAL_FEEDS[platform] || [];
  const filtered = filter === "all" ? posts : posts.filter(p => p.signal === filter);

  const draftReply = async (post) => {
    setComposed(post.id);
    setDrafting(true);
    const prompt = `Draft a short, natural reply to this social media post that starts a genuine conversation. 1-2 sentences. Not salesy. Sound like a smart peer, not a vendor.

Post by ${post.author} (${post.handle}): "${post.content}"

Reply only with the message text, nothing else.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setDraftMsg(data.content?.find(b => b.type === "text")?.text || "");
    } catch { setDraftMsg(""); }
    setDrafting(false);
  };

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Social Listening</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Spot engagement signals from your leads before reaching out</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["linkedin", "in", "#0077b5"], ["twitter", "𝕏", "#1a1a2e"]].map(([id, icon, col]) => (
            <button key={id} onClick={() => { setPlatform(id); setComposed(null); }}
              style={{ background: platform === id ? col : T.card, color: platform === id ? "#fff" : T.muted, border: `1px solid ${platform === id ? col : T.border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{icon}</span>{id === "linkedin" ? "LinkedIn" : "Twitter/X"}
            </button>
          ))}
        </div>
      </div>

      {/* Signal filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
        {[["all", "All posts"], ["high", "🔥 High signal"], ["medium", "— Medium"], ["low", "Low signal"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ background: filter === id ? T.accentBg : "transparent", color: filter === id ? T.accent : T.muted, border: `1px solid ${filter === id ? T.accent : T.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: filter === id ? 700 : 400 }}>{label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
          <span style={{ color: T.muted, fontSize: 11 }}>Live feed</span>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        </div>
      </div>

      {/* What is a signal? */}
      <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1.25rem", display: "flex", gap: 10 }}>
        <span style={{ color: T.accent, fontSize: 14 }}>💡</span>
        <span style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}><strong style={{ color: T.accent }}>High signal</strong> posts mention pain points, hiring, tool evaluation, or frustration — ideal timing to reach out. <strong style={{ color: T.text }}>Engage first, pitch later.</strong></span>
      </div>

      {/* Posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(post => {
          const sig = SIGNAL_STYLES[post.signal];
          const isOpen = composed === post.id;
          return (
            <div key={post.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "1.125rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: "0.875rem" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: post.col + "22", color: post.col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{post.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{post.author}</span>
                      <span style={{ color: T.muted, fontSize: 12 }}>{post.handle}</span>
                      <span style={{ color: T.faint, fontSize: 11 }}>· {post.time}</span>
                      <span style={{ background: sig.bg, color: sig.col, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, marginLeft: "auto" }}>{sig.label}</span>
                    </div>
                  </div>
                </div>
                <div style={{ color: T.text, fontSize: 13, lineHeight: 1.7, marginBottom: "0.875rem" }}>{post.content}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: T.muted, fontSize: 12 }}>♥ {post.likes.toLocaleString()}</span>
                  <span style={{ color: T.muted, fontSize: 12 }}>💬 {post.comments}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button onClick={() => { setComposed(isOpen ? null : null); setDraftMsg(""); draftReply(post); }}
                      style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      ✦ Draft reply
                    </button>
                    <button style={{ background: T.surface, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>+ Add to leads</button>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "1rem 1.125rem", background: T.surface }}>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>AI-drafted reply</div>
                  {drafting ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", color: T.muted, fontSize: 13 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                      Drafting reply…
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                  ) : (
                    <>
                      <textarea rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6, marginBottom: 8 }} value={draftMsg} onChange={e => setDraftMsg(e.target.value)} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Post reply</button>
                        <button onClick={() => { setComposed(null); setDraftMsg(""); }} style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}>Discard</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3rem", textAlign: "center", color: T.muted }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>No posts match this filter</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FLOW BUILDER ─────────────────────────────────────────────────────────────
const TRIGGERS = [
  { id: "replied",       label: "Prospect replied",        color: T.accent },
  { id: "no_reply",      label: "No reply after X days",   color: T.yellow },
  { id: "connected",     label: "Connection accepted",     color: T.blue },
  { id: "not_connected", label: "Connection not accepted", color: T.red },
  { id: "email_opened",  label: "Email opened",            color: T.purple },
];

const DEFAULT_FLOW = [
  { id: 1, type: "message", channel: "linkedin", label: "Connection Request", delay: 0,
    content: "Hi {{first_name}}, I noticed {{company}} is scaling fast — I work with similar teams on pipeline building. Thought it'd be worth connecting." },
  { id: 2, type: "ab_split", splitPct: 50, label: "Test follow-up angle",
    a: [
      { id: 3, type: "message", channel: "linkedin", label: "Follow-up A — Problem angle", delay: 2,
        content: "Thanks for connecting, {{first_name}}. Quick question — is building a repeatable outbound motion something on your radar at {{company}}?" },
      { id: 4, type: "end", label: "Move to inbox", outcome: "replied" }
    ],
    b: [
      { id: 5, type: "message", channel: "linkedin", label: "Follow-up B — Social proof angle", delay: 2,
        content: "Great to connect, {{first_name}}! We helped a similar team at [company] book 3x more meetings in 60 days — curious if that's a challenge you're working on too?" },
      { id: 6, type: "end", label: "Move to inbox", outcome: "replied" }
    ],
    stats: { a: { sent: 180, replies: 32, meetings: 5 }, b: { sent: 180, replies: 47, meetings: 9 } }
  },
  { id: 7, type: "condition", trigger: "no_reply", delayDays: 5,
    yes: [
      { id: 8, type: "message", channel: "email", label: "Email fallback", delay: 0,
        content: "Hey {{first_name}}, following up from LinkedIn — happy to share a quick case study. Worth a look?" },
      { id: 9, type: "end", label: "End sequence", outcome: "no_reply" }
    ],
    no: [{ id: 10, type: "end", label: "End — already replied", outcome: "replied" }]
  },
];

const NODE_COLORS = {
  message:      { bg: T.accentBg,               border: T.accent,  icon: "✉",  iconBg: T.accent },
  condition:    { bg: "rgba(210,153,34,0.12)",   border: T.yellow,  icon: "◈",  iconBg: T.yellow },
  ab_split:     { bg: "rgba(188,140,255,0.10)",  border: T.purple,  icon: "⑃",  iconBg: T.purple },
  view_profile: { bg: "rgba(88,166,255,0.10)",   border: T.blue,    icon: "👤", iconBg: T.blue },
  like_post:    { bg: "rgba(248,81,73,0.10)",    border: T.red,     icon: "♥",  iconBg: T.red },
  comment_post: { bg: "rgba(210,153,34,0.10)",   border: T.yellow,  icon: "💬", iconBg: T.yellow },
  ai_convo:     { bg: "rgba(45,206,152,0.10)",   border: T.accent,  icon: "✦",  iconBg: T.accent },
  end:          { bg: T.faint + "44",            border: T.faint,   icon: "◼",  iconBg: T.muted },
};
const CH_COLOR = { linkedin: T.blue, email: T.purple };
const CH_LABEL = { linkedin: "LinkedIn", email: "Email" };

const SOCIAL_NODE_LABEL = {
  view_profile: "View Profile",
  like_post:    "Like Post",
  comment_post: "Comment on Post",
  ai_convo:     "AI Conversation",
};

let _nextId = 100;
const nextId = () => ++_nextId;

function FlowNode({ node, depth = 0, onEdit, selected, onSelect, showStats }) {
  const nc = NODE_COLORS[node.type] || NODE_COLORS.end;
  const isSelected = selected === node.id;

  if (node.type === "end") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 2, height: 20, background: T.border }} />
      <div onClick={() => onSelect(node.id)} style={{ background: isSelected ? T.faint : "transparent", border: `1.5px dashed ${T.faint}`, borderRadius: 8, padding: "7px 18px", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10 }}>◼</span>{node.label}
        {node.outcome === "replied"  && <span style={{ background: T.accentBg, color: T.accent, fontSize: 10, padding: "1px 6px", borderRadius: 3 }}>replied</span>}
        {node.outcome === "no_reply" && <span style={{ background: T.yellow + "22", color: T.yellow, fontSize: 10, padding: "1px 6px", borderRadius: 3 }}>no reply</span>}
      </div>
    </div>
  );

  // Social engagement nodes (view_profile, like_post, comment_post, ai_convo)
  if (["view_profile", "like_post", "comment_post", "ai_convo"].includes(node.type)) {
    const nc = NODE_COLORS[node.type];
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {depth > 0 && <div style={{ width: 2, height: 20, background: T.border }} />}
        <div onClick={() => { onSelect(node.id); onEdit(node); }}
          style={{ background: isSelected ? nc.bg : T.card, border: `1.5px solid ${isSelected ? nc.border : T.border}`, borderRadius: 12, padding: "0.875rem 1rem", width: 300, cursor: "pointer", transition: "all 0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: node.note ? 6 : 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: nc.iconBg + "22", color: nc.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{nc.icon}</div>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 600, flex: 1 }}>{SOCIAL_NODE_LABEL[node.type]}</span>
            <span style={{ background: T.blue + "22", color: T.blue, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>LinkedIn</span>
          </div>
          {node.note && <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.note}</div>}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5 }}>
            {node.delay > 0 && <span style={{ color: T.faint, fontSize: 11 }}>Day {node.delay}</span>}
            <span style={{ background: nc.bg, color: nc.iconBg, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3 }}>⏱ Smart timing</span>
          </div>
        </div>
      </div>
    );
  }
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {depth > 0 && <div style={{ width: 2, height: 20, background: T.border }} />}
      <div onClick={() => { onSelect(node.id); onEdit(node); }} style={{ background: isSelected ? nc.bg : T.card, border: `1.5px solid ${isSelected ? nc.border : T.border}`, borderRadius: 12, padding: "0.875rem 1rem", width: 300, cursor: "pointer", transition: "all 0.15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: nc.iconBg + "22", color: nc.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{nc.icon}</div>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{node.label}</span>
          <span style={{ background: CH_COLOR[node.channel] + "22", color: CH_COLOR[node.channel], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>{CH_LABEL[node.channel]}</span>
        </div>
        <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.55, fontStyle: "italic", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>"{node.content}"</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5 }}>
          {node.delay > 0 && <span style={{ color: T.faint, fontSize: 11 }}>Day {node.delay}</span>}
          <span style={{ background: T.accentBg, color: T.accent, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3 }}>⏱ Tue–Thu 9–12am</span>
        </div>
      </div>
    </div>
  );

  if (node.type === "ab_split") {
    const s = node.stats;
    const aRR = s ? Math.round(s.a.replies / s.a.sent * 100) : null;
    const bRR = s ? Math.round(s.b.replies / s.b.sent * 100) : null;
    const winner = aRR !== null ? (aRR > bRR ? "a" : bRR > aRR ? "b" : null) : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {depth > 0 && <div style={{ width: 2, height: 20, background: T.border }} />}
        {/* A/B split node */}
        <div onClick={() => { onSelect(node.id); onEdit(node); }} style={{ background: isSelected ? "rgba(188,140,255,0.18)" : "rgba(188,140,255,0.10)", border: `1.5px solid ${T.purple}`, borderRadius: 10, padding: "0.75rem 1.5rem", cursor: "pointer", minWidth: 280, textAlign: "center", transition: "all 0.15s" }}>
          <div style={{ color: T.purple, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>A/B Test</div>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{node.label}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <span style={{ background: T.blue + "22", color: T.blue, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 4 }}>A · {node.splitPct}%</span>
            <span style={{ background: T.purple + "22", color: T.purple, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 4 }}>B · {100 - node.splitPct}%</span>
          </div>
        </div>

        {/* Branches */}
        <div style={{ display: "flex", gap: 32, marginTop: 0 }}>
          {/* A branch */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 320 }}>
            <div style={{ width: 2, height: 20, background: T.blue }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
              <div style={{ background: T.blue + "22", border: `1px solid ${T.blue}44`, borderRadius: 5, padding: "2px 10px", color: T.blue, fontSize: 11, fontWeight: 700 }}>Variant A</div>
              {showStats && s && <div style={{ background: winner === "a" ? T.accentBg : T.faint + "44", color: winner === "a" ? T.accent : T.muted, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{aRR}% reply {winner === "a" ? "🏆" : ""}</div>}
            </div>
            {(node.a || []).map(n => <FlowNode key={n.id} node={n} depth={depth + 1} onEdit={onEdit} selected={selected} onSelect={onSelect} showStats={showStats} />)}
          </div>
          {/* B branch */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 320 }}>
            <div style={{ width: 2, height: 20, background: T.purple }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
              <div style={{ background: T.purple + "22", border: `1px solid ${T.purple}44`, borderRadius: 5, padding: "2px 10px", color: T.purple, fontSize: 11, fontWeight: 700 }}>Variant B</div>
              {showStats && s && <div style={{ background: winner === "b" ? T.accentBg : T.faint + "44", color: winner === "b" ? T.accent : T.muted, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{bRR}% reply {winner === "b" ? "🏆" : ""}</div>}
            </div>
            {(node.b || []).map(n => <FlowNode key={n.id} node={n} depth={depth + 1} onEdit={onEdit} selected={selected} onSelect={onSelect} showStats={showStats} />)}
          </div>
        </div>
      </div>
    );
  }

  if (node.type === "condition") {
    const trigger = TRIGGERS.find(t => t.id === node.trigger);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {depth > 0 && <div style={{ width: 2, height: 20, background: T.border }} />}
        <div onClick={() => { onSelect(node.id); onEdit(node); }} style={{ background: isSelected ? "rgba(210,153,34,0.18)" : "rgba(210,153,34,0.08)", border: `1.5px solid ${T.yellow}`, borderRadius: 10, padding: "0.75rem 1.25rem", cursor: "pointer", minWidth: 240, textAlign: "center", transition: "all 0.15s" }}>
          <div style={{ color: T.yellow, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Check condition</div>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{trigger?.label || node.trigger}</div>
          {node.delayDays > 0 && <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>Wait {node.delayDays} day{node.delayDays !== 1 ? "s" : ""}</div>}
        </div>
        <div style={{ display: "flex", gap: 32, marginTop: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 300 }}>
            <div style={{ width: 2, height: 20, background: T.accent }} />
            <div style={{ background: T.accentBg, border: `1px solid ${T.accent}44`, borderRadius: 5, padding: "2px 10px", color: T.accent, fontSize: 11, fontWeight: 700 }}>✓ Yes</div>
            {(node.yes || []).map(n => <FlowNode key={n.id} node={n} depth={depth + 1} onEdit={onEdit} selected={selected} onSelect={onSelect} showStats={showStats} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200 }}>
            <div style={{ width: 2, height: 20, background: T.yellow }} />
            <div style={{ background: T.yellow + "22", border: `1px solid ${T.yellow}44`, borderRadius: 5, padding: "2px 10px", color: T.yellow, fontSize: 11, fontWeight: 700 }}>✗ No</div>
            {(node.no || []).map(n => <FlowNode key={n.id} node={n} depth={depth + 1} onEdit={onEdit} selected={selected} onSelect={onSelect} showStats={showStats} />)}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function FlowBuilder({ campaign, onClose, savedFlow, onSave }) {
  const [flow, setFlow] = useState(() => savedFlow || DEFAULT_FLOW);
  const [editNode, setEditNode] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("flow");
  const [winnerPicked, setWinnerPicked] = useState(null);

  const updateNode = (id, updates, nodes = flow) =>
    nodes.map(n => {
      if (n.id === id) return { ...n, ...updates };
      if (n.yes) return { ...n, yes: updateNode(id, updates, n.yes), no: updateNode(id, updates, n.no) };
      if (n.a)   return { ...n, a: updateNode(id, updates, n.a), b: updateNode(id, updates, n.b) };
      return n;
    });

  const addNode = (type) => {
    const id = nextId();
    let node;
    if (type === "message")      node = { id, type: "message",      channel: "linkedin", label: "New message",        delay: 1, content: "Hi {{first_name}}, " };
    if (type === "condition")    node = { id, type: "condition",     trigger: "replied",  delayDays: 2, yes: [{ id: nextId(), type: "end", label: "End", outcome: "replied" }], no: [{ id: nextId(), type: "end", label: "End", outcome: "no_reply" }] };
    if (type === "ab_split")     node = { id, type: "ab_split",      label: "New A/B test", splitPct: 50, a: [{ id: nextId(), type: "message", channel: "linkedin", label: "Variant A", delay: 1, content: "Hi {{first_name}}, [Variant A]" }, { id: nextId(), type: "end", label: "End", outcome: "replied" }], b: [{ id: nextId(), type: "message", channel: "linkedin", label: "Variant B", delay: 1, content: "Hi {{first_name}}, [Variant B]" }, { id: nextId(), type: "end", label: "End", outcome: "replied" }], stats: null };
    if (type === "view_profile")  node = { id, type: "view_profile",  delay: 0, note: "Visits prospect profile — signals interest" };
    if (type === "like_post")     node = { id, type: "like_post",     delay: 1, note: "Likes their most recent post" };
    if (type === "comment_post")  node = { id, type: "comment_post",  delay: 2, note: "", promptHint: "Write a genuine, insightful comment on their post. 1-2 sentences. No pitch." };
    if (type === "ai_convo")      node = { id, type: "ai_convo",      delay: 0, note: "AI manages conversation to book a meeting", goal: "book_meeting" };
    if (node) { setFlow(f => [...f, node]); setEditNode(node); setSelectedId(node.id); }
  };

  const handleSave = () => {
    const finalFlow = editNode ? updateNode(editNode.id, editNode) : flow;
    if (editNode) { setFlow(finalFlow); setEditNode(null); }
    if (onSave && campaign?.id) onSave(campaign.id, finalFlow);
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const inp = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

  const flowStr = JSON.stringify(flow);
  const msgCount  = (flowStr.match(/"type":"message"/g) || []).length;
  const condCount = (flowStr.match(/"type":"condition"/g) || []).length;
  const abCount   = (flowStr.match(/"type":"ab_split"/g) || []).length;

  // Extract A/B nodes for results tab
  const abNodes = [];
  const extractAB = nodes => nodes.forEach(n => { if (n.type === "ab_split") abNodes.push(n); if (n.yes) extractAB(n.yes); if (n.no) extractAB(n.no); if (n.a) { extractAB(n.a); extractAB(n.b); } });
  extractAB(flow);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 300, display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0.875rem 1.5rem", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>Flow Builder — {campaign?.name || "New Campaign"}</div>
          <div style={{ color: T.muted, fontSize: 11, marginTop: 1 }}>{msgCount} messages · {condCount} conditions · {abCount} A/B test{abCount !== 1 ? "s" : ""}</div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, background: T.card, borderRadius: 8, padding: 3 }}>
          {[["flow", "Flow"], ["results", "A/B Results"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? T.surface : "transparent", color: tab === id ? T.text : T.muted, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: tab === id ? 600 : 400 }}>{label}{id === "results" && abCount > 0 && <span style={{ background: T.purple + "33", color: T.purple, fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 3, marginLeft: 5 }}>{abCount}</span>}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {tab === "flow" && [
          ["+ Message",  "message",      T.accentBg,              T.accent],
          ["+ Condition","condition",    "rgba(210,153,34,0.12)", T.yellow],
          ["+ A/B Test", "ab_split",     "rgba(188,140,255,0.10)",T.purple],
          ["👤 View",    "view_profile", "rgba(88,166,255,0.10)", T.blue],
          ["♥ Like",     "like_post",    "rgba(248,81,73,0.10)",  T.red],
          ["💬 Comment", "comment_post", "rgba(210,153,34,0.10)", T.yellow],
          ["✦ AI Convo", "ai_convo",     T.accentBg,              T.accent],
        ].map(([lbl, type, bg, col]) => (
          <button key={type} onClick={() => addNode(type)}
            style={{ background: bg, color: col, border: `1px solid ${col}44`, borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
            {lbl}
          </button>
        ))}
        </div>
        <button onClick={handleSave} style={{ background: saved ? T.green : T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, minWidth: 80, transition: "background 0.2s" }}>
          {saved ? "✓ Saved" : "Save flow"}
        </button>
      </div>

      {tab === "flow" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Canvas */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "2rem", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 900 }}>
              <div style={{ background: T.accentBg, border: `1.5px solid ${T.accent}`, borderRadius: 100, padding: "6px 20px", color: T.accent, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em" }}>▶ START</div>
              {flow.map(node => <FlowNode key={node.id} node={node} depth={0} onEdit={setEditNode} selected={selectedId} onSelect={setSelectedId} showStats={false} />)}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width: 300, background: T.surface, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
            {editNode ? (
              <div style={{ padding: "1.25rem" }}>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: "1.25rem" }}>
                  {editNode.type === "ab_split" ? "Edit A/B test" : editNode.type === "condition" ? "Edit condition" : editNode.type === "end" ? "Edit end step" : SOCIAL_NODE_LABEL[editNode.type] ? `Edit: ${SOCIAL_NODE_LABEL[editNode.type]}` : "Edit message"}
                </div>

                {["view_profile","like_post","comment_post","ai_convo"].includes(editNode.type) && (<>
                  <div style={{ background: NODE_COLORS[editNode.type]?.bg, border: `1px solid ${NODE_COLORS[editNode.type]?.border}44`, borderRadius: 9, padding: "0.875rem", marginBottom: 12 }}>
                    <div style={{ color: NODE_COLORS[editNode.type]?.iconBg, fontSize: 22, marginBottom: 4 }}>{NODE_COLORS[editNode.type]?.icon}</div>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{SOCIAL_NODE_LABEL[editNode.type]}</div>
                    <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
                      {editNode.type === "view_profile"  && "Visits the prospect's LinkedIn profile. Creates a 'profile view' notification — they'll see your name before you reach out."}
                      {editNode.type === "like_post"     && "Likes their most recent LinkedIn post. Signals genuine interest and puts your name in their notifications."}
                      {editNode.type === "comment_post"  && "AI writes a genuine, contextual comment on their most recent post. The comment is based on what they actually wrote — not a generic response."}
                      {editNode.type === "ai_convo"      && "Once connected, AI manages the conversation — responding to replies, handling objections, and steering toward the goal you set."}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Send delay (days after previous step)</div>
                    <input type="number" min={0} max={30} style={inp} value={editNode.delay || 0} onChange={e => setEditNode(n => ({ ...n, delay: Number(e.target.value) }))} />
                  </div>
                  {editNode.type === "comment_post" && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Comment tone / instructions for AI</div>
                      <textarea rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                        placeholder="e.g. 'Ask a thoughtful question about their main point' or 'Share a relevant insight — keep it genuine, no pitch'"
                        value={editNode.promptHint || ""} onChange={e => setEditNode(n => ({ ...n, promptHint: e.target.value }))} />
                      <div style={{ color: T.faint, fontSize: 11, marginTop: 4 }}>The AI reads the actual post content and writes accordingly. This just guides the tone.</div>
                    </div>
                  )}
                  {editNode.type === "ai_convo" && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Conversation goal</div>
                      <select style={{ ...inp, cursor: "pointer" }} value={editNode.goal || "book_meeting"} onChange={e => setEditNode(n => ({ ...n, goal: e.target.value }))}>
                        <option value="book_meeting">Book a meeting / demo call</option>
                        <option value="get_referral">Get a referral to the right person</option>
                        <option value="nurture">Nurture for future opportunity</option>
                        <option value="qualify">Qualify the prospect</option>
                      </select>
                    </div>
                  )}
                </>)}

                {editNode.type === "message" && (<>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Label</div>
                    <input style={inp} value={editNode.label} onChange={e => setEditNode(n => ({ ...n, label: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Channel</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["linkedin", "email"].map(ch => (
                        <button key={ch} onClick={() => setEditNode(n => ({ ...n, channel: ch }))} style={{ flex: 1, background: editNode.channel === ch ? CH_COLOR[ch] + "22" : T.card, color: editNode.channel === ch ? CH_COLOR[ch] : T.muted, border: `1.5px solid ${editNode.channel === ch ? CH_COLOR[ch] : T.border}`, borderRadius: 7, padding: "7px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{CH_LABEL[ch]}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Send delay (days)</div>
                    <input type="number" min={0} max={30} style={inp} value={editNode.delay} onChange={e => setEditNode(n => ({ ...n, delay: Number(e.target.value) }))} />
                    {/* Smart timing hint */}
                    <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 6, padding: "7px 10px", marginTop: 6, display: "flex", gap: 7 }}>
                      <span style={{ color: T.accent, fontSize: 11, flexShrink: 0 }}>⏱</span>
                      <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5 }}>
                        <strong style={{ color: T.accent }}>Smart timing on.</strong> This message will send on day {editNode.delay} within <strong style={{ color: T.text }}>Tue–Thu, 9–12am</strong> in each prospect's timezone. Edit in Settings → Smart send timing.
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Message</div>
                    <textarea rows={6} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} value={editNode.content} onChange={e => setEditNode(n => ({ ...n, content: e.target.value }))} />
                    <div style={{ color: T.faint, fontSize: 11, marginTop: 4 }}>Variables: {"{{first_name}}"} {"{{company}}"}</div>
                  </div>
                </>)}

                {editNode.type === "ab_split" && (<>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Test label</div>
                    <input style={inp} value={editNode.label} onChange={e => setEditNode(n => ({ ...n, label: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Split</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: T.blue, fontSize: 11, fontWeight: 700 }}>A: {editNode.splitPct}%</span>
                        <span style={{ color: T.purple, fontSize: 11, fontWeight: 700 }}>B: {100 - editNode.splitPct}%</span>
                      </div>
                    </div>
                    <input type="range" min={10} max={90} step={10} value={editNode.splitPct} onChange={e => setEditNode(n => ({ ...n, splitPct: Number(e.target.value) }))} style={{ width: "100%", accentColor: T.purple }} />
                    <div style={{ display: "flex", justifyContent: "space-between", color: T.faint, fontSize: 10, marginTop: 2 }}>
                      <span>10/90</span><span>50/50</span><span>90/10</span>
                    </div>
                  </div>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0.875rem", fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                    <div style={{ color: T.purple, fontWeight: 700, marginBottom: 4 }}>How A/B testing works</div>
                    ReachFlow randomly assigns incoming leads to Variant A or B at the ratio you set. Both variants run simultaneously. Check the <strong style={{ color: T.text }}>A/B Results</strong> tab to see which is winning.
                  </div>
                </>)}

                {editNode.type === "condition" && (<>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Trigger</div>
                    <select style={{ ...inp, cursor: "pointer" }} value={editNode.trigger} onChange={e => setEditNode(n => ({ ...n, trigger: e.target.value }))}>
                      {TRIGGERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Check after (days)</div>
                    <input type="number" min={0} max={30} style={inp} value={editNode.delayDays} onChange={e => setEditNode(n => ({ ...n, delayDays: Number(e.target.value) }))} />
                  </div>
                </>)}

                <button onClick={() => { setFlow(updateNode(editNode.id, editNode)); setEditNode(null); setSaved(false); }} style={{ width: "100%", background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 700, marginTop: 8 }}>Apply changes</button>
                <button onClick={() => setEditNode(null)} style={{ width: "100%", background: "transparent", color: T.muted, border: "none", cursor: "pointer", fontSize: 12, marginTop: 8, padding: "6px" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ padding: "1.25rem" }}>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: "1rem" }}>Flow summary</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.5rem" }}>
                  {[["Messages", msgCount, T.accent], ["Conditions", condCount, T.yellow], ["A/B Tests", abCount, T.purple]].map(([l, v, c]) => (
                    <div key={l} style={{ background: T.card, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: T.muted, fontSize: 12 }}>{l}</span>
                      <span style={{ color: c, fontSize: 13, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 8, padding: "0.875rem", color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ color: T.accent, fontWeight: 700, marginBottom: 4 }}>Click any node to edit</div>
                  Use the buttons above to add messages, conditions, or A/B tests to the end of the flow.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "results" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>A/B Test Results</div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: "1.75rem" }}>Live results update as leads move through each variant. Pick a winner to route 100% of traffic to the best-performing message.</div>

            {abNodes.map(node => {
              const s = node.stats;
              if (!s) return (
                <div key={node.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.5rem", marginBottom: "1.25rem", textAlign: "center", color: T.muted, fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                  <div style={{ fontWeight: 600, color: T.text }}>{node.label}</div>
                  <div style={{ marginTop: 4 }}>No data yet — campaign is still warming up</div>
                </div>
              );
              const aRR = Math.round(s.a.replies / s.a.sent * 100);
              const bRR = Math.round(s.b.replies / s.b.sent * 100);
              const aMR = Math.round(s.a.meetings / s.a.sent * 100);
              const bMR = Math.round(s.b.meetings / s.b.sent * 100);
              const winner = aRR > bRR ? "a" : bRR > aRR ? "b" : null;
              const confidence = Math.abs(aRR - bRR) > 5 ? "High" : Math.abs(aRR - bRR) > 2 ? "Medium" : "Low";
              const confCol = confidence === "High" ? T.accent : confidence === "Medium" ? T.yellow : T.muted;

              return (
                <div key={node.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.5rem", marginBottom: "1.25rem" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ background: T.purple + "22", color: T.purple, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>A/B Test</span>
                        <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{node.label}</span>
                      </div>
                      <div style={{ color: T.muted, fontSize: 12 }}>{s.a.sent + s.b.sent} leads enrolled · {node.splitPct}/{100 - node.splitPct} split</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: T.muted, fontSize: 11 }}>Confidence:</span>
                      <span style={{ color: confCol, fontSize: 11, fontWeight: 700 }}>{confidence}</span>
                    </div>
                  </div>

                  {/* Side-by-side variant cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.25rem" }}>
                    {[
                      { key: "a", label: "Variant A", col: T.blue, data: s.a, rr: aRR, mr: aMR },
                      { key: "b", label: "Variant B", col: T.purple, data: s.b, rr: bRR, mr: bMR },
                    ].map(v => (
                      <div key={v.key} style={{ background: T.surface, border: `1.5px solid ${winner === v.key ? v.col : T.border}`, borderRadius: 10, padding: "1.125rem", position: "relative" }}>
                        {winner === v.key && (
                          <div style={{ position: "absolute", top: -1, right: 12, background: v.col, color: "#0d1117", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: "0 0 6px 6px" }}>WINNING 🏆</div>
                        )}
                        <div style={{ color: v.col, fontSize: 12, fontWeight: 700, marginBottom: "0.75rem" }}>{v.label}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {[["Sent", v.data.sent, T.text], ["Replies", v.data.replies, v.col], ["Reply rate", v.rr + "%", winner === v.key ? T.accent : T.text], ["Meetings", v.data.meetings, T.purple]].map(([l, val, c]) => (
                            <div key={l} style={{ background: T.card, borderRadius: 7, padding: "8px 10px" }}>
                              <div style={{ color: T.muted, fontSize: 10, marginBottom: 2 }}>{l}</div>
                              <div style={{ color: c, fontSize: 15, fontWeight: 800 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        {/* Visual reply rate bar */}
                        <div style={{ marginTop: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ color: T.muted, fontSize: 10 }}>Reply rate</span>
                            <span style={{ color: v.col, fontSize: 10, fontWeight: 700 }}>{v.rr}%</span>
                          </div>
                          <div style={{ background: T.faint, borderRadius: 3, height: 5 }}>
                            <div style={{ background: v.col, height: 5, borderRadius: 3, width: `${Math.min(v.rr * 3.5, 100)}%`, transition: "width 0.6s" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message previews */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.25rem" }}>
                    {[
                      { key: "a", col: T.blue, nodes: node.a },
                      { key: "b", col: T.purple, nodes: node.b },
                    ].map(v => {
                      const msgNode = v.nodes?.find(n => n.type === "message");
                      return msgNode ? (
                        <div key={v.key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Message {v.key.toUpperCase()}</div>
                          <div style={{ color: T.text, fontSize: 12, lineHeight: 1.6, fontStyle: "italic" }}>"{msgNode.content}"</div>
                        </div>
                      ) : null;
                    })}
                  </div>

                  {/* Pick winner CTA */}
                  {winnerPicked === node.id ? (
                    <div style={{ background: T.accentBg, border: `1px solid ${T.accent}44`, borderRadius: 9, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: T.accent, fontSize: 16 }}>✓</span>
                      <span style={{ color: T.accent, fontSize: 13, fontWeight: 600 }}>Variant {winner?.toUpperCase()} selected — all new leads will receive this message</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {winner && <button onClick={() => setWinnerPicked(node.id)} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Pick Variant {winner.toUpperCase()} as winner →</button>}
                      <button style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontSize: 12 }}>Keep testing</button>
                      {!winner && <span style={{ color: T.muted, fontSize: 12 }}>Results too close to call — keep running</span>}
                    </div>
                  )}
                </div>
              );
            })}

            {abNodes.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem 2rem", color: T.muted }}>
                <div style={{ fontSize: 36, marginBottom: "1rem" }}>⑃</div>
                <div style={{ color: T.text, fontWeight: 600, marginBottom: 6 }}>No A/B tests in this flow yet</div>
                <div style={{ fontSize: 13 }}>Go back to the Flow tab and click <strong style={{ color: T.purple }}>+ A/B Test</strong> to add one</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ─── TRIGGER WORD MONITOR ────────────────────────────────────────────────────
const DEMO_TRIGGERED = [
  { id: 1, name: "Jordan Price",    title: "VP Sales",       company: "Veritas",       keyword: "outreach tool",        post: "We've been evaluating outreach tools for Q3 and honestly the market is crowded. Most tools feel built for solo reps not teams. If anyone has recommendations drop them below 👇", time: "12m ago",  pipelineStage: "prospecting" },
  { id: 2, name: "Hannah Cole",     title: "Head of Growth", company: "Sprout",        keyword: "scaling outreach",     post: "We're scaling outreach at Sprout and the manual process is killing us. There has to be a better way to personalise at volume without it feeling like spam.", time: "43m ago",  pipelineStage: "prospecting" },
  { id: 3, name: "Dev Sharma",      title: "Founder",        company: "Kova Labs",     keyword: "LinkedIn automation",  post: "LinkedIn automation tools — are they worth it or a LinkedIn ban waiting to happen? Asking for a series A founder who really needs pipeline 😅", time: "1h ago",  pipelineStage: "prospecting" },
  { id: 4, name: "Tess Andersen",   title: "CRO",            company: "MerakiPay",     keyword: "SDR tool",             post: "We're evaluating SDR tools. Budget is there. What I actually want: something that doesn't make our reps sound like robots. Open to recs.", time: "2h ago",  pipelineStage: "prospecting" },
  { id: 5, name: "Marcus Obi",      title: "Founder & CEO",  company: "Qubit",         keyword: "outreach automation",  post: "Outreach automation is only as good as the personalisation layer. We tried 3 tools and they all fell down at the same place — making messages feel real.", time: "3h ago",  pipelineStage: "prospecting" },
  { id: 6, name: "Claire Forster",  title: "Sales Director", company: "Lumio",         keyword: "LinkedIn outreach",    post: "Our LinkedIn outreach reply rates dropped from 12% to 4% in 6 months. Not sure if it's message fatigue, bad targeting, or our copy. Probably all three.", time: "4h ago",  pipelineStage: "prospecting" },
];

function TriggerMonitor({ leads, setLeads, logActivity }) {
  const [keywords, setKeywords]       = useLocalStorage("rf_triggers", ["outreach tool", "scaling outreach", "SDR tool", "LinkedIn automation", "outreach automation"]);
  const [newKeyword, setNewKeyword]   = useState("");
  const [filterKw, setFilterKw]       = useState("all");
  const [added, setAdded]             = useState(new Set());
  const [toast, setToast]             = useState(null);

  const filtered = filterKw === "all" ? DEMO_TRIGGERED : DEMO_TRIGGERED.filter(t => t.keyword === filterKw);

  const addKeyword = () => {
    if (!newKeyword.trim() || keywords.includes(newKeyword.trim())) return;
    setKeywords(ks => [...ks, newKeyword.trim()]);
    setNewKeyword("");
  };

  const removeKeyword = (kw) => setKeywords(ks => ks.filter(k => k !== kw));

  const addToSequence = (trigger) => {
    const newLead = {
      id: Date.now(), name: trigger.name, title: trigger.title, company: trigger.company,
      initials: trigger.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(),
      color: ["#58a6ff","#2dce98","#bc8cff","#d29922","#f85149"][trigger.id % 5],
      clientColor: "#2dce98", campaign: "Trigger: " + trigger.keyword, client: "",
      pipelineStage: "prospecting", days: 0, status: "pending", unread: false,
      last: "Just now", messages: [], triggerKeyword: trigger.keyword, triggerPost: trigger.post,
    };
    setLeads(ls => [...ls, newLead]);
    setAdded(s => new Set([...s, trigger.id]));
    if (logActivity) logActivity("import", `Trigger lead added: ${trigger.name} (keyword: "${trigger.keyword}")`, { name: trigger.name });
    setToast(`✓ ${trigger.name} added to warming sequence`);
    setTimeout(() => setToast(null), 2500);
  };

  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" };

  const highlightKeyword = (text, keyword) => {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return text;
    return (
      <span>
        {text.slice(0, idx)}
        <mark style={{ background: T.yellow + "44", color: T.text, borderRadius: 2 }}>{text.slice(idx, idx + keyword.length)}</mark>
        {text.slice(idx + keyword.length)}
      </span>
    );
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: T.card, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "12px 18px", color: T.accent, fontSize: 13, fontWeight: 600, zIndex: 200 }}>{toast}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Trigger Monitor</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>People posting your keywords right now — reach them at the exact moment they're feeling the pain</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
          <span style={{ color: T.muted, fontSize: 12 }}>Live monitoring</span>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Left: keyword manager */}
        <div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: "1rem" }}>Trigger keywords</div>
            <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
              <input style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: 12 }}
                placeholder="Add keyword or phrase…"
                value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()} />
              <button onClick={addKeyword} disabled={!newKeyword.trim()} style={{ background: newKeyword.trim() ? T.accent : T.faint, color: newKeyword.trim() ? "#0d1117" : T.muted, border: "none", borderRadius: 7, padding: "8px 12px", cursor: newKeyword.trim() ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>+</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {keywords.map(kw => (
                <div key={kw} style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, borderRadius: 7, padding: "7px 10px", border: `1px solid ${filterKw === kw ? T.accent : T.border}`, cursor: "pointer" }} onClick={() => setFilterKw(filterKw === kw ? "all" : kw)}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: T.text, fontSize: 12 }}>{kw}</span>
                  <span style={{ color: T.accent, fontSize: 11, fontWeight: 700 }}>{DEMO_TRIGGERED.filter(t => t.keyword === kw).length}</span>
                  <button onClick={e => { e.stopPropagation(); removeKeyword(kw); }} style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            {filterKw !== "all" && (
              <button onClick={() => setFilterKw("all")} style={{ width: "100%", background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px", cursor: "pointer", fontSize: 12, marginTop: 8 }}>Show all keywords</button>
            )}
          </div>

          <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "0.875rem" }}>
            <div style={{ color: T.accent, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>💡 Best keywords</div>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
              Use pain points and transition phrases, not product categories. <br /><br />
              <strong style={{ color: T.text }}>High intent:</strong> "looking for a tool", "we're scaling", "any recommendations", "frustrated with"<br /><br />
              <strong style={{ color: T.text }}>Lower intent:</strong> "LinkedIn", "outreach", "sales" (too broad)
            </div>
          </div>
        </div>

        {/* Right: triggered leads feed */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <div style={{ color: T.muted, fontSize: 12 }}>{filtered.length} people posting your keywords {filterKw !== "all" ? `matching "${filterKw}"` : "today"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(trigger => (
              <div key={trigger.id} style={{ background: T.card, border: `1px solid ${added.has(trigger.id) ? T.accent + "44" : T.border}`, borderRadius: 12, padding: "1.125rem", opacity: added.has(trigger.id) ? 0.7 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: "0.875rem" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: ["#58a6ff","#2dce98","#bc8cff","#d29922","#f85149"][trigger.id % 5] + "22", color: ["#58a6ff","#2dce98","#bc8cff","#d29922","#f85149"][trigger.id % 5], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {trigger.name.split(" ").map(w => w[0]).join("")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{trigger.name}</span>
                      <span style={{ color: T.muted, fontSize: 12 }}>{trigger.title} · {trigger.company}</span>
                      <span style={{ color: T.faint, fontSize: 11, marginLeft: "auto" }}>{trigger.time}</span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ background: T.yellow + "22", color: T.yellow, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>"{trigger.keyword}"</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0.75rem 0.875rem", marginBottom: "0.875rem", color: T.muted, fontSize: 13, lineHeight: 1.65 }}>
                  {highlightKeyword(trigger.post, trigger.keyword)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {added.has(trigger.id) ? (
                    <span style={{ background: T.accentBg, color: T.accent, fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 7 }}>✓ Added to warming sequence</span>
                  ) : (
                    <>
                      <button onClick={() => addToSequence(trigger)} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add to warming sequence</button>
                      <button style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}>View profile</button>
                      <button style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 12 }}>Dismiss</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEO REVIEWER ─────────────────────────────────────────────────────────────
const SEO_PLATFORMS = [
  {
    id: "linkedin_post",
    label: "LinkedIn Post",
    icon: "in",
    iconBg: "#0077b5",
    desc: "Optimise for engagement and reach on LinkedIn",
    criteria: [
      { key: "hook",       label: "Hook (first line)",       weight: 25, tip: "First line must stop the scroll. Should create curiosity, make a bold claim, or ask a provocative question." },
      { key: "length",     label: "Length",                   weight: 15, tip: "Sweet spot: 1,200–1,700 characters. Long enough to provide value, short enough to read in 60 seconds." },
      { key: "formatting", label: "Formatting & readability", weight: 20, tip: "Short paragraphs (1–2 lines max), line breaks between ideas, no walls of text." },
      { key: "hashtags",   label: "Hashtags",                 weight: 10, tip: "3–5 relevant hashtags at the end. More than 5 looks spammy." },
      { key: "cta",        label: "Call to action",           weight: 15, tip: "End with a clear, low-friction ask: a question, 'comment below', 'save this for later'." },
      { key: "voice",      label: "Personal voice",           weight: 15, tip: "Reads like a human wrote it — opinion, story, or personal experience. Avoids corporate language." },
    ]
  },
  {
    id: "website_blog",
    label: "Website / Blog",
    icon: "🌐",
    iconBg: "#3b82f6",
    desc: "Optimise for Google search ranking and readability",
    criteria: [
      { key: "title",       label: "Title / H1",              weight: 20, tip: "Primary keyword in the title. Under 60 characters. Compelling to click." },
      { key: "structure",   label: "Heading structure",       weight: 20, tip: "Clear H1 → H2 → H3 hierarchy. Every section has a subheading. Scannable without reading." },
      { key: "keywords",    label: "Keyword usage",           weight: 25, tip: "Primary keyword in H1, first paragraph, at least 2 subheadings, and final paragraph. Density 1–2%." },
      { key: "readability", label: "Readability",             weight: 20, tip: "Flesch-Kincaid grade 8 or below. Short sentences (under 20 words). Active voice." },
      { key: "meta",        label: "Meta description",        weight: 15, tip: "150–160 characters, includes primary keyword, has a clear benefit or hook." },
    ]
  },
  {
    id: "email_subject",
    label: "Email Subject",
    icon: "✉",
    iconBg: "#10b981",
    desc: "Maximise open rate and avoid spam filters",
    criteria: [
      { key: "length",       label: "Subject line length",    weight: 25, tip: "35–50 characters (visible on mobile). Under 9 words." },
      { key: "spam",         label: "No spam trigger words",  weight: 25, tip: "Avoid: FREE, GUARANTEED, EARN MONEY, !!!!, ALL CAPS, and excessive punctuation." },
      { key: "personalise",  label: "Personalisation",        weight: 20, tip: "{{first_name}} or company reference in subject line lifts open rates by 15–20%." },
      { key: "curiosity",    label: "Curiosity / specificity",weight: 20, tip: "Vague subject lines get ignored. Specific ones — 'Your reply rate dropped 4% last week' — get opened." },
      { key: "preview",      label: "Preview text alignment", weight: 10, tip: "First sentence of the email should complement the subject line, not repeat it." },
    ]
  },
  {
    id: "twitter",
    label: "Twitter / X",
    icon: "𝕏",
    iconBg: "#1a1a2e",
    desc: "Optimise for engagement and retweet potential",
    criteria: [
      { key: "length",    label: "Character count",    weight: 20, tip: "Under 240 chars leaves room for retweets with comment. Under 120 is ideal for standalone posts." },
      { key: "hook",      label: "Opening hook",       weight: 30, tip: "First 5 words have to earn the read. Statement, question, or number." },
      { key: "hashtags",  label: "Hashtag usage",      weight: 15, tip: "1–2 hashtags maximum. More than 2 tanks engagement algorithmically." },
      { key: "cta",       label: "Engagement hook",    weight: 20, tip: "Ask a question, propose a debate, or share a hot take. Something that demands a reply." },
      { key: "thread",    label: "Thread potential",   weight: 15, tip: "If it's longer than 280 chars, is it better as a thread? First tweet is the hook, rest builds the case." },
    ]
  },
  {
    id: "fb_ad",
    label: "Facebook / Instagram Ad",
    icon: "📱",
    iconBg: "#4267b2",
    desc: "Optimise for click-through and conversion",
    criteria: [
      { key: "hook",      label: "First 3 words",     weight: 25, tip: "Stop the scroll in the feed. 'You're losing money', 'Stop doing this', 'Most [X] don't know...'." },
      { key: "pain",      label: "Pain point clarity", weight: 25, tip: "Name the exact problem your audience has. The more specific, the higher the relevance score." },
      { key: "proof",     label: "Social proof",       weight: 20, tip: "Number, testimonial, or result. '2,400 agencies use this' or 'From 4% to 18% reply rate'." },
      { key: "cta",       label: "CTA strength",       weight: 20, tip: "One clear action. Not 'Learn more' — 'Get the free guide', 'Start your trial', 'See how it works'." },
      { key: "length",    label: "Copy length",        weight: 10, tip: "Feed ads: 40–80 words. Story ads: under 20 words. Mobile-first means ruthless editing." },
    ]
  },
  {
    id: "google_ad",
    label: "Google Ad",
    icon: "G",
    iconBg: "#4285f4",
    desc: "Maximise Quality Score and CTR for search ads",
    criteria: [
      { key: "headlines", label: "Headline quality",     weight: 30, tip: "3 headlines × 30 chars each. Keyword in Headline 1. Benefit in Headline 2. CTA in Headline 3." },
      { key: "keywords",  label: "Keyword inclusion",    weight: 25, tip: "Primary search keyword in at least one headline and in the description." },
      { key: "desc",      label: "Description lines",    weight: 25, tip: "2 descriptions × 90 chars. Expand on the headline benefit. Include a CTA and a unique selling point." },
      { key: "match",     label: "Search intent match",  weight: 20, tip: "Does the copy answer exactly what the user searched? 'Best LinkedIn outreach tool' needs 'best' framing." },
    ]
  },
];

function SEOReviewer() {
  const [platform, setPlatform] = useState("linkedin_post");
  const [copy, setCopy]         = useState("");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewrite, setRewrite]   = useState("");

  const plat = SEO_PLATFORMS.find(p => p.id === platform);

  const analyse = async () => {
    if (!copy.trim()) return;
    setLoading(true); setResult(null); setRewrite("");
    const criteriaList = plat.criteria.map(c => `- ${c.label}: ${c.tip}`).join("\n");
    const prompt = `You are an expert copywriter and SEO analyst. Analyse this ${plat.label} copy and score it.

Platform: ${plat.label}
Copy to analyse:
"""
${copy}
"""

Scoring criteria:
${criteriaList}

Respond with ONLY valid JSON — no markdown, no explanation:
{
  "overallScore": <0-100>,
  "summary": "<2-sentence overall verdict>",
  "scores": {
    ${plat.criteria.map(c => `"${c.key}": { "score": <0-100>, "verdict": "<1 sentence specific to this copy>", "fix": "<concrete actionable fix if score < 80, else empty string>" }`).join(",\n    ")}
  },
  "topIssue": "<the single most important thing to fix>",
  "rewriteAvailable": true
}`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (e) {
      setResult({ overallScore: 0, summary: "Analysis failed — check your connection.", scores: {}, topIssue: "" });
    }
    setLoading(false);
  };

  const getRewrite = async () => {
    if (!copy.trim()) return;
    setRewriting(true);
    const issues = result ? Object.entries(result.scores || {}).filter(([, v]) => v.score < 70).map(([k, v]) => `${k}: ${v.fix}`).join("; ") : "";
    const prompt = `Rewrite this ${plat.label} copy to fix the following issues: ${issues}

Original copy:
"""
${copy}
"""

Write only the improved version. Keep the same core message but fix every issue listed. Optimise specifically for ${plat.desc}.`;
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setRewrite(data.content?.find(b => b.type === "text")?.text || "");
    } catch {}
    setRewriting(false);
  };

  const scoreColor = (s) => s >= 80 ? T.accent : s >= 60 ? T.yellow : T.red;
  const scoreGrade = (s) => s >= 80 ? "Good" : s >= 60 ? "Fair" : "Needs work";
  const inp = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>SEO & Copy Reviewer</h1>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Platform-specific scoring and rewrite suggestions powered by AI</p>
      </div>

      {/* Platform selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {SEO_PLATFORMS.map(p => (
          <button key={p.id} onClick={() => { setPlatform(p.id); setResult(null); setRewrite(""); }}
            style={{ display: "flex", alignItems: "center", gap: 7, background: platform === p.id ? T.accentBg : T.card, color: platform === p.id ? T.accent : T.muted, border: `1.5px solid ${platform === p.id ? T.accent : T.border}`, borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: platform === p.id ? 700 : 400, transition: "all 0.15s" }}>
            <span style={{ width: 20, height: 20, borderRadius: 4, background: p.iconBg, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, flexShrink: 0 }}>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Left: input */}
        <div>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 8 }}>{plat?.desc}</div>
          <textarea
            rows={14}
            style={{ ...inp, resize: "vertical", lineHeight: 1.65, marginBottom: 10 }}
            placeholder={`Paste your ${plat?.label} copy here…`}
            value={copy} onChange={e => setCopy(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={analyse} disabled={!copy.trim() || loading}
              style={{ background: copy.trim() && !loading ? T.accent : T.faint, color: copy.trim() && !loading ? "#0d1117" : T.muted, border: "none", borderRadius: 8, padding: "10px 22px", cursor: copy.trim() && !loading ? "pointer" : "default", fontSize: 13, fontWeight: 700 }}>
              {loading ? "Analysing…" : "Analyse copy"}
            </button>
            {copy.trim() && <span style={{ color: T.faint, fontSize: 12 }}>{copy.length} chars</span>}
          </div>

          {/* Criteria preview */}
          <div style={{ marginTop: "1.25rem", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{plat?.label} scoring criteria</div>
            {plat?.criteria.map(c => (
              <div key={c.key} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                <span style={{ color: T.accent, flexShrink: 0, marginTop: 2, fontSize: 12 }}>·</span>
                <div>
                  <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                  <span style={{ color: T.faint, fontSize: 11 }}> ({c.weight}%)</span>
                  <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5, marginTop: 1 }}>{c.tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: results */}
        <div>
          {!result && !loading && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3rem", textAlign: "center", color: T.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>Paste your copy and hit Analyse</div>
              <div style={{ fontSize: 13 }}>Get a score for each criterion plus specific fixes</div>
            </div>
          )}

          {loading && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3rem", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: T.muted, fontSize: 13 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Reading your copy…
              </div>
            </div>
          )}

          {result && (
            <div>
              {/* Overall score */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
                    <svg width="72" height="72" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r="30" fill="none" stroke={T.faint} strokeWidth="6" />
                      <circle cx="36" cy="36" r="30" fill="none" stroke={scoreColor(result.overallScore)} strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 30 * result.overallScore / 100} ${2 * Math.PI * 30}`}
                        strokeLinecap="round" strokeDashoffset={2 * Math.PI * 30 * 0.25} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ color: scoreColor(result.overallScore), fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{result.overallScore}</div>
                      <div style={{ color: T.muted, fontSize: 9 }}>/100</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ background: scoreColor(result.overallScore) + "22", color: scoreColor(result.overallScore), fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>{scoreGrade(result.overallScore)}</span>
                      <span style={{ color: T.muted, fontSize: 11 }}>for {plat?.label}</span>
                    </div>
                    <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>{result.summary}</div>
                  </div>
                </div>

                {result.topIssue && (
                  <div style={{ background: T.red + "11", border: `1px solid ${T.red}33`, borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8 }}>
                    <span style={{ color: T.red, fontSize: 13, flexShrink: 0 }}>⚡</span>
                    <div><strong style={{ color: T.red, fontSize: 12 }}>Top priority fix:</strong> <span style={{ color: T.muted, fontSize: 12 }}>{result.topIssue}</span></div>
                  </div>
                )}
              </div>

              {/* Per-criterion breakdown */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: "1rem" }}>Score breakdown</div>
                {plat?.criteria.map(c => {
                  const s = result.scores?.[c.key];
                  if (!s) return null;
                  const col = scoreColor(s.score);
                  return (
                    <div key={c.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                        <span style={{ color: col, fontSize: 12, fontWeight: 700 }}>{s.score}/100</span>
                      </div>
                      <div style={{ background: T.faint, borderRadius: 3, height: 4, marginBottom: 5 }}>
                        <div style={{ background: col, height: 4, borderRadius: 3, width: `${s.score}%`, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5 }}>{s.verdict}</div>
                      {s.fix && <div style={{ color: col, fontSize: 11, marginTop: 3 }}>→ {s.fix}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Rewrite */}
              <div style={{ display: "flex", gap: 8 }}>
                {!rewrite ? (
                  <button onClick={getRewrite} disabled={rewriting}
                    style={{ flex: 1, background: rewriting ? T.faint : T.accentBg, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 8, padding: "10px", cursor: rewriting ? "default" : "pointer", fontSize: 13, fontWeight: 700 }}>
                    {rewriting ? "Rewriting…" : "✦ AI Rewrite — fix all issues"}
                  </button>
                ) : (
                  <button onClick={() => { setCopy(rewrite); setResult(null); setRewrite(""); }}
                    style={{ flex: 1, background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    ✓ Use rewrite — re-analyse
                  </button>
                )}
              </div>

              {rewrite && (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", marginTop: 10 }}>
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>AI rewrite</div>
                  <div style={{ color: T.text, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{rewrite}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REVIEW QUEUE ─────────────────────────────────────────────────────────────
const DEFAULT_QUEUE = [
  { id: 1, campaignId: 2, campaign: "Enterprise Decision Makers", client: "TechCorp Solutions", clientColor: "#58a6ff",
    leadName: "Raj Mehta", leadTitle: "VP of Product", leadCompany: "Intercom",
    type: "Connection Request", channel: "linkedin", scheduledFor: "Today 9:14am",
    message: "Hi Raj, I've been following Intercom's product evolution — the shift toward AI-first support is really well executed. I work with VP-level product leaders in SaaS on scaling their outbound pipeline without adding headcount. Would love to connect.", status: "pending" },
  { id: 2, campaignId: 2, campaign: "Enterprise Decision Makers", client: "TechCorp Solutions", clientColor: "#58a6ff",
    leadName: "Lena Fischer", leadTitle: "Head of Product", leadCompany: "Personio",
    type: "Connection Request", channel: "linkedin", scheduledFor: "Today 9:31am",
    message: "Hi Lena, your recent talk on product-led growth at Personio caught my eye — really sharp thinking on how PLG and sales-assisted motion can coexist. I help product leaders in HR-tech build their outbound pipeline. Worth connecting?", status: "pending" },
  { id: 3, campaignId: 2, campaign: "Enterprise Decision Makers", client: "TechCorp Solutions", clientColor: "#58a6ff",
    leadName: "Carlos Rivera", leadTitle: "CPO", leadCompany: "Deel",
    type: "Follow-up", channel: "linkedin", scheduledFor: "Today 10:05am",
    message: "Thanks for connecting, Carlos. Quick question — is building a repeatable outbound motion without burning your team out something that's on your radar at Deel right now?", status: "pending" },
  { id: 4, campaignId: 4, campaign: "Series B Targets", client: "Apex Ventures", clientColor: "#bc8cff",
    leadName: "Amy Thornton", leadTitle: "VP Product Management", leadCompany: "Pendo",
    type: "Connection Request", channel: "email", scheduledFor: "Today 11:00am",
    message: "Subject: Quick question about pipeline at Pendo\n\nHi Amy, I saw your recent post on product-led sales and it resonated. We help post-Series B product leaders build outbound without it feeling like a distraction from product work. Worth a 15-min chat?", status: "pending" },
  { id: 5, campaignId: 2, campaign: "Enterprise Decision Makers", client: "TechCorp Solutions", clientColor: "#58a6ff",
    leadName: "Simone Dubois", leadTitle: "Director of Product", leadCompany: "Contentsquare",
    type: "Value Add", channel: "linkedin", scheduledFor: "Today 2:15pm",
    message: "Simone, thought this case study might be useful given Contentsquare's scale — how a similar analytics-focused SaaS team went from 3% to 14% reply rate by tightening their ICP definition. Happy to share the full breakdown if useful?", status: "pending" },
];

function ReviewQueue({ campaigns, onToggleReviewMode, logActivity }) {
  const [queue, setQueue]         = useLocalStorage("rf_review_queue", DEFAULT_QUEUE);
  const [selectedId, setSelectedId] = useState(queue[0]?.id || null);
  const [editMsg, setEditMsg]     = useState("");
  const [editing, setEditing]     = useState(false);
  const [filterClient, setFilterClient] = useState("all");
  const [toast, setToast]         = useState(null);

  const reviewCampaigns = campaigns.filter(c => c.reviewMode);
  const pendingCount    = queue.filter(q => q.status === "pending").length;
  const selected        = queue.find(q => q.id === selectedId);
  const filtered        = filterClient === "all" ? queue : queue.filter(q => q.client === filterClient);
  const clients         = [...new Set(queue.map(q => q.client))];

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const approve = (id) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, status: "approved" } : item));
    if (logActivity) logActivity("reply", `Message approved for ${queue.find(i => i.id === id)?.leadName}`, {});
    showToast("✓ Message approved — will send at scheduled time");
    const next = queue.find(q => q.status === "pending" && q.id !== id);
    if (next) setSelectedId(next.id);
  };

  const approveEdit = (id) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, status: "approved", message: editMsg } : item));
    showToast("✓ Edited message approved");
    setEditing(false);
    const next = queue.find(q => q.status === "pending" && q.id !== id);
    if (next) setSelectedId(next.id);
  };

  const reject = (id) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, status: "rejected" } : item));
    showToast("Message rejected — skipped for this prospect");
    const next = queue.find(q => q.status === "pending" && q.id !== id);
    if (next) setSelectedId(next.id);
  };

  const approveAll = () => {
    setQueue(q => q.map(item => item.status === "pending" ? { ...item, status: "approved" } : item));
    showToast(`✓ All ${pendingCount} pending messages approved`);
  };

  const startEdit = () => { setEditMsg(selected?.message || ""); setEditing(true); };

  const STATUS_STYLE = {
    pending:  { bg: T.yellow + "22", col: T.yellow,  label: "Pending review" },
    approved: { bg: T.accentBg,      col: T.accent,  label: "Approved" },
    rejected: { bg: T.red + "18",    col: T.red,     label: "Rejected" },
  };

  const inp = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 1060 }}>
      {toast && <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: T.card, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "12px 18px", color: T.accent, fontSize: 13, fontWeight: 600, zIndex: 200 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: T.text, fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Review Queue</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
            {pendingCount > 0
              ? <span><span style={{ color: T.yellow, fontWeight: 700 }}>{pendingCount} messages</span> waiting for approval before they send</span>
              : "All messages reviewed — nothing pending"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {pendingCount > 0 && (
            <button onClick={approveAll} style={{ background: T.accent, color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              ✓ Approve all {pendingCount}
            </button>
          )}
        </div>
      </div>

      {/* Review mode status cards */}
      {reviewCampaigns.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.yellow}44`, borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
            <span style={{ color: T.yellow, fontSize: 14 }}>🔍</span>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>Review mode active on {reviewCampaigns.length} campaign{reviewCampaigns.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {reviewCampaigns.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>{c.name}</span>
                <span style={{ color: T.faint, fontSize: 11 }}>·</span>
                <span style={{ color: T.muted, fontSize: 11 }}>{c.client}</span>
                <button onClick={() => onToggleReviewMode(c.id)} style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", fontSize: 11, padding: 0 }}>Turn off</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {queue.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "4rem", textAlign: "center", color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
          <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>Queue is empty</div>
          <div style={{ fontSize: 13 }}>Enable review mode on a campaign to start reviewing messages before they send</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", alignItems: "start" }}>

          {/* Left: queue list */}
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: "0.875rem" }}>
              <button onClick={() => setFilterClient("all")} style={{ flex: 1, background: filterClient === "all" ? T.accentBg : "transparent", color: filterClient === "all" ? T.accent : T.muted, border: `1px solid ${filterClient === "all" ? T.accent : T.border}`, borderRadius: 6, padding: "5px", cursor: "pointer", fontSize: 11, fontWeight: filterClient === "all" ? 700 : 400 }}>All</button>
              {clients.map(c => (
                <button key={c} onClick={() => setFilterClient(c)} style={{ flex: 1, background: filterClient === c ? T.accentBg : "transparent", color: filterClient === c ? T.accent : T.muted, border: `1px solid ${filterClient === c ? T.accent : T.border}`, borderRadius: 6, padding: "5px", cursor: "pointer", fontSize: 10, fontWeight: filterClient === c ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.split(" ")[0]}</button>
              ))}
            </div>

            {filtered.map(item => {
              const ss = STATUS_STYLE[item.status];
              return (
                <div key={item.id} onClick={() => { setSelectedId(item.id); setEditing(false); }}
                  style={{ background: selectedId === item.id ? T.accentDim : T.card, border: `1px solid ${selectedId === item.id ? T.accent : T.border}`, borderRadius: 10, padding: "0.875rem", marginBottom: 8, cursor: "pointer", transition: "all 0.12s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{item.leadName}</div>
                    <span style={{ background: ss.bg, color: ss.col, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, flexShrink: 0 }}>{ss.label}</span>
                  </div>
                  <div style={{ color: T.muted, fontSize: 11, marginBottom: 4 }}>{item.leadTitle} · {item.leadCompany}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ background: item.clientColor + "22", color: item.clientColor, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3 }}>{item.client.split(" ")[0]}</span>
                    <span style={{ background: T.faint + "44", color: T.muted, fontSize: 10, padding: "2px 6px", borderRadius: 3 }}>{item.type}</span>
                    <span style={{ background: T.faint + "44", color: T.muted, fontSize: 10, padding: "2px 6px", borderRadius: 3 }}>{item.scheduledFor}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: message preview */}
          {selected && (
            <div>
              {/* Header */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: selected.clientColor + "22", color: selected.clientColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                        {selected.leadName.split(" ").map(w => w[0]).join("")}
                      </div>
                      <div>
                        <div style={{ color: T.text, fontSize: 15, fontWeight: 700 }}>{selected.leadName}</div>
                        <div style={{ color: T.muted, fontSize: 12 }}>{selected.leadTitle} · {selected.leadCompany}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ background: selected.clientColor + "22", color: selected.clientColor, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>{selected.client}</span>
                      <span style={{ background: T.faint + "44", color: T.muted, fontSize: 11, padding: "3px 8px", borderRadius: 4 }}>{selected.campaign}</span>
                      <span style={{ background: selected.channel === "linkedin" ? T.blue + "22" : T.purple + "22", color: selected.channel === "linkedin" ? T.blue : T.purple, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>{selected.channel === "linkedin" ? "LinkedIn" : "Email"}</span>
                      <span style={{ background: T.faint + "44", color: T.muted, fontSize: 11, padding: "3px 8px", borderRadius: 4 }}>📅 {selected.scheduledFor}</span>
                    </div>
                  </div>
                  <div style={{ background: STATUS_STYLE[selected.status].bg, color: STATUS_STYLE[selected.status].col, fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 6 }}>{STATUS_STYLE[selected.status].label}</div>
                </div>

                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                  {selected.type} · {selected.channel === "linkedin" ? "LinkedIn message" : "Email"}
                </div>

                {!editing ? (
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", color: T.text, fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                    {selected.message}
                  </div>
                ) : (
                  <textarea rows={6} style={{ ...inp, lineHeight: 1.75, resize: "vertical" }} value={editMsg} onChange={e => setEditMsg(e.target.value)} />
                )}
              </div>

              {/* Action buttons */}
              {selected.status === "pending" && (
                <div style={{ display: "flex", gap: 10 }}>
                  {!editing ? (
                    <>
                      <button onClick={() => approve(selected.id)} style={{ flex: 2, background: T.accent, color: "#0d1117", border: "none", borderRadius: 9, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>✓</span> Approve — send as written
                      </button>
                      <button onClick={startEdit} style={{ flex: 1, background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 9, padding: "12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        ✏ Edit first
                      </button>
                      <button onClick={() => reject(selected.id)} style={{ flex: 1, background: T.red + "18", color: T.red, border: `1px solid ${T.red}44`, borderRadius: 9, padding: "12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        ✕ Reject
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => approveEdit(selected.id)} disabled={!editMsg.trim()} style={{ flex: 2, background: editMsg.trim() ? T.accent : T.faint, color: editMsg.trim() ? "#0d1117" : T.muted, border: "none", borderRadius: 9, padding: "12px", cursor: editMsg.trim() ? "pointer" : "default", fontSize: 14, fontWeight: 700 }}>
                        ✓ Approve edited version
                      </button>
                      <button onClick={() => setEditing(false)} style={{ flex: 1, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 9, padding: "12px", cursor: "pointer", fontSize: 13 }}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}

              {selected.status !== "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setQueue(q => q.map(i => i.id === selected.id ? { ...i, status: "pending" } : i)); showToast("Message returned to pending"); }}
                    style={{ background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 12 }}>
                    ↩ Return to pending
                  </button>
                  <button onClick={() => { setQueue(q => q.filter(i => i.id !== selected.id)); setSelectedId(queue.find(q => q.id !== selected.id)?.id || null); }}
                    style={{ background: "transparent", color: T.faint, border: `1px solid ${T.faint}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 12 }}>
                    Remove from queue
                  </button>
                </div>
              )}

              {/* How review mode works */}
              <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "0.875rem 1rem", marginTop: "1.25rem" }}>
                <div style={{ color: T.accent, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>How review mode works</div>
                <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.65 }}>
                  When review mode is on for a campaign, every outgoing message — connection requests, follow-ups, comments, AI-generated replies — appears here before anything is sent. Approve as-written, edit then approve, or reject to skip that send entirely. Toggle review mode per campaign in the Campaigns page.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [agencyId, setAgencyId] = useState(null);
  const [view, setView] = useState("dashboard");
  const [onboarding, setOnboarding] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [flowCampaign, setFlowCampaign] = useState(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [flows, setFlows] = useLocalStorage("rf_flows", {});

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const { data: u } = await supabase.from("users").select("agency_id").eq("id", data.session.user.id).single();
        setAgencyId(u?.agency_id || null);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const { data: u } = await supabase.from("users").select("agency_id").eq("id", session.user.id).single();
        setAgencyId(u?.agency_id || null);
      } else { setAgencyId(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Data (Supabase replaces localStorage) ────────────────────────────────
  const db = useSupabaseData(agencyId);
  const { clients, campaigns, leads, activity, brand,
          addClient, updateClient, deleteClient,
          addCampaign, deleteCampaign, toggleCampaign, toggleReviewMode,
          setLeads, saveFlow: dbSaveFlow, logActivity, saveBrand } = db;

  CLIENTS = clients; CAMPAIGNS = campaigns; LEADS = leads;

  T.accent    = brand.color;
  T.accentBg  = brand.color + "22";
  T.accentDim = brand.color + "11";

  const saveFlow = (campaignId, flow) => { setFlows(f => ({ ...f, [campaignId]: flow })); dbSaveFlow(campaignId, flow); };
  const toggleReviewModeWrapped = id => toggleReviewMode(id);

  const saveFlow = (campaignId, newFlow) => {
    setFlows(f => ({ ...f, [campaignId]: newFlow }));
    const camp = campaigns.find(c => c.id === campaignId);
    if (camp) logActivity("flow", `Sequence updated: ${camp.name}`, { campaignName: camp.name });
  };

  useEffect(() => {
    const h = e => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(s => !s); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Loading
  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#2dce98", fontSize: 13 }}>Loading…</div>
    </div>
  );
  // Not logged in
  if (!session) return <AuthScreen />;


  if (onboarding) return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <OnboardingWizard brand={brand} onComplete={c => { addClient(c); setOnboarding(false); setView("dashboard"); }} onBack={() => setOnboarding(false)} />
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {showTemplates   && <TemplatesModal   onClose={() => setShowTemplates(false)} onUse={() => { setShowTemplates(false); setView("campaigns"); }} />}
      {showNewCampaign && <NewCampaignModal onClose={() => setShowNewCampaign(false)} clients={clients} onLaunchFlow={c => { addCampaign(c); setShowNewCampaign(false); setFlowCampaign(c); }} />}
      {showSearch      && <GlobalSearch     onClose={() => setShowSearch(false)} onNavigate={v => setView(v)} />}
      {editingClient   && <EditClientModal  client={editingClient} onClose={() => setEditingClient(null)} onSave={c => { updateClient(c); setEditingClient(null); logActivity("client", `ICP updated for ${c.name}`); }} />}

      <Sidebar view={view} setView={setView} onAddClient={() => setOnboarding(true)} onSearch={() => setShowSearch(true)} brand={brand} />
      <div style={{ marginLeft: 220, flex: 1, maxWidth: "calc(100% - 220px)", boxSizing: "border-box", ...((view === "inbox" || view === "pipeline") ? {} : { padding: "2rem 2.25rem" }) }}>
        {view === "dashboard"  && <Dashboard setView={setView} clients={clients} campaigns={campaigns} onDeleteClient={deleteClient} onEditClient={setEditingClient} activity={activity} />}
        {view === "inbox"      && <Inbox leads={leads} setLeads={setLeads} logActivity={logActivity} />}
        {view === "pipeline"   && <div style={{ padding: "2rem 2.25rem" }}><Pipeline leads={leads} setLeads={setLeads} logActivity={logActivity} /></div>}
        {view === "campaigns"  && <Campaigns onNew={() => setShowNewCampaign(true)} onTemplates={() => setShowTemplates(true)} onEditFlow={c => setFlowCampaign(c)} campaigns={campaigns} clients={clients} onDeleteCampaign={deleteCampaign} onToggleCampaign={toggleCampaign} onToggleReviewMode={toggleReviewModeWrapped} />}
        {view === "queue"      && <ReviewQueue campaigns={campaigns} onToggleReviewMode={toggleReviewModeWrapped} logActivity={logActivity} />}
        {view === "leads"      && <Leads leads={leads} setLeads={setLeads} logActivity={logActivity} />}
        {view === "triggers"   && <TriggerMonitor leads={leads} setLeads={setLeads} logActivity={logActivity} />}
        {view === "analytics"  && <Analytics />}
        {view === "suppression"&& <SuppressionList />}
        {view === "seo"        && <SEOReviewer />}
        {view === "social"     && <SocialMedia />}
        {view === "coach"      && <Coach />}
        {view === "settings"   && <Settings brand={brand} onBrandChange={saveBrand} />}
      </div>
    </div>
  );
}
