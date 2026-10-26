import { describe, it, expect } from 'vitest';
import { getCategoryBudgets, getEffectiveIncome, type WalletSummary } from './budget';
import type { Wallet } from '$lib/types/budget';

const wallet: Wallet = {
	id: 'w1',
	user: 'u1',
	name: 'Main',
	balance: 700,
	initial_balance: 0,
	total_funded: 1000,
	currency: 'USD',
	categories: [
		{ name: 'Food', percentage: 50, color: '#ff0000' },
		{ name: 'Fun', percentage: 50, color: '#00ff00' }
	],
	default_period: '',
	saved_periods: [],
	cycle_start_day: 1,
	budget_type: 'percentage',
	archived: false,
	carry_forward: false,
	created: '2026-01-01 10:00:00.000Z',
	updated: '2026-01-01 10:00:00.000Z'
};

const emptySummary: WalletSummary = {
	income: 0,
	transfersOut: 0,
	spendingByCategory: {},
	netAfterEnd: 0,
	budgetShiftByCategory: {},
	earmarkedIn: 0,
	earmarkedOut: 0,
	covers: []
};

const october = { startDate: '2026-10-01', endDate: '2026-10-31' };

describe('getEffectiveIncome', () => {
	it('uses period income minus transfers out', () => {
		const summary = { ...emptySummary, income: 1000, transfersOut: 200 };
		expect(getEffectiveIncome(wallet, summary, october)).toBe(800);
	});

	it('counts the starting balance only when the wallet was created in the period', () => {
		const w = { ...wallet, initial_balance: 500, created: '2026-10-31 18:00:00.000Z' };
		expect(getEffectiveIncome(w, emptySummary, october)).toBe(500);
		expect(getEffectiveIncome(w, emptySummary, { startDate: '2026-11-01', endDate: '2026-11-30' })).toBe(0);
	});

	it('leaves earmarked cover money out of all-time income', () => {
		const summary = { ...emptySummary, earmarkedIn: 100 };
		expect(getEffectiveIncome(wallet, summary, {})).toBe(900);
	});

	it('rebuilds the closing balance for carry forward, without cover money', () => {
		const w = { ...wallet, carry_forward: true };
		const summary = {
			...emptySummary,
			spendingByCategory: { food: 300 },
			netAfterEnd: -50,
			earmarkedIn: 100,
			earmarkedOut: 20
		};
		// 700 balance + 50 spent after the period − 100 cover in + 20 cover out + 300 spent
		expect(getEffectiveIncome(w, summary, october)).toBe(970);
	});
});

describe('getCategoryBudgets', () => {
	it('splits income by percentage and applies cover shifts', () => {
		const summary = {
			...emptySummary,
			spendingByCategory: { food: 650, fun: 100 },
			budgetShiftByCategory: { food: 150, fun: -150 }
		};
		const [food, fun] = getCategoryBudgets(wallet, summary, 1000);
		expect(food).toMatchObject({ name: 'Food', allocated: 650, spent: 650, remaining: 0 });
		expect(fun).toMatchObject({ name: 'Fun', allocated: 350, spent: 100, remaining: 250 });
	});

	it('uses fixed amounts for fixed wallets', () => {
		const fixed: Wallet = {
			...wallet,
			budget_type: 'fixed',
			categories: [{ name: 'Rent', percentage: 0, fixedAmount: 1200, color: '#0000ff' }]
		};
		const summary = { ...emptySummary, spendingByCategory: { rent: 1300 } };
		expect(getCategoryBudgets(fixed, summary, 0)[0].remaining).toBe(-100);
	});
});
