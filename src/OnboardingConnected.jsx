import { useEffect, useState } from 'react'

const T = {
  bg: '#0d1117', surface: '#161b22', card: '#1c2128', border: '#30363d',
  accent: '#2dce98', text: '#e6edf3', muted: '#7d8590',
}

// Landed on after a successful LinkedIn hosted-auth flow (Unipile's
// success_redirect_url points here). Unipile's webhook does the actual
// work of marking the client as connected in Supabase - this page is just
// a friendly confirmation screen, since the webhook may take a few seconds
// to fire and we don't want the user staring at a blank tab.
export default function OnboardingConnected() {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const interval = setInterval(() => setCountdown(c => c - 1), 1000)
    const redirect = setTimeout(() => { window.location.href = '/' }, 3000)
    return () => { clearInterval(interval); clearTimeout(redirect) }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '2.5rem 2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(45,206,152,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: 28, color: T.accent }}>OK</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>LinkedIn connected</div>
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Your LinkedIn account is linked. It may take a few seconds to show as active in Settings.
          </div>
          <div style={{ color: T.muted, fontSize: 12 }}>Redirecting in {countdown}...</div>
        </div>
      </div>
    </div>
  )
}
