import { useState } from 'react'
import { supabase } from './supabase'

const T = {
  bg: '#0d1117', surface: '#161b22', card: '#1c2128', border: '#30363d',
  accent: '#2dce98', text: '#e6edf3', muted: '#7d8590',
}

export default function AuthScreen() {
  const [mode, setMode]         = useState('login')   // 'login' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)

  const inp = {
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.text, padding: '11px 14px', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  }

  const handleSubmit = async () => {
    if (!email || !password) return
    setLoading(true); setError(null); setSuccess(null)

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: { data: { agency_name: agencyName || 'My Agency' } },
      })
      if (err) { setError(err.message); setLoading(false); return }
      setSuccess('Account created! Check your email to confirm, then log in.')
      setMode('login')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    }
    setLoading(false)
  }

  const handleForgot = async () => {
    if (!email) { setError('Enter your email first'); return }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email)
    if (err) setError(err.message)
    else setSuccess('Password reset email sent')
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 6 }}>
            reach<span style={{ color: T.accent }}>flow</span>
          </div>
          <div style={{ color: T.muted, fontSize: 13 }}>Agency outreach platform</div>
        </div>

        {/* Card */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '2rem' }}>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: '1.5rem' }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your agency account'}
          </div>

          {success && (
            <div style={{ background: 'rgba(45,206,152,0.1)', border: `1px solid ${T.accent}44`, borderRadius: 8, padding: '10px 14px', color: T.accent, fontSize: 13, marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', borderRadius: 8, padding: '10px 14px', color: '#f85149', fontSize: 13, marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <div>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Agency name</div>
                <input style={inp} placeholder="e.g. Growth Partners Agency" value={agencyName} onChange={e => setAgencyName(e.target.value)} />
              </div>
            )}

            <div>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Email</div>
              <input style={inp} type="email" placeholder="you@agency.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <div>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Password</div>
              <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            style={{ width: '100%', background: loading || !email || !password ? '#3d444d' : T.accent, color: loading || !email || !password ? T.muted : '#0d1117', border: 'none', borderRadius: 9, padding: '12px', cursor: loading || !email || !password ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, marginTop: '1.25rem', transition: 'background 0.15s' }}>
            {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'login' && (
            <button onClick={handleForgot} style={{ width: '100%', background: 'transparent', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer', marginTop: 8, padding: '4px' }}>
              Forgot password?
            </button>
          )}
        </div>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem', color: T.muted, fontSize: 13 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccess(null); }}
            style={{ background: 'transparent', border: 'none', color: T.accent, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  )
}
