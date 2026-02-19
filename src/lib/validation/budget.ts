import { z } from 'zod';
import {
	BudgetCategoriesSchema,
	CreateWalletInputSchema,
	CreateTransactionInputSchema,
	type BudgetCategory,
	type CreateWalletInput,
	type CreateTransactionInput,
	type Wallet
} from '$lib/schemas/budget';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validate budget categories using Zod schema
 */
export function validateCategories(categories: BudgetCategory[]): ValidationResult {
	const result = BudgetCategoriesSchema.safeParse(categories);

	if (result.success) {
		return { valid: true, errors: [] };
	}

	// Zod v4 uses 'issues' instead of 'errors'
	const errors = result.error.issues.map((e) => e.message);
	return { valid: false, errors };
}

/**
 * Validate wallet input using Zod schema
 */
export function validateWalletInput(input: CreateWalletInput): ValidationResult {
	const result = CreateWalletInputSchema.safeParse(input);

	if (result.success) {
		return { valid: true, errors: [] };
	}

	const errors = result.error.issues.map((e) => {
		const path = e.path.join('.');
		return path ? `${path}: ${e.message}` : e.message;
	});
	return { valid: false, errors };
}

/**
 * Validate transaction input using Zod schema
 */
export function validateTransactionInput(
	input: CreateTransactionInput,
	wallet: Wallet
): ValidationResult {
	const result = CreateTransactionInputSchema.safeParse(input);

	if (!result.success) {
		const errors = result.error.issues.map((e) => {
			const path = e.path.join('.');
			return path ? `${path}: ${e.message}` : e.message;
		});
		return { valid: false, errors };
	}

	// Check if category exists in wallet
	const categoryExists = wallet.categories.some(
		(c) => c.name.toLowerCase() === input.category.toLowerCase()
	);

	if (!categoryExists) {
		return {
			valid: false,
			errors: [`Category "${input.category}" does not exist in this wallet`]
		};
	}

	return { valid: true, errors: [] };
}

/**
 * Calculate total percentage of categories
 */
export function calculateCategoryTotal(categories: BudgetCategory[]): number {
	return categories.reduce((sum, c) => sum + c.percentage, 0);
}

/**
 * Get the allocated amount for a category based on wallet balance
 */
export function getCategoryAllocation(wallet: Wallet, categoryName: string): number {
	const category = wallet.categories.find(
		(c) => c.name.toLowerCase() === categoryName.toLowerCase()
	);
	if (!category) return 0;
	return (wallet.balance * category.percentage) / 100;
}

/**
 * Parse and validate data with Zod, returning formatted errors
 */
export function safeParseWithErrors<T>(
	schema: z.ZodSchema<T>,
	data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
	const result = schema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data };
	}

	const errors = result.error.issues.map((e) => {
		const path = e.path.join('.');
		return path ? `${path}: ${e.message}` : e.message;
	});

	return { success: false, errors };
}
