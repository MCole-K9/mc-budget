import { form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { getPb } from '$lib/server/db';
import { TransactionSchema, WalletSchema, TransferFormSchema } from '$lib/schemas/budget';
import { fetchRates } from '$lib/server/exchangeRates';
import { getTransactions } from '$lib/transactions.remote';
import { getWallet, getWallets } from '$lib/wallets.remote';

export const transferBetweenWallets = form(TransferFormSchema, async (input) => {
	if (input.sourceWalletId === input.destWalletId) {
		invalid('Source and destination wallets must be different');
	}

	const pb = getPb();
	const wallets = await pb.collection('wallets').getFullList({
		filter: `id = "${input.sourceWalletId}" || id = "${input.destWalletId}"`,
		requestKey: null
	});
	const sourceWalletRecord = wallets.find((w) => w.id === input.sourceWalletId);
	const destWalletRecord = wallets.find((w) => w.id === input.destWalletId);

	if (!sourceWalletRecord) {
		invalid('Source wallet not found');
	}
	if (!destWalletRecord) {
		invalid('Destination wallet not found');
	}

	const sourceWallet = WalletSchema.parse(sourceWalletRecord);
	const destWallet = WalletSchema.parse(destWalletRecord);

	let creditAmount = input.amount;
	if (sourceWallet.currency !== destWallet.currency) {
		const rates = await fetchRates(sourceWallet.currency);
		const rate = rates[destWallet.currency];
		if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) {
			invalid(
				`Could not get exchange rate from ${sourceWallet.currency} to ${destWallet.currency}. Please try again later.`
			);
		}
		creditAmount = Math.round(input.amount * rate * 100) / 100;
	}

	const transferId = crypto.randomUUID();

	let debit: unknown;
	let credit: unknown;
	let sourceWalletUpdated = false;
	let destWalletUpdated = false;

	try {
		debit = await pb.collection('transactions').create({
			wallet: input.sourceWalletId,
			category: 'Transfer',
			amount: -input.amount,
			description: input.description?.trim() || `Transfer to ${destWallet.name}`,
			date: input.date,
			transfer_id: transferId
		}, { requestKey: null });

		credit = await pb.collection('transactions').create({
			wallet: input.destWalletId,
			category: 'Transfer',
			amount: creditAmount,
			description: input.description?.trim() || `Transfer from ${sourceWallet.name}`,
			date: input.date,
			transfer_id: transferId
		}, { requestKey: null });

		await pb.collection('wallets').update(input.sourceWalletId, {
			balance: sourceWallet.balance - input.amount
		}, { requestKey: null });
		sourceWalletUpdated = true;

		await pb.collection('wallets').update(input.destWalletId, {
			balance: destWallet.balance + creditAmount,
			total_funded: destWallet.total_funded + creditAmount
		}, { requestKey: null });
		destWalletUpdated = true;
	} catch (error) {
		const rollbackErrors: string[] = [];

		if (destWalletUpdated) {
			try {
				await pb.collection('wallets').update(input.destWalletId, {
					balance: destWallet.balance
				}, { requestKey: null });
			} catch {
				rollbackErrors.push('destination wallet rollback failed');
			}
		}

		if (sourceWalletUpdated) {
			try {
				await pb.collection('wallets').update(input.sourceWalletId, {
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

	getTransactions(input.sourceWalletId).refresh();
	getWallet(input.sourceWalletId).refresh();
	getWallets().refresh();

	return {
		debit: TransactionSchema.parse(debit),
		credit: TransactionSchema.parse(credit)
	};
});
