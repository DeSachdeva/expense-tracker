import { useState, useRef, useEffect, useCallback } from 'react'
import { formatCurrency } from '../lib/balances'
import { supabase } from '../lib/supabase'

// ── Drag state lives entirely in refs — no async state issues ──
function useDragToReorder(getItems, onDone) {
  const dragging = useRef(null)  // { id, groupKey, startY, currentIndex }
  const positions = useRef({})   // id -> { top, height, el }
  const [overIndex, setOverIndex] = useState(null)
  const [draggingId, setDraggingId] = useState(null)

  const registerEl = useCallback((id, el) => {
    if (el) positions.current[id] = el
    else delete positions.current[id]
  }, [])

  const onMouseDown = useCallback((e, id, groupKey) => {
    // Only trigger on the handle (left mouse button)
    if (e.button !== 0) return
    e.preventDefault()
    dragging.current = { id, groupKey, startY: e.clientY }
    setDraggingId(id)
    setOverIndex(null)
  }, [])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return
      const { id, groupKey } = dragging.current
      const items = getItems(groupKey)
      if (!items) return

      const currentY = e.clientY
      let targetIndex = null

      items.forEach((item, idx) => {
        const el = positions.current[item.id]
        if (!el) return
        const rect = el.getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        if (currentY < midY && targetIndex === null) {
          targetIndex = idx
        }
      })
      if (targetIndex === null) targetIndex = items.length - 1

      // find current index of dragging item
      const fromIdx = items.findIndex((x) => x.id === id)
      if (targetIndex !== fromIdx) {
        setOverIndex(targetIndex)
      }
    }

    const onMouseUp = async (e) => {
      if (!dragging.current) return
      const { id, groupKey } = dragging.current
      const items = getItems(groupKey)
      dragging.current = null
      setDraggingId(null)

      if (!items || overIndex === null) { setOverIndex(null); return }

      const fromIdx = items.findIndex((x) => x.id === id)
      if (fromIdx === -1 || overIndex === fromIdx) { setOverIndex(null); return }

      const reordered = [...items]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(overIndex, 0, moved)
      setOverIndex(null)

      await Promise.all(
        reordered.map((item, idx) =>
          supabase.from('expenses').update({ sort_order: idx }).eq('id', item.id)
        )
      )
      onDone()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [overIndex, getItems, onDone])

  return { onMouseDown, registerEl, draggingId, overIndex }
}

export default function ExpenseList({ project, expenses, members, memberMap, categories, paymentModes, onEdit, onDeleted, onReordered }) {
  const [filterCat, setFilterCat] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [filterPerson, setFilterPerson] = useState('')
  const [sortBy, setSortBy] = useState('default')

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

  // Group
  const groups = {}
  const groupOrder = []
  filtered.forEach((e) => {
    const datePart = e.expense_date
      ? new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null
    const key = e.day_label && datePart ? `${e.day_label} — ${datePart}`
      : e.day_label || datePart || 'Other'
    if (!groups[key]) { groups[key] = []; groupOrder.push(key) }
    groups[key].push(e)
  })

  const getItems = useCallback((groupKey) => groups[groupKey], [filtered])
  const { onMouseDown, registerEl, draggingId, overIndex } = useDragToReorder(getItems, onReordered)

  const exportCSV = () => {
    if (expenses.length === 0) return
    const header = ['Day','Date','Time','Description','Category',`Amount (${project.currency})`,'Paid By','Payment Mode','Split Among','Each Person Pays','Notes']
    const rows = expenses.map((e) => [
      e.day_label||'', e.expense_date||'', e.expense_time||'',
      e.description, catMap[e.category_id]?.name||'', e.amount,
      memberMap[e.paid_by]?.display_name||'', modeMap[e.payment_mode_id]?.name||'',
      e.split_among.map((id) => memberMap[id]?.display_name).join(' + '),
      (e.amount/e.split_among.length).toFixed(2), e.notes||'',
    ])
    const csv = [header,...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `${project.name.replace(/\s+/g,'_')}_expenses.csv`
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
          💡 Hold ⠿ and drag to reorder within a day group
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
            <div key={groupKey} className="day-group">
              <div className="day-label">{groupKey}</div>
              {exps.map((e, idx) => {
                const isDragging = draggingId === e.id
                const isTarget = draggingId && draggingId !== e.id && overIndex === idx
                return (
                  <div
                    key={e.id}
                    ref={(el) => registerEl(e.id, el)}
                    className="expense-card"
                    style={{
                      opacity: isDragging ? 0.35 : 1,
                      borderTop: isTarget ? '3px solid var(--accent)' : undefined,
                      transition: 'opacity 0.1s',
                      userSelect: 'none',
                    }}
                  >
                    <div className="expense-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {sortBy === 'default' && (
                          <span
                            onMouseDown={(ev) => onMouseDown(ev, e.id, groupKey)}
                            style={{
                              color: 'var(--text3)', fontSize: 18,
                              cursor: draggingId ? 'grabbing' : 'grab',
                              userSelect: 'none', flexShrink: 0, padding: '2px 4px'
                            }}
                            title="Hold and drag to reorder"
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
