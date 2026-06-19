import { calculateRawBalances, applySettlements, formatCurrency } from '../lib/balances'

export default function SummaryTab({ project, members, expenses, settlements, categories, paymentModes, barColors }) {
  if (expenses.length === 0) {
    return <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>Add expenses to see the summary.</div>
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const modeMap = Object.fromEntries(paymentModes.map((m) => [m.id, m.name]))

  const paidTotals = {}
  members.forEach((m) => (paidTotals[m.id] = 0))
  expenses.forEach((e) => { if (paidTotals[e.paid_by] !== undefined) paidTotals[e.paid_by] += Number(e.amount) })

  const shareOwed = {}
  members.forEach((m) => (shareOwed[m.id] = 0))
  expenses.forEach((e) => {
    const share = Number(e.amount) / e.split_among.length
    e.split_among.forEach((id) => { if (shareOwed[id] !== undefined) shareOwed[id] += share })
  })

  const settlPaid = {}
  const settlRecv = {}
  members.forEach((m) => { settlPaid[m.id] = 0; settlRecv[m.id] = 0 })
  settlements.forEach((s) => {
    if (settlPaid[s.from_member] !== undefined) settlPaid[s.from_member] += Number(s.amount)
    if (settlRecv[s.to_member] !== undefined) settlRecv[s.to_member] += Number(s.amount)
  })

  const catTotals = {}
  const modeTotals = {}
  const paidChartData = {}
  expenses.forEach((e) => {
    const cName = catMap[e.category_id] || 'Uncategorized'
    const mName = modeMap[e.payment_mode_id] || 'Unknown'
    catTotals[cName] = (catTotals[cName] || 0) + Number(e.amount)
    modeTotals[mName] = (modeTotals[mName] || 0) + Number(e.amount)
  })
  members.forEach((m) => { if (paidTotals[m.id] > 0) paidChartData[m.display_name] = paidTotals[m.id] }) 

  return (
    <div>
      <div className="metric-grid">
        <div className="metric"><div className="lbl">Total spend</div><div className="val">{formatCurrency(total, project.currency)}</div></div>
        <div className="metric"><div className="lbl">Expenses</div><div className="val">{expenses.length}</div></div>
        <div className="metric"><div className="lbl">Settlements recorded</div><div className="val">{formatCurrency(settlements.reduce((s, p) => s + Number(p.amount), 0), project.currency)}</div></div>
        {members.map((m) => (
          <div className="metric" key={m.id}><div className="lbl">{m.display_name} paid</div><div className="val">{formatCurrency(paidTotals[m.id], project.currency)}</div></div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card"><h3>By category</h3><BarChart data={catTotals} total={total} colors={barColors} /></div>
        <div className="chart-card"><h3>By payment mode</h3><BarChart data={modeTotals} total={total} colors={barColors} /></div>
      </div>
      <div className="chart-grid">
        <div className="chart-card"><h3>Who paid what</h3><BarChart data={paidChartData} total={total} colors={barColors} /></div>
        <div className="chart-card"><h3>Settlements made</h3>
          {settlements.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text3)' }}>None yet.</p> :
            <BarChart data={Object.fromEntries(members.filter(m => settlPaid[m.id] > 0).map(m => [m.display_name, settlPaid[m.id]]))} total={settlements.reduce((s,p)=>s+Number(p.amount),0)} colors={barColors} />}
        </div>
      </div>

      <div className="summary-card">
        <h3>Per-person breakdown</h3>
        <table className="st">
          <thead><tr><th>Person</th><th>Total paid</th><th>Share owed</th><th>Settlements paid</th><th>Net balance</th></tr></thead>
          <tbody>
            {members.map((m) => {
              const rawNet = paidTotals[m.id] - shareOwed[m.id]
              // sent settlement reduces debt (balance up); received settlement reduces credit (balance down)
              const net = rawNet + settlPaid[m.id] - settlRecv[m.id]
              return (
                <tr key={m.id}>
                  <td>{m.display_name}</td>
                  <td>{formatCurrency(paidTotals[m.id], project.currency)}</td>
                  <td>{formatCurrency(shareOwed[m.id], project.currency)}</td>
                  <td style={{ color: 'var(--green)' }}>{formatCurrency(settlPaid[m.id], project.currency)}</td>
                  <td className={net >= 0 ? 'positive' : 'negative'}>{net >= 0 ? 'gets back ' : 'owes '}{formatCurrency(Math.abs(net), project.currency)}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td>Total</td><td>{formatCurrency(total, project.currency)}</td><td>{formatCurrency(total, project.currency)}</td>
              <td>{formatCurrency(settlements.reduce((s,p)=>s+Number(p.amount),0), project.currency)}</td><td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BarChart({ data, total, colors, showPct = true }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return <p style={{ fontSize: 12, color: 'var(--text3)' }}>No data yet.</p>
  const max = sorted[0]?.[1] || 1
  return (
    <div>
      {sorted.map(([k, v], i) => (
        <div className="bar-row" key={k}>
          <div className="bar-label-row"><span>{k}</span><span style={{ fontWeight: 600 }}>{Math.round(v).toLocaleString('en-IN')}</span></div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(v / max * 100).toFixed(1)}%`, background: colors[i % colors.length] }} /></div>
          {showPct && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{(v / total * 100).toFixed(1)}% of total</div>}
        </div>
      ))}
    </div>
  )
}
