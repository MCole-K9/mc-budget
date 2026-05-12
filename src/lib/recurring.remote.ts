import { z } from 'zod';
import { query, command } from '$app/server';
import { getPb } from '$lib/server/db';
import { RecurringScheduleSchema } from '$lib/schemas/budget';

export const getRecurringSchedules = query(async () => {
	const records = await getPb().collection('recurring_schedules').getFullList({
		sort: 'wallet,active,recur_day',
		expand: 'wallet',
		requestKey: null
	});

	return records.map((r) => {
		const schedule = RecurringScheduleSchema.parse(r);
		const w = r.expand?.['wallet'] as Record<string, unknown> | undefined;
		const cats = Array.isArray(w?.categories)
			? (w.categories as { name: string; color: string }[])
			: [];
		const catColor = cats.find((c) => c.name.toLowerCase() === schedule.category.toLowerCase())?.color ?? null;
		return {
			...schedule,
			walletName: String(w?.name ?? ''),
			currency: String(w?.currency ?? 'USD'),
			categoryColor: catColor
		};
	});
});

export const updateRecurringSchedule = command(
	z.object({
		id: z.string().min(1),
		recur_day: z.number().min(1).max(28).optional(),
		amount: z.number().gt(0).optional(),
		active: z.boolean().optional()
	}),
	async (input) => {
		const pb = getPb();
		const existing = RecurringScheduleSchema.parse(
			await pb.collection('recurring_schedules').getOne(input.id, { requestKey: null })
		);

		const patch: Record<string, unknown> = {};
		if (input.recur_day !== undefined) patch.recur_day = input.recur_day;
		if (input.active !== undefined) patch.active = input.active;
		if (input.amount !== undefined) {
			// Preserve sign (expense stays negative, income stays positive)
			patch.amount = existing.amount < 0 ? -Math.abs(input.amount) : Math.abs(input.amount);
		}

		await pb.collection('recurring_schedules').update(input.id, patch);
		getRecurringSchedules().refresh();
	}
);

export const removeRecurringSchedule = command(
	z.object({ id: z.string().min(1) }),
	async ({ id }) => {
		const pb = getPb();

		// Clear recurring flag on all linked transactions before deleting
		const linked = await pb.collection('transactions').getFullList({
			filter: `recurring_source_id = "${id}"`,
			requestKey: null
		});
		for (const tx of linked) {
			await pb.collection('transactions').update(tx.id, {
				recurring: false,
				recurring_source_id: ''
			}, { requestKey: null });
		}

		await pb.collection('recurring_schedules').delete(id, { requestKey: null });
		getRecurringSchedules().refresh();
	}
);
