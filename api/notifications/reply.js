// api/notifications/reply.js
//
// Sends an email notification when a new reply comes in.
// Called from the Unipile webhook handler after saving an inbound message.
//
// Also exports a sendDailyDigest function used by the scheduler.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = process.env.NOTIFY_FROM_EMAIL || 'notifications@reachflow.io'

export async function sendReplyNotification({ agencyEmail, leadName, company, messagePreview, appUrl }) {
  if (!RESEND_API_KEY) return // Silently skip if not configured

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      agencyEmail,
      subject: `New reply from ${leadName} · ${company}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
          <div style="background: #0d1117; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <div style="color: #2dce98; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">ReachFlow · New Reply</div>
            <div style="color: #e6edf3; font-size: 20px; font-weight: 700; margin-bottom: 4px;">${leadName}</div>
            <div style="color: #7d8590; font-size: 13px; margin-bottom: 20px;">${company}</div>
            <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px 16px; color: #e6edf3; font-size: 14px; line-height: 1.6; font-style: italic;">
              "${messagePreview}"
            </div>
          </div>
          <div style="text-align: center;">
            <a href="${appUrl}/inbox" style="display: inline-block; background: #2dce98; color: #0d1117; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-weight: 700; font-size: 14px;">
              Reply in ReachFlow →
            </a>
          </div>
          <div style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px;">
            You're receiving this because you have reply notifications enabled in ReachFlow.
          </div>
        </div>
      `,
    }),
  })
}

export async function sendDailyDigest({ agencyEmail, stats, appUrl }) {
  if (!RESEND_API_KEY || !stats.total > 0) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      agencyEmail,
      subject: `Your ReachFlow daily summary · ${stats.replies} new repl${stats.replies === 1 ? 'y' : 'ies'}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
          <div style="background: #0d1117; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <div style="color: #2dce98; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px;">ReachFlow · Daily Summary</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
              ${statCard('Messages sent', stats.sent, '#58a6ff')}
              ${statCard('New replies',   stats.replies, '#2dce98')}
              ${statCard('Meetings',      stats.meetings, '#bc8cff')}
            </div>
            ${stats.replyNames?.length > 0 ? `
              <div style="color: #7d8590; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px;">Replied today</div>
              ${stats.replyNames.map(n => `<div style="color: #e6edf3; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #1c2128;">${n}</div>`).join('')}
            ` : ''}
          </div>
          <div style="text-align: center;">
            <a href="${appUrl}" style="display: inline-block; background: #2dce98; color: #0d1117; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-weight: 700; font-size: 14px;">
              Open ReachFlow →
            </a>
          </div>
        </div>
      `,
    }),
  })
}

function statCard(label, value, color) {
  return `
    <div style="background: #161b22; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: ${color}; font-size: 24px; font-weight: 800;">${value}</div>
      <div style="color: #7d8590; font-size: 11px; margin-top: 2px;">${label}</div>
    </div>
  `
}

// Default export for direct HTTP calls (optional)
export default async function handler(req, res) {
  res.status(200).json({ ok: true, message: 'Use sendReplyNotification() directly' })
}
