import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/balances'

export default function SettlementsTab({ project, members, memberMap, settlements, paymentModes, user, onAdded, onDeleted }) {
  const [form, setForm] = useState({ from_member: '', to_member: '', amount: '', payment_date: '', payment_mode_id: '', note: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const amount = parseFloat(form.amount)
    if (!form.from_member || !form.to_member) { setError('Select both who paid and who received.'); return }
    if (form.from_member === form.to_member) { setError('From and To cannot be the same person.'); return }
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount.'); return }

    setBusy(true)
    const { data, error: err } = await supabase.from('settlement_payments').insert({
      project_id: project.id,
      from_member: form.from_member,
      to_member: form.to_member,
      amount,
      payment_date: form.payment_date || null,
      payment_mode_id: form.payment_mode_id || null,
      note: form.note.trim() || null,
      created_by: user.id,
    }).select().single()
    setBusy(false)
    if (err) { setError(err.message); return }
    setForm({ from_member: '', to_member: '', amount: '', payment_date: '', payment_mode_id: '', note: '' })
    onAdded(data)
  }

  const total = settlements.reduce((s, p) => s + Number(p.amount), 0)
  const modeMap = Object.fromEntries(paymentModes.map((m) => [m.id, m]))

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Record a payment already made</div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Who paid *</label>
              <select value={form.from_member} onChange={(e) => setForm({ ...form, from_member: e.target.value })}>
                <option value="">Select person</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Paid to *</label>
              <select value={form.to_member} onChange={(e) => setForm({ ...form, to_member: e.target.value })}>
                <option value="">Select person</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid3">
            <div className="field">
              <label>Amount ({project.currency}) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="field">
              <label>Date (optional)</label>
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div className="field">
              <label>Mode (optional)</label>
              <select value={form.payment_mode_id} onChange={(e) => setForm({ ...form, payment_mode_id: e.target.value })}>
                <option value="">Select mode</option>
                {paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Reference / note (optional)</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. UPI transfer, cash handover at airport" />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? 'Saving...' : '✓ Record payment'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payment history</h3>
        {settlements.length > 0 && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{settlements.length} payment{settlements.length > 1 ? 's' : ''} · {formatCurrency(total, project.currency)} total recorded</span>}
      </div>

      {settlements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💚</div>
          <p>No payments recorded yet. Add payments that have already been made to keep a clear record.</p>
        </div>
      ) : (
        settlements.map((p) => (
          <div key={p.id} className="settlement-record">
            <div className="sr-main">
              <span style={{ fontWeight: 500 }}>{memberMap[p.from_member]?.display_name}</span>
              <span style={{ color: 'var(--text3)' }}>→</span>
              <span style={{ fontWeight: 500 }}>{memberMap[p.to_member]?.display_name}</span>
              <span className="sr-amount">{formatCurrency(p.amount, project.currency)}</span>
              {p.payment_mode_id && <span className="badge badge-mode">{modeMap[p.payment_mode_id]?.name}</span>}
              {p.payment_date && <span style={{ fontSize: 12, color: 'var(--text3)' }}>📅 {p.payment_date}</span>}
              {p.note && <span style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>{p.note}</span>}
            </div>
            <button className="btn-danger" onClick={() => { if (confirm('Move this payment record to trash?')) onDeleted(p) }}>🗑</button>
          </div>
        ))
      )}
    </div>
  )
}
