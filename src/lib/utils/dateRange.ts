export type DateRange = {
	startDate?: string;
	endDate?: string;
};

const COMMON_PERIODS = new Set([
	'this-month',
	'last-month',
	'last-3-months',
	'this-year',
	'all-time'
]);

function toYmd(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getStandardPeriodRange(period: string, now = new Date()): DateRange | null {
	if (!COMMON_PERIODS.has(period)) return null;

	if (period === 'all-time') return {};

	const year = now.getFullYear();
	const month = now.getMonth();

	if (period === 'this-month') {
		return {
			startDate: toYmd(new Date(year, month, 1)),
			endDate: toYmd(new Date(year, month + 1, 0))
		};
	}

	if (period === 'last-month') {
		return {
			startDate: toYmd(new Date(year, month - 1, 1)),
			endDate: toYmd(new Date(year, month, 0))
		};
	}

	if (period === 'last-3-months') {
		return {
			startDate: toYmd(new Date(year, month - 2, 1)),
			endDate: toYmd(new Date(year, month + 1, 0))
		};
	}

	return {
		startDate: `${year}-01-01`,
		endDate: `${year}-12-31`
	};
}
