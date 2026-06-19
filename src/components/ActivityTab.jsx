import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ACTION_ICONS = { created: '✅', updated: '✏️', deleted: '🗑️', restored: '♻️' }

export default function ActivityTab({ projectId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('activity_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [projectId])

  if (loading) return <p style={{ color: 'var(--text2)' }}>Loading activity...</p>
  if (logs.length === 0) return <div className="empty-state"><div className="empty-icon">🕘</div><p>No activity recorded yet.</p></div>

  return (
    <div className="card">
      {logs.map((log) => (
        <div className="activity-item" key={log.id}>
          <span>{ACTION_ICONS[log.action] || '•'}</span>
          <div style={{ flex: 1 }}>
            <div>{log.summary}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>by {log.actor_name}</div>
          </div>
          <div className="activity-time">{new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      ))}
    </div>
  )
}
