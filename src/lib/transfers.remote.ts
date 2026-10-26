import { form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { getPb } from '$lib/server/db';
import { WalletSchema, TransferFormSchema } from '$lib/schemas/budget';
import { getExchangeRate } from '$lib/server/exchangeRates';
import { createTransfer } from '$lib/server/transfers';
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

	const rate = await getExchangeRate(sourceWallet.currency, destWallet.currency);
	if (rate === null) {
		invalid(
			`Could not get exchange rate from ${sourceWallet.currency} to ${destWallet.currency}. Please try again later.`
		);
	}
	const creditAmount = rate === 1 ? input.amount : Math.round(input.amount * rate * 100) / 100;

	const { debit, credit } = await createTransfer(pb, {
		sourceWallet,
		destWallet,
		debitAmount: input.amount,
		creditAmount,
		date: input.date,
		debitDescription: input.description?.trim() || `Transfer to ${destWallet.name}`,
		creditDescription: input.description?.trim() || `Transfer from ${sourceWallet.name}`
	});

	getTransactions(input.sourceWalletId).refresh();
	getWallet(input.sourceWalletId).refresh();
	getWallets().refresh();

	return { debit, credit };
});
