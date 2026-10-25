import { describe, it, expect } from 'vitest';
import { getPayCycleRange } from './dateRange';

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
