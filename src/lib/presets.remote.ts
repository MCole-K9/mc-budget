import { z } from 'zod';
import { query, command } from '$app/server';
import { getPb } from '$lib/server/db';
import { BudgetPresetSchema, BudgetCategoriesSchema } from '$lib/schemas/budget';

export const getPresets = query(async () => {
	const records = await getPb().collection('presets').getFullList({ sort: 'name' });
	return records.map((r) => BudgetPresetSchema.parse(r));
});

const CreatePresetInputSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	description: z.string().max(500).default(''),
	categories: BudgetCategoriesSchema
});

export const createPreset = command(CreatePresetInputSchema, async (input) => {
	const pb = getPb();
	const user = pb.authStore.record;
	if (!user) throw new Error('Must be authenticated to create a preset');

	const record = await pb.collection('presets').create({
		name: input.name.trim(),
		description: input.description,
		categories: input.categories,
		user: user.id
	});

	getPresets().refresh();
	return BudgetPresetSchema.parse(record);
});

export const deletePreset = command(z.string(), async (id) => {
	await getPb().collection('presets').delete(id);
	getPresets().refresh();
	return { success: true };
});
