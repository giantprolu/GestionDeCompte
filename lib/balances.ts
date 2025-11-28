interface Account {
  id: string
  initialBalance: number
  isOwner?: boolean
}

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  accountId: string
}

// Retourne la valeur initiale de référence pour un compte.
// Si `overrides` contient une valeur (édition en cours), elle est prioritaire.
export function getBaseInitial(account: Account, overrides?: Record<string, number> | null) {
  if (!account) return 0
  if (overrides && typeof overrides[account.id] === 'number') return overrides[account.id]
  return account.initialBalance || 0
}

// Calculer le solde courant d'un compte en partant du solde de référence et en appliquant les transactions
export function getCurrentBalance(account: Account, transactions: Transaction[] = [], overrides?: Record<string, number> | null) {
  if (!account) return 0
  const base = getBaseInitial(account, overrides)
  const accountTx = transactions.filter(t => t.accountId === account.id)
  let balance = base
  for (const t of accountTx) {
    if (t.type === 'income') balance += t.amount
    else if (t.type === 'expense') balance -= t.amount
  }
  return balance
}

// Somme des soldes (option to use current balances or base initial)
export function sumBalances(accounts: Account[], transactions: Transaction[] = [], overrides?: Record<string, number> | null, opts?: { useCurrent?: boolean; onlyOwn?: boolean }) {
  const useCurrent = opts?.useCurrent || false
  const onlyOwn = opts?.onlyOwn || false
  const list = onlyOwn ? accounts.filter(a => a.isOwner !== false) : accounts
  return list.reduce((sum, acc) => sum + (useCurrent ? getCurrentBalance(acc, transactions, overrides) : getBaseInitial(acc, overrides)), 0)
}

export type { Account, Transaction }
