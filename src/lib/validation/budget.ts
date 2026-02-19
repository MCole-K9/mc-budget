import type {
	BudgetCategory,
	CreateWalletInput,
	CreateTransactionInput,
	Wallet
} from '$lib/types/budget';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export function validateCategories(categories: BudgetCategory[]): ValidationResult {
	const errors: string[] = [];

	if (!categories || categories.length === 0) {
		errors.push('At least one category is required');
		return { valid: false, errors };
	}

	// Check for valid percentages
	for (const category of categories) {
		if (!category.name || category.name.trim() === '') {
			errors.push('Category name cannot be empty');
		}
		if (category.percentage < 0) {
			errors.push(`Category "${category.name}" has invalid percentage (must be >= 0)`);
		}
		if (category.percentage > 100) {
			errors.push(`Category "${category.name}" has invalid percentage (must be <= 100)`);
		}
		if (!category.color || !/^#[0-9A-Fa-f]{6}$/.test(category.color)) {
			errors.push(`Category "${category.name}" has invalid color format (use #RRGGBB)`);
		}
	}

	// Check for duplicates
	const names = categories.map((c) => c.name.toLowerCase().trim());
	const uniqueNames = new Set(names);
	if (uniqueNames.size !== names.length) {
		errors.push('Duplicate category names are not allowed');
	}

	// Check total equals 100%
	const total = categories.reduce((sum, c) => sum + c.percentage, 0);
	if (Math.abs(total - 100) > 0.01) {
		errors.push(`Categories must total 100% (currently ${total.toFixed(2)}%)`);
	}

	return { valid: errors.length === 0, errors };
}

export function validateWalletInput(input: CreateWalletInput): ValidationResult {
	const errors: string[] = [];

	if (!input.name || input.name.trim() === '') {
		errors.push('Wallet name is required');
	}

	if (input.name && input.name.length > 100) {
		errors.push('Wallet name must be 100 characters or less');
	}

	if (typeof input.balance !== 'number' || isNaN(input.balance)) {
		errors.push('Balance must be a valid number');
	}

	if (input.balance < 0) {
		errors.push('Balance cannot be negative');
	}

	if (!input.currency || input.currency.trim() === '') {
		errors.push('Currency is required');
	}

	if (input.currency && !/^[A-Z]{3}$/.test(input.currency.toUpperCase())) {
		errors.push('Currency must be a valid 3-letter code (e.g., USD, EUR)');
	}

	// Validate categories
	const categoryValidation = validateCategories(input.categories);
	errors.push(...categoryValidation.errors);

	return { valid: errors.length === 0, errors };
}

export function validateTransactionInput(
	input: CreateTransactionInput,
	wallet: Wallet
): ValidationResult {
	const errors: string[] = [];

	if (!input.wallet) {
		errors.push('Wallet ID is required');
	}

	if (!input.category || input.category.trim() === '') {
		errors.push('Category is required');
	}

	// Check if category exists in wallet
	if (input.category && wallet) {
		const categoryExists = wallet.categories.some(
			(c) => c.name.toLowerCase() === input.category.toLowerCase()
		);
		if (!categoryExists) {
			errors.push(`Category "${input.category}" does not exist in this wallet`);
		}
	}

	if (typeof input.amount !== 'number' || isNaN(input.amount)) {
		errors.push('Amount must be a valid number');
	}

	if (input.amount === 0) {
		errors.push('Amount cannot be zero');
	}

	if (!input.date) {
		errors.push('Date is required');
	}

	if (input.date && isNaN(Date.parse(input.date))) {
		errors.push('Invalid date format');
	}

	if (input.description && input.description.length > 500) {
		errors.push('Description must be 500 characters or less');
	}

	return { valid: errors.length === 0, errors };
}

export function calculateCategoryTotal(categories: BudgetCategory[]): number {
	return categories.reduce((sum, c) => sum + c.percentage, 0);
}

export function getCategoryAllocation(wallet: Wallet, categoryName: string): number {
	const category = wallet.categories.find(
		(c) => c.name.toLowerCase() === categoryName.toLowerCase()
	);
	if (!category) return 0;
	return (wallet.balance * category.percentage) / 100;
}
