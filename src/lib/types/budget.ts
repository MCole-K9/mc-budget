export interface BudgetCategory {
	name: string;
	percentage: number;
	color: string;
}

export interface BudgetPreset {
	id: string;
	name: string;
	description: string;
	categories: BudgetCategory[];
}

export interface Wallet {
	id: string;
	user: string;
	name: string;
	balance: number;
	currency: string;
	categories: BudgetCategory[];
	created: string;
	updated: string;
}

export interface Transaction {
	id: string;
	wallet: string;
	category: string;
	amount: number;
	description: string;
	date: string;
	created: string;
}

export interface CreateWalletInput {
	name: string;
	balance: number;
	currency: string;
	categories: BudgetCategory[];
}

export interface CreateTransactionInput {
	wallet: string;
	category: string;
	amount: number;
	description?: string;
	date: string;
}

export interface User {
	id: string;
	email: string;
	name: string;
	avatar?: string;
	created: string;
	updated: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface RegisterInput {
	email: string;
	password: string;
	passwordConfirm: string;
	name: string;
}
