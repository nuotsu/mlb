export function processTransactions(transactions: MLB.Transaction[]) {
	const processed = new Set<number>()
	return transactions.filter((t) => {
		if (processed.has(t.id)) return false
		processed.add(t.id)
		return true
	})
}
