// Re-export all types from Zod schemas for backwards compatibility
export type {
	BudgetCategory,
	BudgetPreset,
	Wallet,
	Transaction,
	CreateWalletInput,
	CreateTransactionInput,
	User,
	LoginInput,
	RegisterInput
} from '$lib/schemas/budget';

// Re-export schemas for validation
export {
	BudgetCategorySchema,
	BudgetCategoriesSchema,
	BudgetPresetSchema,
	WalletSchema,
	TransactionSchema,
	CreateWalletInputSchema,
	CreateTransactionInputSchema,
	UserSchema,
	LoginInputSchema,
	RegisterInputSchema,
	validateTransactionCategory
} from '$lib/schemas/budget';
