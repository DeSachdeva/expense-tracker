import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signInWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email above first, then click "Forgot password".'); return }
    setError('')
    const { error } = await resetPassword(email)
    if (error) setError(error.message)
    else setInfo('Password reset link sent — check your email.')
  }

  return (
    <div className="auth-shell">
      <div className="auth-box">
        <div className="auth-logo">✈️ Trip Tracker</div>
        <div className="auth-sub">Split expenses with anyone, for anything.</div>

        <div className="card">
          <button className="btn btn-secondary btn-block google-btn" onClick={handleGoogle} type="button">
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.4l-6.5-5.4c-2 1.4-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-8l-6.6 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.7l6.5 5.4C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
            Continue with Google
          </button>

          <div className="auth-divider">or</div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {error && <div className="error-text">{error}</div>}
            {info && <div className="success-text">{info}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 6 }}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12 }}>
            <button className="btn-ghost" onClick={handleForgotPassword} type="button" style={{ padding: 0, fontSize: 12 }}>Forgot password?</button>
            <Link to="/signup">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
