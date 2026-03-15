const cache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();
const TTL = 60 * 60 * 1000; // 1 hour

export async function fetchRates(baseCurrency: string): Promise<Record<string, number>> {
	const base = baseCurrency.toUpperCase();
	const cached = cache.get(base);
	if (cached && Date.now() - cached.fetchedAt < TTL) return cached.rates;
	try {
		const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
		const data = await res.json();
		if (data.result === 'success') {
			cache.set(base, { rates: data.rates, fetchedAt: Date.now() });
			return data.rates;
		}
	} catch {
		// fall through to fallback
	}
	return { [base]: 1 }; // graceful fallback: no conversion
}
