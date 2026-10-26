/** Format an amount as currency (e.g. "$1,234.56"); falls back to USD when no currency is given. */
export function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(
		amount
	);
}

/** Format a signed amount with an explicit sign and a typographic minus (e.g. "−$12.00"); zero has no sign. */
export function formatSignedCurrency(amount: number, currency: string): string {
	const sign = amount < 0 ? '−' : amount > 0 ? '+' : '';
	return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

/** Group items into consecutive runs sharing the same calendar day (YYYY-MM-DD). */
export function groupByDate<T extends { date: string }>(
	items: T[]
): { date: string; items: T[] }[] {
	return items.reduce<{ date: string; items: T[] }[]>((acc, item) => {
		const day = item.date.split('T')[0].split(' ')[0];
		const last = acc[acc.length - 1];
		if (last?.date === day) last.items.push(item);
		else acc.push({ date: day, items: [item] });
		return acc;
	}, []);
}
