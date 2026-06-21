const T = {
  bg: '#0d1117', surface: '#161b22', card: '#1c2128', border: '#30363d',
  accent: '#2dce98', text: '#e6edf3', muted: '#7d8590', red: '#f85149',
}

// Landed on if the Unipile hosted-auth flow fails (their
// failure_redirect_url points here) - e.g. the user closed the LinkedIn
// login popup, entered wrong credentials too many times, or LinkedIn
// blocked the attempt.
export default function OnboardingConnectFailed() {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '2.5rem 2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(248,81,73,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: 24, color: T.red, fontWeight: 700 }}>!</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Connection didn't complete</div>
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, marginBottom: '1.5rem' }}>
            The LinkedIn connection wasn't completed. You may have closed the login window, entered incorrect credentials, or LinkedIn blocked the attempt. No account was connected.
          </div>
          <a href="/" style={{ display: 'inline-block', background: T.accent, color: '#0d1117', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Back to app
          </a>
        </div>
      </div>
    </div>
  )
}
