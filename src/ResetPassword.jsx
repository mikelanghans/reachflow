import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const T = {
  bg: '#0d1117', surface: '#161b22', card: '#1c2128', border: '#30363d',
  accent: '#2dce98', text: '#e6edf3', muted: '#7d8590', red: '#f85149',
}

const inp = {
  background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
  color: T.text, padding: '11px 14px', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}

// Renders when the URL is /reset-password — the link from the password
// reset email lands here. Supabase puts the user into a temporary
// "password recovery" session via the URL hash; we listen for that event
// rather than trying to parse tokens ourselves.
export default function ResetPassword() {
  const [ready, setReady]       = useState(false)
  const [invalid, setInvalid]   = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // If the recovery event already fired before this listener attached
    // (can happen on fast page loads), fall back to checking for an
    // existing session after a short delay.
    const fallback = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && !ready) setReady(true)
      else if (!session) setInvalid(true)
    }, 2500)

    return () => { subscription.unsubscribe(); clearTimeout(fallback) }
  }, [ready])

  const handleSubmit = async () => {
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError("Passwords don't match"); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/' }, 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 6 }}>
            reach<span style={{ color: T.accent }}>flow</span>
          </div>
          <div style={{ color: T.muted, fontSize: 13 }}>Set a new password</div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '2rem' }}>
          {invalid && (
            <>
              <div style={{ background: 'rgba(248,81,73,0.10)', border: `1px solid ${T.red}44`, borderRadius: 8, padding: '10px 14px', color: T.red, fontSize: 13, marginBottom: '1.25rem', lineHeight: 1.5 }}>
                This reset link is invalid or has expired. Reset links are only valid for a short time after they're sent.
              </div>
              <a href="/" style={{ color: T.accent, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Back to sign in</a>
            </>
          )}

          {!invalid && !ready && (
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>Verifying your reset link…</div>
          )}

          {ready && !done && (
            <>
              <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: '1.5rem' }}>Choose a new password</div>

              {error && (
                <div style={{ background: 'rgba(248,81,73,0.10)', border: `1px solid ${T.red}44`, borderRadius: 8, padding: '10px 14px', color: T.red, fontSize: 13, marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: T.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>New password</label>
                <input type="password" style={inp} value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="At least 8 characters" />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: T.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Confirm password</label>
                <input type="password" style={inp} value={confirm} onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Re-enter your new password" />
              </div>

              <button onClick={handleSubmit} disabled={loading || !password || !confirm}
                style={{ width: '100%', background: loading ? T.muted : T.accent, color: '#0d1117', border: 'none', borderRadius: 8, padding: '12px', cursor: loading ? 'default' : 'pointer', fontSize: 14, fontWeight: 700 }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ color: T.accent, fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ color: T.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Password updated</div>
              <div style={{ color: T.muted, fontSize: 13 }}>Redirecting you to the app…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
