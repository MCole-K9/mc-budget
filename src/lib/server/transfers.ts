import type PocketBase from 'pocketbase';
import { TransactionSchema, WalletSchema, type Transaction, type Wallet } from '$lib/schemas/budget';
import { computeTransferDeleteDeltas } from '$lib/utils/balance';

/**
 * Moves money between two wallets as a linked debit/credit pair sharing a transfer_id.
 * `debitAmount` is in the source wallet's currency, `creditAmount` in the destination's.
 * Undoes everything it did if any step fails.
 */
export async function createTransfer(
	pb: PocketBase,
	input: {
		sourceWallet: Wallet;
		destWallet: Wallet;
		debitAmount: number;
		creditAmount: number;
		date: string;
		debitDescription: string;
		creditDescription: string;
	}
): Promise<{ transferId: string; debit: Transaction; credit: Transaction }> {
	const { sourceWallet, destWallet, debitAmount, creditAmount } = input;
	const transferId = crypto.randomUUID();

	let debit: unknown;
	let credit: unknown;
	// Set before each wallet update: a request can fail on the client after the server applied it,
	// and restoring the snapshot is harmless when the update never landed.
	let sourceWalletUpdateStarted = false;
	let destWalletUpdateStarted = false;

	try {
		debit = await pb.collection('transactions').create({
			wallet: sourceWallet.id,
			category: 'Transfer',
			amount: -debitAmount,
			description: input.debitDescription,
			date: input.date,
			transfer_id: transferId
		}, { requestKey: null });

		credit = await pb.collection('transactions').create({
			wallet: destWallet.id,
			category: 'Transfer',
			amount: creditAmount,
			description: input.creditDescription,
			date: input.date,
			transfer_id: transferId
		}, { requestKey: null });

		sourceWalletUpdateStarted = true;
		await pb.collection('wallets').update(sourceWallet.id, {
			balance: sourceWallet.balance - debitAmount
		}, { requestKey: null });

		destWalletUpdateStarted = true;
		await pb.collection('wallets').update(destWallet.id, {
			balance: destWallet.balance + creditAmount,
			total_funded: destWallet.total_funded + creditAmount
		}, { requestKey: null });
	} catch (error) {
		const rollbackErrors: string[] = [];

		if (destWalletUpdateStarted) {
			try {
				await pb.collection('wallets').update(destWallet.id, {
					balance: destWallet.balance,
					total_funded: destWallet.total_funded
				}, { requestKey: null });
			} catch {
				rollbackErrors.push('destination wallet rollback failed');
			}
		}

		if (sourceWalletUpdateStarted) {
			try {
				await pb.collection('wallets').update(sourceWallet.id, {
					balance: sourceWallet.balance
				}, { requestKey: null });
			} catch {
				rollbackErrors.push('source wallet rollback failed');
			}
		}

		if (credit && typeof credit === 'object' && credit !== null && 'id' in credit) {
			try {
				await pb.collection('transactions').delete(String(credit.id), { requestKey: null });
			} catch {
				rollbackErrors.push('credit transaction rollback failed');
			}
		}

		if (debit && typeof debit === 'object' && debit !== null && 'id' in debit) {
			try {
				await pb.collection('transactions').delete(String(debit.id), { requestKey: null });
			} catch {
				rollbackErrors.push('debit transaction rollback failed');
			}
		}

		if (rollbackErrors.length > 0) {
			throw new Error(
				`Transfer failed and automatic rollback was incomplete (${rollbackErrors.join(', ')}).`
			);
		}

		throw error;
	}

	return {
		transferId,
		debit: TransactionSchema.parse(debit),
		credit: TransactionSchema.parse(credit)
	};
}

/**
 * Deletes every transaction sharing `transferId` and reverses their effect on each wallet.
 * Restores the wallets and transactions if any step fails. Returns the ids of the wallets touched.
 */
export async function deleteTransfer(pb: PocketBase, transferId: string): Promise<string[]> {
	const transferTransactions = (await pb.collection('transactions').getFullList({
		filter: `transfer_id = "${transferId}"`,
		requestKey: null
	})).map((r) => TransactionSchema.parse(r));

	const walletSnapshots = new Map<string, { balance: number; total_funded: number }>();
	const touchedWallets = new Set<string>();
	const deletedTransactions: typeof transferTransactions = [];

	for (const tx of transferTransactions) {
		if (!walletSnapshots.has(tx.wallet)) {
			const w = WalletSchema.parse(
				await pb.collection('wallets').getOne(tx.wallet, { requestKey: null })
			);
			walletSnapshots.set(tx.wallet, {
				balance: w.balance,
				total_funded: w.total_funded
			});
		}
	}

	const walletDeltas = computeTransferDeleteDeltas(transferTransactions);

	// For each wallet, compute how much to reverse from total_funded (positive credits)
	const totalFundedDeltas = new Map<string, number>();
	for (const tx of transferTransactions) {
		if (tx.amount > 0) {
			totalFundedDeltas.set(tx.wallet, (totalFundedDeltas.get(tx.wallet) ?? 0) - tx.amount);
		}
	}

	try {
		for (const [walletToUpdate, balanceDelta] of walletDeltas) {
			const snapshot = walletSnapshots.get(walletToUpdate);
			if (!snapshot) throw new Error('Missing wallet snapshot during transfer delete');
			const totalFundedDelta = totalFundedDeltas.get(walletToUpdate);
			// Marked before the update: it may land on the server even if the request errors here
			touchedWallets.add(walletToUpdate);
			await pb.collection('wallets').update(walletToUpdate, {
				balance: snapshot.balance + balanceDelta,
				...(totalFundedDelta !== undefined && { total_funded: snapshot.total_funded + totalFundedDelta })
			}, { requestKey: null });
		}

		for (const tx of transferTransactions) {
			await pb.collection('transactions').delete(tx.id, { requestKey: null });
			deletedTransactions.push(tx);
		}
	} catch (error) {
		const rollbackErrors: string[] = [];

		for (const walletToRestore of touchedWallets) {
			const snapshot = walletSnapshots.get(walletToRestore);
			if (!snapshot) continue;
			try {
				await pb.collection('wallets').update(walletToRestore, {
					balance: snapshot.balance,
					total_funded: snapshot.total_funded
				}, { requestKey: null });
			} catch {
				rollbackErrors.push(`wallet rollback failed: ${walletToRestore}`);
			}
		}

		for (const tx of deletedTransactions) {
			try {
				await pb.collection('transactions').create({
					wallet: tx.wallet,
					category: tx.category,
					amount: tx.amount,
					description: tx.description,
					date: tx.date,
					recurring: tx.recurring,
					recur_day: tx.recur_day,
					recurring_source_id: tx.recurring_source_id,
					transfer_id: tx.transfer_id
				}, { requestKey: null });
			} catch {
				rollbackErrors.push(`transaction rollback failed: ${tx.id}`);
			}
		}

		if (rollbackErrors.length > 0) {
			throw new Error(
				`Delete transfer failed and rollback was incomplete (${rollbackErrors.join(', ')}).`
			);
		}

		throw error;
	}

	return [...walletDeltas.keys()];
}
