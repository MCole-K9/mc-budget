import { BudgetCategoriesSchema, type BudgetCategory } from '$lib/schemas/budget';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export function validateCategories(
	categories: BudgetCategory[],
	budgetType: 'percentage' | 'fixed' = 'percentage'
): ValidationResult {
	const names = categories.map((c) => c.name.toLowerCase().trim());
	if (new Set(names).size !== names.length) {
		return { valid: false, errors: ['Duplicate category names are not allowed'] };
	}

	if (budgetType === 'fixed') {
		const invalid = categories.filter((c) => !c.fixedAmount || c.fixedAmount <= 0);
		if (invalid.length > 0) {
			return { valid: false, errors: ['Each category must have a fixed amount greater than 0'] };
		}
		return { valid: true, errors: [] };
	}

	// percentage mode
	const result = BudgetCategoriesSchema.safeParse(categories);
	if (result.success) return { valid: true, errors: [] };
	return { valid: false, errors: result.error.issues.map((e) => e.message) };
}

export function calculateCategoryTotal(categories: BudgetCategory[]): number {
	return categories.reduce((sum, c) => sum + c.percentage, 0);
}
