// Core balance & settlement math.
// rawBalance > 0 means "this member is owed money" (they paid more than their share).
// rawBalance < 0 means "this member owes money" (they consumed more than they paid).

export function calculateRawBalances(members, expenses) {
  const balances = {}
  members.forEach((m) => (balances[m.id] = 0))

  expenses.forEach((e) => {
    // credit the payer the full amount
    if (balances[e.paid_by] !== undefined) {
      balances[e.paid_by] += Number(e.amount)
    }
    // debit each split participant their share
    const share = Number(e.amount) / e.split_among.length
    e.split_among.forEach((memberId) => {
      if (balances[memberId] !== undefined) {
        balances[memberId] -= share
      }
    })
  })

  return balances
}

// Adjust raw balances using settlement payments already made between members.
// If member A sends a payment to member B:
//   - A's debt is reduced -> A's balance goes UP (+amount)
//   - B's credit is reduced (they've now received what they were owed) -> B's balance goes DOWN (-amount)
export function applySettlements(rawBalances, settlements) {
  const adjusted = { ...rawBalances }
  settlements.forEach((s) => {
    if (adjusted[s.from_member] !== undefined) adjusted[s.from_member] += Number(s.amount)
    if (adjusted[s.to_member] !== undefined) adjusted[s.to_member] -= Number(s.amount)
  })
  return adjusted
}

// Greedy minimum-transaction settlement algorithm.
// Returns a list of { from, to, amount } such that all balances reach ~0.
export function computeSettlementPlan(balances, members) {
  const creditors = []
  const debtors = []

  members.forEach((m) => {
    const b = balances[m.id] || 0
    if (b > 0.5) creditors.push({ id: m.id, name: m.display_name, balance: b })
    else if (b < -0.5) debtors.push({ id: m.id, name: m.display_name, balance: -b })
  })

  creditors.sort((a, b) => b.balance - a.balance)
  debtors.sort((a, b) => b.balance - a.balance)

  const transactions = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].balance, debtors[di].balance)
    if (amount > 0.5) {
      transactions.push({
        fromId: debtors[di].id,
        fromName: debtors[di].name,
        toId: creditors[ci].id,
        toName: creditors[ci].name,
        amount,
      })
    }
    creditors[ci].balance -= amount
    debtors[di].balance -= amount
    if (creditors[ci].balance < 0.5) ci++
    if (debtors[di].balance < 0.5) di++
  }

  return transactions
}

export function formatCurrency(amount, currency = 'INR') {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
  const symbol = symbols[currency] || currency + ' '
  const rounded = Math.round(Math.abs(amount))
  return `${amount < 0 ? '-' : ''}${symbol}${rounded.toLocaleString('en-IN')}`
}
