import { BudgetCategoriesSchema, type BudgetCategory } from '$lib/schemas/budget';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export function validateCategories(categories: BudgetCategory[]): ValidationResult {
	const result = BudgetCategoriesSchema.safeParse(categories);

	if (result.success) {
		return { valid: true, errors: [] };
	}

	const errors = result.error.issues.map((e) => e.message);
	return { valid: false, errors };
}

export function calculateCategoryTotal(categories: BudgetCategory[]): number {
	return categories.reduce((sum, c) => sum + c.percentage, 0);
}
