import { z } from 'zod';
import { query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPb } from '$lib/server/db';
import { computeWalletSummary } from '$lib/server/walletSummary';
import { getExchangeRate } from '$lib/server/exchangeRates';
import { createTransfer, deleteTransfer } from '$lib/server/transfers';
import { deleteTransferWithCovers } from '$lib/server/budgetCovers';
import { WalletSchema, type Wallet } from '$lib/schemas/budget';
import { getBudgetPeriodForDate } from '$lib/utils/dateRange';
import { getCategoryBudgets, getEffectiveIncome } from '$lib/utils/budget';
import { getTransactions } from '$lib/transactions.remote';
import { getWallet } from '$lib/wallets.remote';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

async function loadWallet(id: string): Promise<Wallet> {
	return WalletSchema.parse(await getPb().collection('wallets').getOne(id, { requestKey: null }));
}

function findCategory(wallet: Wallet, name: string) {
	const category = wallet.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
	if (!category) error(400, `Category "${name}" does not exist in ${wallet.name}`);
	return category;
}

/**
 * Category budgets for the wallet's default period containing `date` (see getBudgetPeriodForDate).
 * `today` is the client's local date, so relative periods match what the user sees.
 */
export const getCategoryBudgetsForDate = query(
	z.object({ walletId: z.string().min(1), date: ymd, today: ymd }),
	async ({ walletId, date, today }) => {
		const wallet = await loadWallet(walletId);
		const { period, ...range } = getBudgetPeriodForDate(wallet, date, new Date(`${today}T00:00:00`));
		const summary = await computeWalletSummary(getPb(), { walletId, ...range });
		return {
			period,
			...range,
			categories: getCategoryBudgets(wallet, summary, getEffectiveIncome(wallet, summary, range))
		};
	}
);

/**
 * Moves `amount` of budget onto an over-budget category from another category. From another
 * wallet, the money moves too: `amount` is transferred in (converted from the source currency).
 */
export const coverOverage = command(
	z.object({
		walletId: z.string().min(1),
		category: z.string().min(1),
		amount: z.number().gt(0, 'Amount must be greater than 0'),
		date: ymd,
		sourceWalletId: z.string().min(1),
		sourceCategory: z.string().min(1)
	}),
	async (input) => {
		const pb = getPb();
		const wallet = await loadWallet(input.walletId);
		const category = findCategory(wallet, input.category);
		const sameWallet = input.sourceWalletId === input.walletId;
		const sourceWallet = sameWallet ? wallet : await loadWallet(input.sourceWalletId);
		const sourceCategory = findCategory(sourceWallet, input.sourceCategory);

		if (sameWallet && sourceCategory.name === category.name) {
			error(400, 'Choose a different category to cover the overage');
		}

		const amount = Math.round(input.amount * 100) / 100;
		let sourceAmount = amount;
		let transferId = '';

		if (!sameWallet) {
			// Units of the source currency per unit of this wallet's currency
			const rate = await getExchangeRate(wallet.currency, sourceWallet.currency);
			if (rate === null) {
				error(503, `Could not get exchange rate from ${wallet.currency} to ${sourceWallet.currency}. Please try again later.`);
			}
			sourceAmount = rate === 1 ? amount : Math.round(amount * rate * 100) / 100;

			const transfer = await createTransfer(pb, {
				sourceWallet,
				destWallet: wallet,
				debitAmount: sourceAmount,
				creditAmount: amount,
				date: input.date,
				debitDescription: `Covers ${category.name} overage in ${wallet.name}`,
				creditDescription: `${category.name} overage covered from ${sourceWallet.name}`
			});
			transferId = transfer.transferId;
		}

		try {
			await pb.collection('budget_covers').create({
				wallet: wallet.id,
				category: category.name,
				amount,
				source_wallet: sourceWallet.id,
				source_category: sourceCategory.name,
				source_amount: sourceAmount,
				date: input.date,
				transfer_id: transferId
			}, { requestKey: null });
		} catch (err) {
			// Don't leave money moved without the cover that explains it
			if (transferId) await deleteTransfer(pb, transferId);
			throw err;
		}

		if (!sameWallet) {
			refreshBalances(wallet.id);
			refreshBalances(sourceWallet.id);
		}
		return { success: true };
	}
);

/**
 * Removes a cover; a cross-wallet cover's transfer is reversed too. If the source wallet has been
 * deleted there is nowhere to return the money, so it stays here as ordinary income.
 */
export const removeBudgetCover = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const pb = getPb();
	const cover = await pb.collection('budget_covers').getOne(id, { requestKey: null });
	const transferId = String(cover.transfer_id || '');

	if (transferId && cover.source_wallet) {
		const touchedWalletIds = await deleteTransferWithCovers(pb, transferId);
		for (const walletId of touchedWalletIds) refreshBalances(walletId);
	} else {
		await pb.collection('budget_covers').delete(id, { requestKey: null });
	}
	return { success: true };
});

function refreshBalances(walletId: string) {
	getTransactions(walletId).refresh();
	getWallet(walletId).refresh();
}
