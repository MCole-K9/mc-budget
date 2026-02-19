import pb from './pocketbase';
import type { BudgetPreset, BudgetCategory } from '$lib/types/budget';

// Default presets that are available even without database
export const DEFAULT_PRESETS: BudgetPreset[] = [
	{
		id: 'preset-50-30-20',
		name: '50/30/20 Rule',
		description:
			'A simple budgeting method: 50% for needs, 30% for wants, and 20% for savings and debt repayment.',
		categories: [
			{ name: 'Needs', percentage: 50, color: '#3B82F6' },
			{ name: 'Wants', percentage: 30, color: '#8B5CF6' },
			{ name: 'Savings', percentage: 20, color: '#10B981' }
		]
	},
	{
		id: 'preset-zero-based',
		name: 'Zero-Based Budget',
		description:
			'Every dollar has a job. Allocate all income across detailed categories for precise control.',
		categories: [
			{ name: 'Housing', percentage: 25, color: '#3B82F6' },
			{ name: 'Transportation', percentage: 15, color: '#8B5CF6' },
			{ name: 'Food', percentage: 15, color: '#10B981' },
			{ name: 'Utilities', percentage: 10, color: '#F59E0B' },
			{ name: 'Insurance', percentage: 10, color: '#EF4444' },
			{ name: 'Savings', percentage: 10, color: '#06B6D4' },
			{ name: 'Personal', percentage: 10, color: '#EC4899' },
			{ name: 'Entertainment', percentage: 5, color: '#6366F1' }
		]
	},
	{
		id: 'preset-envelope',
		name: 'Envelope System',
		description:
			'A simplified approach dividing money into three main envelopes for easy management.',
		categories: [
			{ name: 'Essentials', percentage: 60, color: '#3B82F6' },
			{ name: 'Financial Goals', percentage: 20, color: '#10B981' },
			{ name: 'Lifestyle', percentage: 20, color: '#8B5CF6' }
		]
	}
];

export async function getPresets(): Promise<BudgetPreset[]> {
	try {
		const records = await pb.collection('presets').getFullList({
			sort: 'name'
		});
		const dbPresets = records as unknown as BudgetPreset[];
		// Combine default presets with database presets
		return [...DEFAULT_PRESETS, ...dbPresets];
	} catch {
		// If database is unavailable, return default presets
		return DEFAULT_PRESETS;
	}
}

export async function getPreset(id: string): Promise<BudgetPreset | null> {
	// Check default presets first
	const defaultPreset = DEFAULT_PRESETS.find((p) => p.id === id);
	if (defaultPreset) {
		return defaultPreset;
	}

	try {
		const record = await pb.collection('presets').getOne(id);
		return record as unknown as BudgetPreset;
	} catch {
		return null;
	}
}

export function createCustomPreset(
	name: string,
	description: string,
	categories: BudgetCategory[]
): BudgetPreset {
	return {
		id: `custom-${Date.now()}`,
		name,
		description,
		categories
	};
}
