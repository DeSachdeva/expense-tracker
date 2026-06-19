import { calculateRawBalances, applySettlements, computeSettlementPlan, formatCurrency } from '../lib/balances'

export default function SettleUpTab({ project, members, expenses, settlements }) {
  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💸</div>
        <p>Add expenses first to see the settlement.</p>
      </div>
    )
  }

  const rawBalances = calculateRawBalances(members, expenses)
  const adjustedBalances = applySettlements(rawBalances, settlements)
  const transactions = computeSettlementPlan(adjustedBalances, members)
  const totalSettled = settlements.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div>
      {totalSettled > 0 && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid #86efac', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--green)', marginBottom: 16 }}>
          ✅ {formatCurrency(totalSettled, project.currency)} in payments already recorded — balances below reflect this.
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="all-settled">🎉 All settled up! No remaining payments needed.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14, fontWeight: 500 }}>
            {transactions.length} payment{transactions.length > 1 ? 's' : ''} still needed
          </div>
          {transactions.map((t, i) => (
            <div className="settle-card" key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>{t.fromName}</div>
              <div style={{ color: 'var(--text3)', fontSize: 20 }}>→</div>
              <div style={{ flex: 1, textAlign: 'center' }}><div className="settle-amt">{formatCurrency(t.amount, project.currency)}</div></div>
              <div style={{ color: 'var(--text3)', fontSize: 20 }}>→</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>{t.toName}</div>
              <div className="settle-hint">{t.fromName} still needs to pay {formatCurrency(t.amount, project.currency)} to {t.toName}</div>
            </div>
          ))}
        </>
      )}

      <div className="summary-card" style={{ marginTop: 20 }}>
        <h3>Current balance summary</h3>
        <table className="st">
          <thead><tr><th>Person</th><th>Raw balance</th><th>After settlements</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.display_name}</td>
                <td className={rawBalances[m.id] >= 0 ? 'positive' : 'negative'}>
                  {rawBalances[m.id] >= 0 ? 'gets back ' : 'owes '}{formatCurrency(Math.abs(rawBalances[m.id]), project.currency)}
                </td>
                <td className={adjustedBalances[m.id] >= 0 ? 'positive' : 'negative'}>
                  {adjustedBalances[m.id] >= 0 ? 'gets back ' : 'owes '}{formatCurrency(Math.abs(adjustedBalances[m.id]), project.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
