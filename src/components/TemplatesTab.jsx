import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TemplatesTab({ project, templates, members, categories, paymentModes, onChanged, onUseTemplate, showToast }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', amount: '', category_id: '', payment_mode_id: '', default_paid_by: '', default_split_among: members.map((m) => m.id) })
  const [busy, setBusy] = useState(false)

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const modeMap = Object.fromEntries(paymentModes.map((m) => [m.id, m.name]))
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.display_name]))

  const toggleSplit = (id) => {
    setForm((f) => ({ ...f, default_split_among: f.default_split_among.includes(id) ? f.default_split_among.filter((x) => x !== id) : [...f.default_split_among, id] }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.description.trim()) { showToast('Template name and description are required.', true); return }
    setBusy(true)
    const { error } = await supabase.from('expense_templates').insert({
      project_id: project.id,
      name: form.name.trim(),
      description: form.description.trim(),
      amount: form.amount ? parseFloat(form.amount) : null,
      category_id: form.category_id || null,
      payment_mode_id: form.payment_mode_id || null,
      default_paid_by: form.default_paid_by || null,
      default_split_among: form.default_split_among.length ? form.default_split_among : null,
    })
    setBusy(false)
    if (error) { showToast(error.message, true); return }
    setForm({ name: '', description: '', amount: '', category_id: '', payment_mode_id: '', default_paid_by: '', default_split_among: members.map((m) => m.id) })
    setShowForm(false)
    onChanged()
    showToast('Template saved!')
  }

  const deleteTemplate = async (t) => {
    if (!confirm(`Delete template "${t.name}"?`)) return
    const { error } = await supabase.from('expense_templates').delete().eq('id', t.id)
    if (error) { showToast(error.message, true); return }
    onChanged()
    showToast('Template deleted.')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text2)' }}>Save recurring expenses — like daily breakfast or monthly rent — and reuse them in one click.</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New template'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="field"><label>Template name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Daily breakfast" /></div>
              <div className="field"><label>Description (expense text) *</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Breakfast at hotel" /></div>
            </div>
            <div className="form-grid3">
              <div className="field"><label>Default amount</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="optional" /></div>
              <div className="field">
                <label>Category</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Payment mode</label>
                <select value={form.payment_mode_id} onChange={(e) => setForm({ ...form, payment_mode_id: e.target.value })}>
                  <option value="">None</option>
                  {paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Default paid by</label>
              <select value={form.default_paid_by} onChange={(e) => setForm({ ...form, default_paid_by: e.target.value })}>
                <option value="">None</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Default split among</label>
              <div className="checkbox-group">
                {members.map((m) => (
                  <label key={m.id}><input type="checkbox" checked={form.default_split_among.includes(m.id)} onChange={() => toggleSplit(m.id)} />{m.display_name}</label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save template'}</button>
          </form>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔁</div><p>No templates yet.</p></div>
      ) : (
        templates.map((t) => (
          <div className="template-card" key={t.id}>
            <div>
              <div style={{ fontWeight: 500 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {t.description} {t.amount ? `· ${t.amount}` : ''} {t.category_id ? `· ${catMap[t.category_id]}` : ''} {t.default_paid_by ? `· Paid by ${memberMap[t.default_paid_by]}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onUseTemplate(t)}>Use</button>
              <button className="btn-danger" onClick={() => deleteTemplate(t)}>🗑</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
