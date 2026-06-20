import { useState, useRef } from 'react'
import { formatCurrency } from '../lib/balances'
import { supabase } from '../lib/supabase'

export default function ExpenseList({ project, expenses, members, memberMap, categories, paymentModes, onEdit, onDeleted, onReordered }) {
  const [filterCat, setFilterCat] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [filterPerson, setFilterPerson] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [dragState, setDragState] = useState({ draggingId: null, dragOverId: null })

  // Use refs for the actual logic — state is only for visual feedback
  const draggingIdRef = useRef(null)
  const dragOverIdRef = useRef(null)
  const groupsRef = useRef({})

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const modeMap = Object.fromEntries(paymentModes.map((m) => [m.id, m]))

  let filtered = expenses.filter((e) => {
    if (filterCat && e.category_id !== filterCat) return false
    if (filterMode && e.payment_mode_id !== filterMode) return false
    if (filterPerson && e.paid_by !== filterPerson) return false
    return true
  })

  if (sortBy === 'amount_desc') filtered = [...filtered].sort((a, b) => b.amount - a.amount)
  if (sortBy === 'amount_asc') filtered = [...filtered].sort((a, b) => a.amount - b.amount)

  // Group by day label + date combo
  const groups = {}
  const groupOrder = []
  filtered.forEach((e) => {
    const datePart = e.expense_date
      ? new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null
    const key = e.day_label && datePart
      ? `${e.day_label} — ${datePart}`
      : e.day_label || datePart || 'Other'
    if (!groups[key]) { groups[key] = []; groupOrder.push(key) }
    groups[key].push(e)
  })
  // Keep a ref copy for use inside drop handler (avoids stale closure)
  groupsRef.current = groups

  const handleDragStart = (ev, id) => {
    draggingIdRef.current = id
    dragOverIdRef.current = null
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', id)
    setDragState({ draggingId: id, dragOverId: null })
  }

  const handleDragEnter = (ev, id) => {
    ev.preventDefault()
    if (id === draggingIdRef.current) return
    dragOverIdRef.current = id
    setDragState((s) => ({ ...s, dragOverId: id }))
  }

  const handleDragOver = (ev) => {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (ev, groupKey) => {
    ev.preventDefault()

    const fromId = draggingIdRef.current
    const toId = dragOverIdRef.current

    // Reset visual state immediately
    draggingIdRef.current = null
    dragOverIdRef.current = null
    setDragState({ draggingId: null, dragOverId: null })

    if (!fromId || !toId || fromId === toId) return

    const items = groupsRef.current[groupKey]
    if (!items) return

    const fromIdx = items.findIndex((x) => x.id === fromId)
    const toIdx = items.findIndex((x) => x.id === toId)

    if (fromIdx === -1 || toIdx === -1) return

    // Build new order
    const reordered = [...items]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    // Save to DB
    await Promise.all(
      reordered.map((item, idx) =>
        supabase.from('expenses').update({ sort_order: idx }).eq('id', item.id)
      )
    )
    onReordered()
  }

  const handleDragEnd = () => {
    // Only clear visuals — don't touch refs here, drop may not have fired yet on some browsers
    // Small delay to let onDrop finish first
    setTimeout(() => {
      draggingIdRef.current = null
      dragOverIdRef.current = null
      setDragState({ draggingId: null, dragOverId: null })
    }, 50)
  }

  const exportCSV = () => {
    if (expenses.length === 0) return
    const header = ['Day', 'Date', 'Time', 'Description', 'Category', `Amount (${project.currency})`, 'Paid By', 'Payment Mode', 'Split Among', 'Each Person Pays', 'Notes']
    const rows = expenses.map((e) => [
      e.day_label || '', e.expense_date || '', e.expense_time || '',
      e.description, catMap[e.category_id]?.name || '', e.amount,
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
        <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="default">Sort: default</option>
          <option value="amount_desc">Highest first</option>
          <option value="amount_asc">Lowest first</option>
        </select>
        <button className="btn btn-secondary" onClick={exportCSV}>⬇️ CSV</button>
      </div>

      {sortBy === 'default' && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
          💡 Drag the ⠿ handle to reorder expenses within a day group
        </p>
      )}

      {groupOrder.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <p>{expenses.length === 0 ? 'No expenses yet. Add your first one!' : 'No expenses match the filters.'}</p>
        </div>
      ) : (
        groupOrder.map((groupKey) => {
          const exps = groups[groupKey]
          const groupTotal = exps.reduce((s, e) => s + Number(e.amount), 0)
          return (
            <div
              key={groupKey}
              className="day-group"
              onDragOver={handleDragOver}
              onDrop={(ev) => handleDrop(ev, groupKey)}
            >
              <div className="day-label">{groupKey}</div>
              {exps.map((e) => {
                const isDragging = dragState.draggingId === e.id
                const isOver = dragState.dragOverId === e.id
                return (
                  <div
                    key={e.id}
                    className="expense-card"
                    draggable={sortBy === 'default'}
                    onDragStart={(ev) => handleDragStart(ev, e.id)}
                    onDragEnter={(ev) => handleDragEnter(ev, e.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      opacity: isDragging ? 0.3 : 1,
                      border: isOver ? '2px solid var(--accent)' : undefined,
                      transform: isOver ? 'scale(1.01)' : undefined,
                      transition: 'opacity 0.1s, transform 0.1s',
                    }}
                  >
                    <div className="expense-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {sortBy === 'default' && (
                          <span
                            style={{ color: 'var(--text3)', fontSize: 18, cursor: 'grab', userSelect: 'none', flexShrink: 0 }}
                            title="Drag to reorder"
                          >⠿</span>
                        )}
                        <div className="expense-desc">{e.description}</div>
                        {e.expense_time && (
                          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>🕐 {e.expense_time}</span>
                        )}
                      </div>
                      <div className="expense-meta">
                        <span className="badge badge-cat">{catMap[e.category_id]?.name}</span>
                        <span className="badge badge-mode">{modeMap[e.payment_mode_id]?.name}</span>
                        <span className="badge badge-paid">Paid by {memberMap[e.paid_by]?.display_name}</span>
                      </div>
                      <div className="expense-split">
                        Split among: {e.split_among.map((id) => memberMap[id]?.display_name).join(', ')} · Each: {formatCurrency(e.amount / e.split_among.length, project.currency)}
                      </div>
                      {e.notes && <div className="expense-notes">{e.notes}</div>}
                    </div>
                    <div className="expense-right">
                      <div className="expense-amount">{formatCurrency(e.amount, project.currency)}</div>
                      <div className="expense-actions">
                        <button className="btn-ghost btn-sm" onClick={() => onEdit(e)}>✏️</button>
                        <button className="btn-danger" onClick={() => { if (confirm('Move to trash?')) onDeleted(e) }}>🗑</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="day-total">Group total: {formatCurrency(groupTotal, project.currency)}</div>
            </div>
          )
        })
      )}
    </div>
  )
}
