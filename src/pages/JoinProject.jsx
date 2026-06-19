import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'

export default function JoinProject() {
  const { inviteCode } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | found | joined | error | already
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { lookupProject() }, [inviteCode])

  const lookupProject = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('invite_code', inviteCode)
      .is('deleted_at', null)
      .single()

    if (error || !data) { setStatus('error'); setError('Invite code not found or project no longer exists.'); return }
    setProject(data)

    const { data: existing } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', data.id)
      .eq('user_id', user.id)
      .maybeSingle()

    setStatus(existing ? 'already' : 'found')
  }

  const handleJoin = async () => {
    const { error } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      display_name: user.user_metadata?.full_name || user.email,
      role: 'member',
    })
    if (error) { setStatus('error'); setError(error.message); return }

    await logActivity({
      projectId: project.id,
      actorId: user.id,
      actorName: user.user_metadata?.full_name || user.email,
      action: 'created',
      entityType: 'member',
      summary: `${user.user_metadata?.full_name || user.email} joined the project`,
    })
    setStatus('joined')
    setTimeout(() => navigate(`/project/${project.id}`), 1000)
  }

  return (
    <div className="auth-shell">
      <div className="auth-box">
        <div className="auth-logo">✈️ Trip Tracker</div>
        <div className="card" style={{ textAlign: 'center' }}>
          {status === 'loading' && <p>Looking up invite...</p>}
          {status === 'error' && <p className="error-text">{error}</p>}
          {status === 'already' && (
            <>
              <p style={{ marginBottom: 14 }}>You're already a member of <strong>{project.name}</strong>.</p>
              <button className="btn btn-primary btn-block" onClick={() => navigate(`/project/${project.id}`)}>Go to project</button>
            </>
          )}
          {status === 'found' && (
            <>
              <p style={{ marginBottom: 14 }}>You've been invited to join <strong>{project.name}</strong>.</p>
              <button className="btn btn-primary btn-block" onClick={handleJoin}>Join project</button>
            </>
          )}
          {status === 'joined' && <p className="success-text">Joined! Redirecting...</p>}
        </div>
      </div>
    </div>
  )
}
