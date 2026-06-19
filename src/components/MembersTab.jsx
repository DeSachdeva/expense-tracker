import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MembersTab({ project, members, isOwner, user, onChanged, showToast }) {
  const [newName, setNewName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const inviteLink = `${window.location.origin}/join/${project.invite_code}`

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    showToast('Invite link copied!')
  }

  const addPlaceholder = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    const { error } = await supabase.from('project_members').insert({
      project_id: project.id,
      display_name: newName.trim(),
      role: 'member',
    })
    setBusy(false)
    if (error) { showToast(error.message, true); return }
    setNewName('')
    onChanged()
    showToast(`${newName} added to the project.`)
  }

  const sendEmailInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setBusy(true)
    const { error } = await supabase.from('project_invites').insert({
      project_id: project.id,
      email: inviteEmail.trim(),
      invited_by: user.id,
    })
    setBusy(false)
    if (error) { showToast(error.message, true); return }
    setInviteEmail('')
    showToast(`Invite saved for ${inviteEmail}. Share the invite link with them directly — automatic emails require a mail service to be configured (see README).`)
  }

  const removeMember = async (member) => {
    if (!confirm(`Remove ${member.display_name} from this project? Their past expenses will stay on record.`)) return
    const { error } = await supabase.from('project_members').delete().eq('id', member.id)
    if (error) { showToast(error.message, true); return }
    onChanged()
    showToast(`${member.display_name} removed.`)
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Invite people</h3>
        <div className="invite-box">
          <code>{inviteLink}</code>
          <button className="btn btn-secondary btn-sm" onClick={copyLink}>Copy</button>
        </div>
        <form onSubmit={sendEmailInvite} style={{ display: 'flex', gap: 8 }}>
          <input type="email" placeholder="Invite by email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={busy} type="submit">Invite</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Add someone without an account</h3>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Use this for people who don't want to sign up — you can record expenses on their behalf.</p>
        <form onSubmit={addPlaceholder} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Their name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={busy} type="submit">Add</button>
        </form>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Current members ({members.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {members.map((m) => (
          <div key={m.id} className="member-chip" style={{ justifyContent: 'space-between' }}>
            <span>{m.display_name} {m.role === 'owner' && <span style={{ fontSize: 11, color: 'var(--text3)' }}>(owner)</span>} {!m.user_id && <span style={{ fontSize: 11, color: 'var(--text3)' }}>(no account)</span>}</span>
            {isOwner && m.role !== 'owner' && <button className="btn-danger" onClick={() => removeMember(m)}>Remove</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
