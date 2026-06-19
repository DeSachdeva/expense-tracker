import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ExpenseForm({
  project, members, categories, paymentModes, templates,
  editingExpense, clearEditing, user, onSaved, onAddCategory, onAddPaymentMode,
}) {
  const blank = {
    description: '', amount: '', day_label: '', expense_date: '',
    category_id: '', payment_mode_id: '', paid_by: '',
    split_among: members.map((m) => m.id), notes: '',
  }
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)
  const [showNewMode, setShowNewMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newModeName, setNewModeName] = useState('')

  const isEdit = editingExpense && !editingExpense.fromTemplate

  useEffect(() => {
    if (editingExpense?.fromTemplate) {
      const t = editingExpense.fromTemplate
      setForm({
        description: t.description, amount: t.amount || '', day_label: '', expense_date: '',
        category_id: t.category_id || '', payment_mode_id: t.payment_mode_id || '',
        paid_by: t.default_paid_by || '', split_among: t.default_split_among || members.map((m) => m.id),
        notes: '',
      })
    } else if (editingExpense) {
      setForm({
        description: editingExpense.description, amount: editingExpense.amount,
        day_label: editingExpense.day_label || '', expense_date: editingExpense.expense_date || '',
        category_id: editingExpense.category_id || '', payment_mode_id: editingExpense.payment_mode_id || '',
        paid_by: editingExpense.paid_by, split_among: editingExpense.split_among, notes: editingExpense.notes || '',
      })
    } else {
      setForm(blank)
    }
  }, [editingExpense, members])

  const toggleSplit = (memberId) => {
    setForm((f) => ({
      ...f,
      split_among: f.split_among.includes(memberId)
        ? f.split_among.filter((id) => id !== memberId)
        : [...f.split_among, memberId],
    }))
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    const data = await onAddCategory(newCatName.trim())
    if (data) setForm((f) => ({ ...f, category_id: data.id }))
    setNewCatName(''); setShowNewCat(false)
  }

  const handleAddMode = async () => {
    if (!newModeName.trim()) return
    const data = await onAddPaymentMode(newModeName.trim())
    if (data) setForm((f) => ({ ...f, payment_mode_id: data.id }))
    setNewModeName(''); setShowNewMode(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const amount = parseFloat(form.amount)
    if (!form.description.trim()) { setError('Description is required.'); return }
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount.'); return }
    if (!form.day_label.trim() && !form.expense_date) { setError('Either Day or Date is required (you can fill both).'); return }
    if (!form.category_id) { setError('Select a category.'); return }
    if (!form.payment_mode_id) { setError('Select a payment mode.'); return }
    if (!form.paid_by) { setError('Select who paid.'); return }
    if (form.split_among.length === 0) { setError('Select at least one person to split among.'); return }

    setBusy(true)
    const payload = {
      project_id: project.id,
      description: form.description.trim(),
      amount,
      day_label: form.day_label.trim() || null,
      expense_date: form.expense_date || null,
      category_id: form.category_id,
      payment_mode_id: form.payment_mode_id,
      paid_by: form.paid_by,
      split_among: form.split_among,
      notes: form.notes.trim() || null,
      created_by: user.id,
    }

    let result
    if (isEdit) {
      result = await supabase.from('expenses').update(payload).eq('id', editingExpense.id).select().single()
    } else {
      result = await supabase.from('expenses').insert(payload).select().single()
    }

    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    onSaved(result.data, isEdit)
    setForm(blank)
    clearEditing?.()
  }

  return (
    <div className="card">
      {isEdit && (
        <div style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span>Editing existing expense</span>
          <button className="btn-ghost" style={{ padding: 0, fontSize: 12 }} onClick={() => { setForm(blank); clearEditing?.() }}>Cancel edit</button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Description *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Taj Mahal entry tickets" />
          </div>
          <div className="field">
            <label>Amount ({project.currency}) *</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Day label (e.g. "Day 3")</label>
            <input value={form.day_label} onChange={(e) => setForm({ ...form, day_label: e.target.value })} placeholder="Day 3" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 14 }}>At least one of Day label or Date is required — fill either or both.</p>

        <div className="form-grid">
          <div className="field">
            <label>Category *</label>
            {!showNewCat ? (
              <select value={form.category_id} onChange={(e) => e.target.value === '__new__' ? setShowNewCat(true) : setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ Add custom category...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. 🎁 Souvenirs" />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCategory}>Add</button>
              </div>
            )}
          </div>
          <div className="field">
            <label>Payment mode *</label>
            {!showNewMode ? (
              <select value={form.payment_mode_id} onChange={(e) => e.target.value === '__new__' ? setShowNewMode(true) : setForm({ ...form, payment_mode_id: e.target.value })}>
                <option value="">Select mode</option>
                {paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="__new__">+ Add custom mode...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={newModeName} onChange={(e) => setNewModeName(e.target.value)} placeholder="e.g. 🤝 Cheque" />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddMode}>Add</button>
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label>Paid by *</label>
          <select value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}>
            <option value="">Select person</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Split among * (uncheck to exclude someone)</label>
          <div className="checkbox-group">
            {members.map((m) => (
              <label key={m.id}>
                <input type="checkbox" checked={form.split_among.includes(m.id)} onChange={() => toggleSplit(m.id)} />
                {m.display_name}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Notes (optional)</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. only dinner for two people" />
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? '✓ Save changes' : '✓ Add expense'}
          </button>
          {!isEdit && <button type="button" className="btn btn-secondary" onClick={() => setForm(blank)}>Clear</button>}
        </div>
      </form>
    </div>
  )
}
