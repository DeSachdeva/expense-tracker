import { useState } from 'react'
import { formatCurrency } from '../lib/balances'

export default function ExpenseList({ project, expenses, members, memberMap, categories, paymentModes, onEdit, onDeleted }) {
  const [filterCat, setFilterCat] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [filterPerson, setFilterPerson] = useState('')

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const modeMap = Object.fromEntries(paymentModes.map((m) => [m.id, m]))

  let filtered = expenses.filter((e) => {
    if (filterCat && e.category_id !== filterCat) return false
    if (filterMode && e.payment_mode_id !== filterMode) return false
    if (filterPerson && e.paid_by !== filterPerson) return false
    return true
  })

  // group by day_label if present, else by date, else "Other"
  const groups = {}
  filtered.forEach((e) => {
    const key = e.day_label || (e.expense_date ? new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Other')
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })

  const exportCSV = () => {
    if (expenses.length === 0) return
    const header = ['Day', 'Date', 'Description', 'Category', `Amount (${project.currency})`, 'Paid By', 'Payment Mode', 'Split Among', 'Each Person Pays', 'Notes']
    const rows = expenses.map((e) => [
      e.day_label || '', e.expense_date || '', e.description, catMap[e.category_id]?.name || '', e.amount,
      memberMap[e.paid_by]?.display_name || '', modeMap[e.payment_mode_id]?.name || '',
      e.split_among.map((id) => memberMap[id]?.display_name).join(' + '),
      (e.amount / e.split_among.length).toFixed(2), e.notes || '',
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `${project.name.replace(/\s+/g, '_')}_expenses.csv`
    a.click()
  }

  return (
    <div>
      <div className="toolbar">
        <select className="filter-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="filter-select" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
          <option value="">All modes</option>
          {paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="filter-select" value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
          <option value="">All people</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={exportCSV}>⬇️ Export CSV</button>
      </div>

      {Object.keys(groups).length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <p>{expenses.length === 0 ? 'No expenses yet. Add your first one!' : 'No expenses match the filters.'}</p>
        </div>
      ) : (
        Object.entries(groups).map(([groupKey, exps]) => {
          const groupTotal = exps.reduce((s, e) => s + Number(e.amount), 0)
          return (
            <div key={groupKey} className="day-group">
              <div className="day-label">{groupKey}</div>
              {exps.map((e) => (
                <div key={e.id} className="expense-card">
                  <div className="expense-main">
                    <div className="expense-desc">{e.description}</div>
                    <div className="expense-meta">
                      <span className="badge badge-cat">{catMap[e.category_id]?.name}</span>
                      <span className="badge badge-mode">{modeMap[e.payment_mode_id]?.name}</span>
                      <span className="badge badge-paid">Paid by {memberMap[e.paid_by]?.display_name}</span>
                    </div>
                    <div className="expense-split">
                      Split among: {e.split_among.map((id) => memberMap[id]?.display_name).join(', ')} · Each: {formatCurrency(e.amount / e.split_among.length, project.currency)}
                    </div>
                    {e.notes && <div className="expense-notes">{e.notes}</div>}
                    {e.day_label && e.expense_date && <div className="expense-notes">📅 {e.expense_date}</div>}
                  </div>
                  <div className="expense-right">
                    <div className="expense-amount">{formatCurrency(e.amount, project.currency)}</div>
                    <div className="expense-actions">
                      <button className="btn-ghost btn-sm" onClick={() => onEdit(e)}>✏️ Edit</button>
                      <button className="btn-danger" onClick={() => { if (confirm('Move this expense to trash?')) onDeleted(e) }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="day-total">Group total: {formatCurrency(groupTotal, project.currency)}</div>
            </div>
          )
        })
      )}
    </div>
  )
}
