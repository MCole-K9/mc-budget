import type PocketBase from 'pocketbase';
import type { CoverNote, WalletSummary } from '$lib/utils/budget';

/** Income, transfers, category spending and budget covers for one wallet over a date range. */
export async function computeWalletSummary(
	pb: PocketBase,
	input: { walletId: string; startDate?: string; endDate?: string }
): Promise<WalletSummary> {
	const walletFilter = `wallet = "${input.walletId}"`;
	const endOfDay = `${input.endDate} 23:59:59.999Z`;
	let dateFilter = '';
	if (input.startDate) dateFilter += ` && date >= "${input.startDate}"`;
	if (input.endDate) dateFilter += ` && date <= "${endOfDay}"`;

	const [records, laterRecords, coverRecords] = await Promise.all([
		pb.collection('transactions').getFullList({
			filter: walletFilter + dateFilter,
			fields: 'amount,category,transfer_id,balance_adjustment',
			requestKey: null
		}),
		// Dated after the period: subtracted from the current balance to get the period's closing balance
		input.endDate
			? pb.collection('transactions').getFullList({
					filter: `${walletFilter} && date > "${endOfDay}"`,
					fields: 'amount',
					requestKey: null
				})
			: Promise.resolve([]),
		pb.collection('budget_covers').getFullList({
			filter: `(${walletFilter} || source_wallet = "${input.walletId}")${dateFilter}`,
			expand: 'wallet,source_wallet',
			sort: 'date,created',
			requestKey: null
		})
	]);
	const netAfterEnd = laterRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

	const budgetShiftByCategory: Record<string, number> = {};
	const shift = (category: string, amount: number) => {
		const key = category.toLowerCase();
		budgetShiftByCategory[key] = (budgetShiftByCategory[key] ?? 0) + amount;
	};
	const coverTransferIds = new Set<string>();
	const covers: CoverNote[] = [];

	for (const c of coverRecords) {
		const id = String(c.id);
		const category = String(c.category);
		const sourceCategory = String(c.source_category);
		const sameWallet = c.source_wallet === c.wallet;
		if (c.transfer_id) coverTransferIds.add(String(c.transfer_id));

		if (c.wallet === input.walletId) {
			const amount = Number(c.amount) || 0;
			shift(category, amount);
			covers.push({
				id,
				direction: 'in',
				category,
				amount,
				counterpartCategory: sourceCategory,
				counterpartWalletName: sameWallet ? '' : String(c.expand?.['source_wallet']?.name ?? 'Deleted wallet')
			});
		}
		if (c.source_wallet === input.walletId) {
			const amount = Number(c.source_amount) || 0;
			shift(sourceCategory, -amount);
			covers.push({
				id,
				direction: 'out',
				category: sourceCategory,
				amount,
				counterpartCategory: category,
				counterpartWalletName: sameWallet ? '' : String(c.expand?.['wallet']?.name ?? '')
			});
		}
	}

	let income = 0;
	let transfersOut = 0;
	let earmarkedIn = 0;
	let earmarkedOut = 0;
	const spendingByCategory: Record<string, number> = {};

	for (const r of records) {
		const amount = Number(r.amount) || 0;
		if (r.balance_adjustment) continue;
		if (r.transfer_id && coverTransferIds.has(String(r.transfer_id))) {
			if (amount > 0) earmarkedIn += amount;
			else earmarkedOut += Math.abs(amount);
			continue;
		}
		if (r.transfer_id) {
			if (amount > 0) income += amount;
			else transfersOut += Math.abs(amount);
			continue;
		}
		if (amount > 0) {
			income += amount;
		} else {
			const cat = String(r.category).toLowerCase();
			spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + Math.abs(amount);
		}
	}

	return {
		income,
		transfersOut,
		spendingByCategory,
		netAfterEnd,
		budgetShiftByCategory,
		earmarkedIn,
		earmarkedOut,
		covers
	};
}
