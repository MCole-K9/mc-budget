/**
 * Computes the balance deltas to apply to each wallet when deleting a set of
 * linked transfer transactions. Returns a map of walletId → balanceDelta.
 * Reversing a debit (negative amount) adds back to the source wallet.
 * Reversing a credit (positive amount) subtracts from the destination wallet.
 */
export function computeTransferDeleteDeltas(
	transactions: { wallet: string; amount: number }[]
): Map<string, number> {
	const deltas = new Map<string, number>();
	for (const tx of transactions) {
		deltas.set(tx.wallet, (deltas.get(tx.wallet) ?? 0) + (-tx.amount));
	}
	return deltas;
}

/**
 * Computes the wallet field patch needed when a transaction's amount changes.
 * Handles balance delta and total_funded adjustments for income/expense transitions.
 */
export function computeWalletPatch(
	existingAmount: number,
	finalAmount: number,
	currentBalance: number,
	currentTotalFunded: number
): { balance: number; total_funded?: number } {
	const patch: { balance: number; total_funded?: number } = {
		balance: currentBalance + (finalAmount - existingAmount)
	};

	if (existingAmount > 0 && finalAmount > 0) {
		// income → income: adjust total_funded by the difference
		patch.total_funded = currentTotalFunded + (finalAmount - existingAmount);
	} else if (existingAmount > 0 && finalAmount <= 0) {
		// income → expense: remove old income from total_funded
		patch.total_funded = currentTotalFunded - existingAmount;
	} else if (existingAmount <= 0 && finalAmount > 0) {
		// expense → income: add new income to total_funded
		patch.total_funded = currentTotalFunded + finalAmount;
	}
	// expense → expense: total_funded unchanged

	return patch;
}
