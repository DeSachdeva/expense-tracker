import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/balances'

const RETENTION_DAYS = 30

export default function TrashTab({ projectId, project, memberMap, onRestored }) {
  const [trashedExpenses, setTrashedExpenses] = useState([])
  const [trashedSettlements, setTrashedSettlements] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()
    const [expRes, setRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('project_id', projectId).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('settlement_payments').select('*').eq('project_id', projectId).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
    ])
    setTrashedExpenses(expRes.data || [])
    setTrashedSettlements(setRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [projectId])

  const restoreExpense = async (e) => {
    const { error } = await supabase.from('expenses').update({ deleted_at: null }).eq('id', e.id)
    if (!error) { await load(); onRestored(`Restored expense "${e.description}"`) }
  }

  const restoreSettlement = async (s) => {
    const { error } = await supabase.from('settlement_payments').update({ deleted_at: null }).eq('id', s.id)
    if (!error) { await load(); onRestored(`Restored payment record: ${memberMap[s.from_member]?.display_name} → ${memberMap[s.to_member]?.display_name}`) }
  }

  const permanentlyDelete = async (table, id) => {
    if (!confirm('Permanently delete this — it cannot be recovered after this. Continue?')) return
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  if (loading) return <p style={{ color: 'var(--text2)' }}>Loading trash...</p>

  const empty = trashedExpenses.length === 0 && trashedSettlements.length === 0

  return (
    <div>
      <div className="trash-banner">
        <span>Deleted items stay here for {RETENTION_DAYS} days and can be restored anytime before that.</span>
      </div>

      {empty ? (
        <div className="empty-state"><div className="empty-icon">🗑️</div><p>Trash is empty.</p></div>
      ) : (
        <>
          {trashedExpenses.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Deleted expenses</h3>
              {trashedExpenses.map((e) => (
                <div className="expense-card" key={e.id}>
                  <div className="expense-main">
                    <div className="expense-desc">{e.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Deleted {new Date(e.deleted_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div className="expense-right">
                    <div className="expense-amount">{formatCurrency(e.amount, project.currency)}</div>
                    <div className="expense-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => restoreExpense(e)}>♻️ Restore</button>
                      <button className="btn-danger" onClick={() => permanentlyDelete('expenses', e.id)}>Delete forever</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {trashedSettlements.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Deleted settlement payments</h3>
              {trashedSettlements.map((s) => (
                <div className="settlement-record" key={s.id}>
                  <div className="sr-main">
                    <span>{memberMap[s.from_member]?.display_name} → {memberMap[s.to_member]?.display_name}</span>
                    <span className="sr-amount">{formatCurrency(s.amount, project.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => restoreSettlement(s)}>♻️ Restore</button>
                    <button className="btn-danger" onClick={() => permanentlyDelete('settlement_payments', s.id)}>Delete forever</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
