import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Fields that persist between expense entries
const STICKY_DEFAULTS = {
  day_key: '',       // e.g. "2026-06-15|||Day 3"  (date|||label)
  time: '',
  payment_mode_id: '',
  paid_by: '',
  split_among: null, // null means "all members"
}

function getStickyFields(projectId) {
  try {
    const raw = localStorage.getItem(`sticky_${projectId}`)
    return raw ? { ...STICKY_DEFAULTS, ...JSON.parse(raw) } : { ...STICKY_DEFAULTS }
  } catch { return { ...STICKY_DEFAULTS } }
}

function saveStickyFields(projectId, fields) {
  try {
    localStorage.setItem(`sticky_${projectId}`, JSON.stringify(fields))
  } catch {}
}

// Build the day dropdown options from project start date + num days
export function buildDayOptions(project) {
  const options = []
  if (project.start_date && project.num_days) {
    const start = new Date(project.start_date)
    for (let i = 0; i < project.num_days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const label = `Day ${i + 1}`
      const display = `${label} — ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      options.push({ value: `${dateStr}|||${label}`, display, dateStr, label })
    }
  }
  // Always add a "Custom" option for expenses outside the trip window
  options.push({ value: 'custom', display: '+ Custom date / day', dateStr: '', label: '' })
  return options
}

export default function ExpenseForm({
  project, members, categories, paymentModes, templates,
  editingExpense, clearEditing, user, onSaved, onAddCategory, onAddPaymentMode,
}) {
  const dayOptions = buildDayOptions(project)
  const sticky = getStickyFields(project.id)

  const blankForm = () => ({
    description: '',
    amount: '',
    day_key: sticky.day_key || '',
    custom_date: '',
    custom_day_label: '',
    time: sticky.time || '',
    category_id: '',
    payment_mode_id: sticky.payment_mode_id || '',
    paid_by: sticky.paid_by || '',
    split_among: sticky.split_among || members.map((m) => m.id),
    notes: '',
  })

  const [form, setForm] = useState(blankForm)
  const [isCustomDay, setIsCustomDay] = useState(false)
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
      setForm((f) => ({
        ...blankForm(),
        description: t.description,
        amount: t.amount || '',
        category_id: t.category_id || '',
        payment_mode_id: t.payment_mode_id || sticky.payment_mode_id || '',
        paid_by: t.default_paid_by || sticky.paid_by || '',
        split_among: t.default_split_among || members.map((m) => m.id),
      }))
    } else if (editingExpense) {
      // Editing existing — reconstruct day_key from stored data
      const matchedOption = dayOptions.find(
        (o) => o.dateStr === editingExpense.expense_date && o.label === editingExpense.day_label
      )
      const dayKey = matchedOption ? matchedOption.value : 'custom'
      setIsCustomDay(dayKey === 'custom')
      setForm({
        description: editingExpense.description,
        amount: editingExpense.amount,
        day_key: dayKey,
        custom_date: dayKey === 'custom' ? (editingExpense.expense_date || '') : '',
        custom_day_label: dayKey === 'custom' ? (editingExpense.day_label || '') : '',
        time: editingExpense.expense_time || '',
        category_id: editingExpense.category_id || '',
        payment_mode_id: editingExpense.payment_mode_id || '',
        paid_by: editingExpense.paid_by,
        split_among: editingExpense.split_among,
        notes: editingExpense.notes || '',
      })
    }
  }, [editingExpense])

  // When split_among changes to cover all members, store null (meaning "all") for efficiency
  const effectiveSplitAmong = form.split_among.length === members.length ? members.map((m) => m.id) : form.split_among

  const toggleSplit = (memberId) => {
    setForm((f) => ({
      ...f,
      split_among: f.split_among.includes(memberId)
        ? f.split_among.filter((id) => id !== memberId)
        : [...f.split_among, memberId],
    }))
  }

  const handleDayKeyChange = (val) => {
    if (val === 'custom') {
      setIsCustomDay(true)
      setForm((f) => ({ ...f, day_key: 'custom', custom_date: '', custom_day_label: '' }))
    } else {
      setIsCustomDay(false)
      setForm((f) => ({ ...f, day_key: val, custom_date: '', custom_day_label: '' }))
    }
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
    if (!form.category_id) { setError('Select a category.'); return }
    if (!form.payment_mode_id) { setError('Select a payment mode.'); return }
    if (!form.paid_by) { setError('Select who paid.'); return }
    if (effectiveSplitAmong.length === 0) { setError('Select at least one person to split among.'); return }

    // Resolve date and day label
    let expense_date = null
    let day_label = null

    if (isCustomDay || form.day_key === 'custom' || dayOptions.length <= 1) {
      expense_date = form.custom_date || null
      day_label = form.custom_day_label.trim() || null
    } else if (form.day_key) {
      const [dateStr, label] = form.day_key.split('|||')
      expense_date = dateStr || null
      day_label = label || null
    }

    if (!expense_date && !day_label) {
      setError('Select a day or enter a custom date / day label — at least one is required.'); return
    }

    setBusy(true)
    const payload = {
      project_id: project.id,
      description: form.description.trim(),
      amount,
      day_label,
      expense_date,
      expense_time: form.time || null,
      category_id: form.category_id,
      payment_mode_id: form.payment_mode_id,
      paid_by: form.paid_by,
      split_among: effectiveSplitAmong,
      notes: form.notes.trim() || null,
      created_by: user.id,
      sort_order: editingExpense?.sort_order ?? null,
    }

    let result
    if (isEdit) {
      result = await supabase.from('expenses').update(payload).eq('id', editingExpense.id).select().single()
    } else {
      result = await supabase.from('expenses').insert(payload).select().single()
    }

    setBusy(false)
    if (result.error) { setError(result.error.message); return }

    // Save sticky fields for next entry
    saveStickyFields(project.id, {
      day_key: form.day_key,
      time: form.time,
      payment_mode_id: form.payment_mode_id,
      paid_by: form.paid_by,
      split_among: form.split_among,
    })

    onSaved(result.data, isEdit)

    // Reset only non-sticky fields
    setForm((f) => ({
      ...blankForm(),
      day_key: f.day_key,
      time: f.time,
      payment_mode_id: f.payment_mode_id,
      paid_by: f.paid_by,
      split_among: f.split_among,
    }))
    clearEditing?.()
  }

  return (
    <div className="card">
      {isEdit && (
        <div style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span>✏️ Editing existing expense</span>
          <button className="btn-ghost" style={{ padding: 0, fontSize: 12 }} onClick={() => { setForm(blankForm()); setIsCustomDay(false); clearEditing?.() }}>Cancel edit</button>
        </div>
      )}

      {templates.length > 0 && !isEdit && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>Quick-fill from template</label>
          <select style={{ marginTop: 4 }} onChange={(e) => { if (e.target.value) { const t = templates.find(x => x.id === e.target.value); if (t) { setForm(f => ({ ...f, description: t.description, amount: t.amount || '', category_id: t.category_id || '', payment_mode_id: t.payment_mode_id || f.payment_mode_id, paid_by: t.default_paid_by || f.paid_by, split_among: t.default_split_among || f.split_among })) } } e.target.value = '' }}>
            <option value="">Select a template...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Description + Amount */}
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Description *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Taj Mahal entry tickets" autoFocus={!isEdit} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Amount ({project.currency}) *</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          </div>
        </div>

        {/* Day selector — only show dropdown when trip dates are configured */}
        {dayOptions.length > 1 && (
          <div className="form-grid" style={{ marginBottom: 4 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Day *</label>
              <select value={form.day_key} onChange={(e) => handleDayKeyChange(e.target.value)}>
                <option value="">Select day</option>
                {dayOptions.map((o) => <option key={o.value} value={o.value}>{o.display}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Time (optional)</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
          </div>
        )}

        {/* Custom date inputs (shown when "custom" is selected or no trip dates configured) */}
        {(isCustomDay || dayOptions.length === 1) && (
          <div className="form-grid" style={{ marginBottom: 14, marginTop: 10 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Date *</label>
              <input type="date" value={form.custom_date} onChange={(e) => setForm({ ...form, custom_date: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Day label (optional)</label>
              <input value={form.custom_day_label} onChange={(e) => setForm({ ...form, custom_day_label: e.target.value })} placeholder="e.g. Day 3" />
            </div>
          </div>
        )}
        {dayOptions.length === 1 && (
          <div className="form-grid" style={{ marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Time (optional)</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div />
          </div>
        )}
        {!isCustomDay && dayOptions.length > 1 && <div style={{ marginBottom: 14 }} />}

        {/* Category + Mode */}
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Category *</label>
            {!showNewCat ? (
              <select value={form.category_id} onChange={(e) => e.target.value === '__new__' ? setShowNewCat(true) : setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ Add custom category...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. 🎁 Souvenirs" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCategory}>Add</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowNewCat(false)}>✕</button>
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Payment mode * <span style={{ fontSize: 11, color: 'var(--text3)' }}>(remembered)</span></label>
            {!showNewMode ? (
              <select value={form.payment_mode_id} onChange={(e) => e.target.value === '__new__' ? setShowNewMode(true) : setForm({ ...form, payment_mode_id: e.target.value })}>
                <option value="">Select mode</option>
                {paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="__new__">+ Add custom mode...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={newModeName} onChange={(e) => setNewModeName(e.target.value)} placeholder="e.g. 🤝 Cheque" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMode())} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddMode}>Add</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowNewMode(false)}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Paid by */}
        <div className="field">
          <label>Paid by * <span style={{ fontSize: 11, color: 'var(--text3)' }}>(remembered)</span></label>
          <select value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}>
            <option value="">Select person</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>

        {/* Split among */}
        <div className="field">
          <label>Split among * <span style={{ fontSize: 11, color: 'var(--text3)' }}>(remembered)</span></label>
          <div className="checkbox-group">
            {members.map((m) => (
              <label key={m.id}>
                <input type="checkbox" checked={form.split_among.includes(m.id)} onChange={() => toggleSplit(m.id)} />
                {m.display_name}
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="field">
          <label>Notes (optional)</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. only dinner for two people" />
        </div>

        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? '✓ Save changes' : '✓ Add expense'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => { setForm(blankForm()); setIsCustomDay(false); clearEditing?.() }}>
            {isEdit ? 'Cancel' : 'Clear'}
          </button>
        </div>
      </form>
    </div>
  )
}
