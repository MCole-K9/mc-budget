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

export function toYmd(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's date as a YYYY-MM-DD string in local time. */
export function todayYmd(): string {
	return toYmd(new Date());
}

/**
 * Parse a date string (YYYY-MM-DD, ISO, or PocketBase format) into a local midnight Date.
 * Strips any time component before parsing to avoid UTC-shift issues.
 */
function parseLocalDate(dateStr: string): Date {
	return new Date(dateStr.split('T')[0].split(' ')[0] + 'T00:00:00');
}

/**
 * Format a date string as a long weekday label (e.g. "Thursday, March 26").
 * Appends the year when it differs from the current year.
 */
export function formatLongDate(dateStr: string, now = new Date()): string {
	const d = parseLocalDate(dateStr);
	return d.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' })
	});
}

/**
 * Format a date string with relative labels for today and yesterday,
 * falling back to formatLongDate.
 */
export function formatRelativeDate(dateStr: string, now = new Date()): string {
	const d = parseLocalDate(dateStr);
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (d.toDateString() === now.toDateString()) return 'Today';
	if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
	return formatLongDate(dateStr, now);
}

/**
 * Format a date string as a short label (e.g. "Mar 26, 2026").
 */
export function formatShortDate(dateStr: string): string {
	return parseLocalDate(dateStr).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/**
 * Format a YYYY-MM month string as a compact chart label (e.g. "Mar '26").
 * Uses day 2 to avoid any UTC month-boundary issue.
 */
export function formatMonthLabel(yyyyMm: string): string {
	return new Date(yyyyMm + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function getPayCycleRange(cycleStartDay: number, cycleOffset: number, now = new Date()): DateRange {
	const day = Math.min(cycleStartDay, 28);
	const baseOffset = now.getDate() >= day ? 0 : -1;
	const startDate = new Date(now.getFullYear(), now.getMonth() + baseOffset + cycleOffset, day);
	const endDate = new Date(now.getFullYear(), now.getMonth() + baseOffset + 1 + cycleOffset, day);
	return { startDate: toYmd(startDate), endDate: toYmd(endDate) };
}

export function getPayCycleOffsetForDate(targetDate: Date, cycleStartDay: number, now = new Date()): number {
	const day = Math.min(cycleStartDay, 28);
	const baseOffset = now.getDate() >= day ? 0 : -1;
	let targetStartMonth = targetDate.getMonth();
	let targetStartYear = targetDate.getFullYear();
	if (targetDate.getDate() < day) {
		targetStartMonth--;
		if (targetStartMonth < 0) { targetStartMonth = 11; targetStartYear--; }
	}
	return (targetStartYear - now.getFullYear()) * 12 + (targetStartMonth - now.getMonth()) - baseOffset;
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
