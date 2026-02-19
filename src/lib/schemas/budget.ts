import { z } from 'zod';

// Budget Category Schema
export const BudgetCategorySchema = z.object({
	name: z.string().min(1, 'Category name is required').max(100),
	percentage: z.number().min(0).max(100),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (#RRGGBB)')
});

export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

// Categories array with 100% total validation
export const BudgetCategoriesSchema = z
	.array(BudgetCategorySchema)
	.min(1, 'At least one category is required')
	.refine(
		(categories) => {
			const total = categories.reduce((sum, c) => sum + c.percentage, 0);
			return Math.abs(total - 100) < 0.01;
		},
		{ message: 'Categories must total exactly 100%' }
	)
	.refine(
		(categories) => {
			const names = categories.map((c) => c.name.toLowerCase().trim());
			return new Set(names).size === names.length;
		},
		{ message: 'Duplicate category names are not allowed' }
	);

// Create Wallet Input Schema
export const CreateWalletInputSchema = z.object({
	name: z.string().min(1, 'Wallet name is required').max(100),
	balance: z.number().min(0, 'Balance cannot be negative'),
	currency: z
		.string()
		.length(3, 'Currency must be a 3-letter code')
		.regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters')
		.transform((v) => v.toUpperCase()),
	categories: BudgetCategoriesSchema
});

export type CreateWalletInput = z.infer<typeof CreateWalletInputSchema>;

// Create Transaction Input Schema
export const CreateTransactionInputSchema = z.object({
	wallet: z.string().min(1, 'Wallet ID is required'),
	category: z.string().min(1, 'Category is required'),
	amount: z.number().refine((v) => v !== 0, 'Amount cannot be zero'),
	description: z.string().max(500).optional(),
	date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date format')
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

// Login Input Schema
export const LoginInputSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(1, 'Password is required')
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

// Register Input Schema
export const RegisterInputSchema = z
	.object({
		email: z.string().email('Invalid email address'),
		password: z.string().min(8, 'Password must be at least 8 characters'),
		passwordConfirm: z.string(),
		name: z.string().min(1, 'Name is required').max(100)
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: 'Passwords do not match',
		path: ['passwordConfirm']
	});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

// Wallet Schema (from database)
export const WalletSchema = z.object({
	id: z.string(),
	user: z.string(),
	name: z.string(),
	balance: z.number(),
	currency: z.string(),
	categories: z.array(BudgetCategorySchema),
	created: z.string(),
	updated: z.string()
});

export type Wallet = z.infer<typeof WalletSchema>;

// Transaction Schema (from database)
export const TransactionSchema = z.object({
	id: z.string(),
	wallet: z.string(),
	category: z.string(),
	amount: z.number(),
	description: z.string(),
	date: z.string(),
	created: z.string()
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Budget Preset Schema
export const BudgetPresetSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	categories: z.array(BudgetCategorySchema)
});

export type BudgetPreset = z.infer<typeof BudgetPresetSchema>;

// User Schema
export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	name: z.string(),
	avatar: z.string().optional(),
	created: z.string(),
	updated: z.string()
});

export type User = z.infer<typeof UserSchema>;

// Validate transaction category exists in wallet
export function validateTransactionCategory(
	input: CreateTransactionInput,
	wallet: Wallet
): { success: true; data: CreateTransactionInput } | { success: false; error: string } {
	const categoryExists = wallet.categories.some(
		(c) => c.name.toLowerCase() === input.category.toLowerCase()
	);

	if (!categoryExists) {
		return {
			success: false,
			error: `Category "${input.category}" does not exist in this wallet`
		};
	}

	return { success: true, data: input };
}
