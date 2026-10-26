import type { Wallet } from '$lib/types/budget';
import { isDateInRange, type DateRange } from './dateRange';

/** A budget cover as seen from one wallet: money's budget moving into or out of one of its categories. */
export type CoverNote = {
	id: string;
	direction: 'in' | 'out';
	/** This wallet's category the cover moves budget into ('in') or out of ('out') */
	category: string;
	/** In this wallet's currency */
	amount: number;
	counterpartCategory: string;
	/** Empty for a same-wallet cover */
	counterpartWalletName: string;
};

export type WalletSummary = {
	income: number;
	transfersOut: number;
	spendingByCategory: Record<string, number>;
	/** Net of transactions dated after the period, to rebuild the period's closing balance */
	netAfterEnd: number;
	/** Budget moved into (+) or out of (−) each category by covers, keyed by lowercased name */
	budgetShiftByCategory: Record<string, number>;
	/** Cover transfer money received / sent; budgeted to one category instead of counted as income */
	earmarkedIn: number;
	earmarkedOut: number;
	covers: CoverNote[];
};

export type CategoryBudget = {
	name: string;
	color: string;
	allocated: number;
	spent: number;
	remaining: number;
};

/** Smallest overage worth prompting about (avoids floating-point noise) */
export const OVERAGE_EPSILON = 0.005;

/**
 * Income available to split across a percentage wallet's categories in a period.
 * An empty range means all time.
 */
export function getEffectiveIncome(wallet: Wallet, summary: WalletSummary, range: DateRange): number {
	const isAllTime = !range.startDate && !range.endDate;
	const createdInRange = isDateInRange(range, wallet.created.split('T')[0].split(' ')[0]);

	// All time: total_funded is initial_balance + all income + incoming transfers (cover transfers included)
	const periodIncome = isAllTime
		? wallet.total_funded - summary.earmarkedIn
		: summary.income + (createdInRange ? wallet.initial_balance : 0);

	if (wallet.carry_forward) {
		// The period's closing balance re-grossed by its spending, minus cover money in the period
		const spent = Object.values(summary.spendingByCategory).reduce((s, v) => s + v, 0);
		return Math.max(
			0,
			wallet.balance - summary.netAfterEnd - summary.earmarkedIn + summary.earmarkedOut + spent
		);
	}
	return Math.max(0, periodIncome - summary.transfersOut);
}

/** Allocated, spent and remaining per category, including budget moved by covers. */
export function getCategoryBudgets(
	wallet: Wallet,
	summary: WalletSummary,
	effectiveIncome: number
): CategoryBudget[] {
	return wallet.categories.map((c) => {
		const key = c.name.toLowerCase();
		const base =
			wallet.budget_type === 'fixed' ? (c.fixedAmount ?? 0) : (effectiveIncome * c.percentage) / 100;
		const allocated = base + (summary.budgetShiftByCategory[key] ?? 0);
		const spent = summary.spendingByCategory[key] ?? 0;
		return { name: c.name, color: c.color, allocated, spent, remaining: allocated - spent };
	});
}
