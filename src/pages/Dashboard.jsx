import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    setLoading(true)
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const projectIds = (memberships || []).map((m) => m.project_id)
    if (projectIds.length === 0) { setProjects([]); setLoading(false); return }

    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(id), expenses(amount)')
      .in('id', projectIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!error) setProjects(data || [])
    setLoading(false)
  }

  return (
    <div>
      <header className="app-header">
        <div className="app-logo">✈️ Trip Tracker</div>
        <div className="user-menu">
          <span>{user.user_metadata?.full_name || user.email}</span>
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Your projects</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>Join with code</button>
            <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>+ New project</button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text2)', marginTop: 20 }}>Loading...</p>
        ) : projects.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-icon">🧳</div>
            <p>No projects yet. Create one for your next trip, flatshare, or event.</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            {projects.map((p) => {
              const total = (p.expenses || []).reduce((s, e) => s + Number(e.amount), 0)
              return (
                <div key={p.id} className="project-card" onClick={() => navigate(`/project/${p.id}`)}>
                  <h3>{p.name}</h3>
                  <div className="meta">{p.description || 'No description'}</div>
                  <div className="stat-row">
                    <span>{(p.project_members || []).length} member{(p.project_members || []).length !== 1 ? 's' : ''}</span>
                    <strong>{p.currency === 'INR' ? '₹' : p.currency} {Math.round(total).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              )
            })}
            <div className="project-card new-project-card" onClick={() => setShowNewModal(true)}>
              <span style={{ fontSize: 24 }}>+</span>
              <span>New project</span>
            </div>
          </div>
        )}
      </div>

      {showNewModal && <NewProjectModal onClose={() => setShowNewModal(false)} onCreated={(id) => navigate(`/project/${id}`)} />}
      {showJoinModal && <JoinModal onClose={() => setShowJoinModal(false)} />}
    </div>
  )
}

function NewProjectModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: name.trim(), description: description.trim() || null, currency, owner_id: user.id })
      .select()
      .single()
    setBusy(false)
    if (error) setError(error.message)
    else onCreated(data.id)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Create a new project</h3>
        <div className="modal-sub">A project can be a trip, a flatshare, an event — anything you split expenses for.</div>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label>Project name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goa Trip 2026" required autoFocus />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 10-day trip with college friends" />
          </div>
          <div className="field">
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">₹ INR — Indian Rupee</option>
              <option value="USD">$ USD — US Dollar</option>
              <option value="EUR">€ EUR — Euro</option>
              <option value="GBP">£ GBP — British Pound</option>
            </select>
          </div>
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating...' : 'Create project'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function JoinModal({ onClose }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  const handleJoin = (e) => {
    e.preventDefault()
    if (!code.trim()) return
    navigate(`/join/${code.trim()}`)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Join a project</h3>
        <div className="modal-sub">Enter the invite code someone shared with you.</div>
        <form onSubmit={handleJoin}>
          <div className="field">
            <label>Invite code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. a1b2c3d4" required autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Join</button>
          </div>
        </form>
      </div>
    </div>
  )
}
