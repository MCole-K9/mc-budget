import { describe, it, expect } from 'vitest';
import { getBudgetPeriodForDate, getPayCycleRange } from './dateRange';

describe('getPayCycleRange', () => {
	const now = new Date(2026, 9, 25); // Oct 25, 2026

	it('ends the day before the next cycle starts', () => {
		expect(getPayCycleRange(15, 0, now)).toEqual({ startDate: '2026-10-15', endDate: '2026-11-14' });
	});

	it('does not overlap adjacent cycles', () => {
		const current = getPayCycleRange(15, 0, now);
		const next = getPayCycleRange(15, 1, now);
		expect(next.startDate! > current.endDate!).toBe(true);
	});

	it('ends on the last day of the month for cycles starting on day 1', () => {
		expect(getPayCycleRange(1, 0, now)).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31' });
		expect(getPayCycleRange(1, -8, now)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
	});

	it('uses the previous cycle before the start day', () => {
		const early = new Date(2026, 0, 10); // Jan 10, 2026
		expect(getPayCycleRange(15, 0, early)).toEqual({ startDate: '2025-12-15', endDate: '2026-01-14' });
	});
});

describe('getBudgetPeriodForDate', () => {
	const now = new Date(2026, 9, 25); // Oct 25, 2026
	const wallet = { default_period: '', saved_periods: [], cycle_start_day: 1 };

	it('uses the calendar month of the date by default', () => {
		expect(getBudgetPeriodForDate(wallet, '2026-08-17', now)).toEqual({
			period: 'month',
			startDate: '2026-08-01',
			endDate: '2026-08-31'
		});
	});

	it('uses the pay cycle containing the date', () => {
		const w = { ...wallet, default_period: 'pay-cycle', cycle_start_day: 15 };
		expect(getBudgetPeriodForDate(w, '2026-09-03', now)).toEqual({
			period: 'pay-cycle',
			startDate: '2026-08-15',
			endDate: '2026-09-14'
		});
	});

	it('uses a saved or standard default only when it contains the date', () => {
		const w = {
			...wallet,
			default_period: 'Q3',
			saved_periods: [{ name: 'Q3', startDate: '2026-07-01', endDate: '2026-09-30' }]
		};
		expect(getBudgetPeriodForDate(w, '2026-08-17', now)).toMatchObject({ period: 'Q3', startDate: '2026-07-01' });
		expect(getBudgetPeriodForDate(w, '2026-10-02', now)).toMatchObject({ period: 'month', startDate: '2026-10-01' });
		expect(getBudgetPeriodForDate({ ...wallet, default_period: 'all-time' }, '2020-01-05', now)).toEqual({
			period: 'all-time'
		});
	});
});
