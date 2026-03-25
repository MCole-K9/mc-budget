import { describe, it, expect } from 'vitest';
import { TransferFormSchema, UpdateTransactionInputSchema, TransactionSchema } from './schemas/budget';
import { computeWalletPatch, computeTransferDeleteDeltas } from './utils/balance';

// ── TransferFormSchema ─────────────────────────────────────────────────────

describe('TransferFormSchema', () => {
	it('accepts valid transfer input', () => {
		const result = TransferFormSchema.safeParse({
			sourceWalletId: 'wallet_a',
			destWalletId: 'wallet_b',
			amount: 100,
			date: '2026-03-24'
		});
		expect(result.success).toBe(true);
	});

	it('rejects amount of zero', () => {
		const result = TransferFormSchema.safeParse({
			sourceWalletId: 'wallet_a',
			destWalletId: 'wallet_b',
			amount: 0,
			date: '2026-03-24'
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toContain('greater than 0');
	});

	it('rejects negative amount', () => {
		const result = TransferFormSchema.safeParse({
			sourceWalletId: 'wallet_a',
			destWalletId: 'wallet_b',
			amount: -50,
			date: '2026-03-24'
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid date', () => {
		const result = TransferFormSchema.safeParse({
			sourceWalletId: 'wallet_a',
			destWalletId: 'wallet_b',
			amount: 100,
			date: 'not-a-date'
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toContain('Invalid date');
	});

	it('rejects empty sourceWalletId', () => {
		const result = TransferFormSchema.safeParse({
			sourceWalletId: '',
			destWalletId: 'wallet_b',
			amount: 100,
			date: '2026-03-24'
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toContain('Source wallet required');
	});

	it('accepts optional description', () => {
		const withDesc = TransferFormSchema.safeParse({
			sourceWalletId: 'a',
			destWalletId: 'b',
			amount: 50,
			description: 'Moving savings',
			date: '2026-01-01'
		});
		expect(withDesc.success).toBe(true);

		const withoutDesc = TransferFormSchema.safeParse({
			sourceWalletId: 'a',
			destWalletId: 'b',
			amount: 50,
			date: '2026-01-01'
		});
		expect(withoutDesc.success).toBe(true);
	});
});

// ── UpdateTransactionInputSchema ───────────────────────────────────────────

describe('UpdateTransactionInputSchema', () => {
	const base = {
		id: 'tx1',
		walletId: 'w1',
		isExpense: true,
		category: 'Food',
		amount: 50,
		date: '2026-03-24'
	};

	it('accepts valid expense update', () => {
		expect(UpdateTransactionInputSchema.safeParse(base).success).toBe(true);
	});

	it('accepts valid income update', () => {
		const result = UpdateTransactionInputSchema.safeParse({
			...base,
			isExpense: false,
			incomeSource: 'Salary'
		});
		expect(result.success).toBe(true);
	});

	it('rejects zero amount', () => {
		const result = UpdateTransactionInputSchema.safeParse({ ...base, amount: 0 });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toContain('greater than 0');
	});

	it('rejects invalid date', () => {
		const result = UpdateTransactionInputSchema.safeParse({ ...base, date: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── TransactionSchema – transfer_id field ─────────────────────────────────

describe('TransactionSchema transfer_id', () => {
	const base = {
		id: 'tx1',
		wallet: 'w1',
		category: 'Food',
		amount: -50,
		description: 'Groceries',
		date: '2026-03-24',
		receipt: '',
		recurring: false,
		recur_day: 0,
		recurring_source_id: '',
		created: '2026-03-24T00:00:00Z'
	};

	it('defaults transfer_id to empty string when absent', () => {
		const tx = TransactionSchema.parse(base);
		expect(tx.transfer_id).toBe('');
	});

	it('parses a transfer_id when present', () => {
		const tx = TransactionSchema.parse({ ...base, transfer_id: 'uuid-abc-123' });
		expect(tx.transfer_id).toBe('uuid-abc-123');
	});
});

// ── computeTransferDeleteDeltas ────────────────────────────────────────────

describe('computeTransferDeleteDeltas', () => {
	it('reverses a standard debit/credit pair across two wallets', () => {
		const deltas = computeTransferDeleteDeltas([
			{ wallet: 'source', amount: -100 }, // debit
			{ wallet: 'dest', amount: 100 }      // credit
		]);
		expect(deltas.get('source')).toBe(100);  // add back to source
		expect(deltas.get('dest')).toBe(-100);   // remove from dest
	});

	it('handles currency conversion (credit differs from debit)', () => {
		const deltas = computeTransferDeleteDeltas([
			{ wallet: 'source', amount: -100 },
			{ wallet: 'dest', amount: 85.5 } // converted amount
		]);
		expect(deltas.get('source')).toBe(100);
		expect(deltas.get('dest')).toBe(-85.5);
	});

	it('handles orphaned transfer (only one transaction)', () => {
		const deltas = computeTransferDeleteDeltas([
			{ wallet: 'source', amount: -50 }
		]);
		expect(deltas.get('source')).toBe(50);
		expect(deltas.get('dest')).toBeUndefined();
	});

	it('collapses deltas when both sides are in the same wallet', () => {
		const deltas = computeTransferDeleteDeltas([
			{ wallet: 'w1', amount: -100 },
			{ wallet: 'w1', amount: 100 }
		]);
		expect(deltas.get('w1')).toBe(0);
	});
});

// ── computeWalletPatch ─────────────────────────────────────────────────────

describe('computeWalletPatch', () => {
	it('adjusts balance when expense amount changes', () => {
		// was -50, now -80 → delta = -30
		const patch = computeWalletPatch(-50, -80, 1000, 1000);
		expect(patch.balance).toBe(970);
		expect(patch.total_funded).toBeUndefined();
	});

	it('adjusts balance and total_funded when income amount changes', () => {
		// was +200, now +300 → delta = +100
		const patch = computeWalletPatch(200, 300, 1000, 1000);
		expect(patch.balance).toBe(1100);
		expect(patch.total_funded).toBe(1100);
	});

	it('handles switching from income to expense', () => {
		// was +200 income, now -50 expense → balance -250, total_funded -200
		const patch = computeWalletPatch(200, -50, 1000, 1000);
		expect(patch.balance).toBe(750);
		expect(patch.total_funded).toBe(800);
	});

	it('handles switching from expense to income', () => {
		// was -50, now +100 → balance +150, total_funded +100
		const patch = computeWalletPatch(-50, 100, 1000, 500);
		expect(patch.balance).toBe(1150);
		expect(patch.total_funded).toBe(600);
	});

	it('does not touch total_funded for expense-to-expense changes', () => {
		const patch = computeWalletPatch(-20, -30, 500, 500);
		expect(patch.balance).toBe(490);
		expect(patch.total_funded).toBeUndefined();
	});
});
