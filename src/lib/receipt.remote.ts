import { command } from '$app/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { chat } from '@tanstack/ai';
import { error } from '@sveltejs/kit';
import { todayYmd } from '$lib/utils/dateRange';
import { getModelForUser } from '$lib/server/ai';
import { getAiProvider } from '$lib/server/settings';
import { getPb } from '$lib/server/db';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4;
const MAX_CATEGORIES = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 10;

const scanRateState = new Map<string, number[]>();

function requireAuthUserId(): string {
	const userId = getPb().authStore.record?.id;
	if (!userId) {
		error(401, 'Not authenticated');
	}
	return userId;
}

function enforceScanRateLimit(userId: string): void {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;
	const recent = (scanRateState.get(userId) ?? []).filter((ts) => ts > windowStart);

	if (recent.length >= RATE_LIMIT_REQUESTS) {
		error(429, 'Too many receipt scans. Please wait a minute and try again.');
	}

	recent.push(now);
	scanRateState.set(userId, recent);
}

const ScanReceiptInputSchema = z.object({
	imageBase64: z.string().min(1).max(MAX_IMAGE_BASE64_LENGTH),
	mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
	categories: z.array(z.string().min(1).max(100)).min(1).max(MAX_CATEGORIES)
});

const ExtractedReceiptSchema = z.object({
	amount: z.number().describe('Total amount paid, positive number, no currency symbol'),
	description: z
		.string()
		.describe('Merchant name or brief description of the purchase, max 80 chars'),
	date: z.string().describe('Transaction date in YYYY-MM-DD format'),
	suggestedCategory: z.string().optional().describe('Best matching category from the provided list')
});

export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

export const scanReceipt = command(ScanReceiptInputSchema, async (input) => {
	const userId = requireAuthUserId();
	enforceScanRateLimit(userId);

	const imageBytes = Buffer.from(input.imageBase64, 'base64');
	if (imageBytes.length === 0 || imageBytes.length > MAX_IMAGE_BYTES) {
		error(413, 'Receipt image is too large. Max size is 5MB.');
	}

	const resolved = await getModelForUser();
	if (!resolved) {
		// error() (not a plain Error) so the client sees the message instead of "Internal Error".
		error(400, `No API key configured for ${await getAiProvider()}. Add it in Settings.`);
	}

	const today = todayYmd();

	try {
		return await chat({
			adapter: resolved.adapter,
			threadId: randomUUID(),
			// TanStack logs provider errors itself by default, including a masked key; we log our own line.
			debug: false,
			outputSchema: ExtractedReceiptSchema,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'data',
								value: imageBytes.toString('base64'),
								mimeType: input.mimeType
							}
						},
						{
							type: 'text',
							content: `Extract the following from this receipt image:
- amount: the total amount paid (positive number, no currency symbol)
- description: the merchant name or a brief description (max 80 chars)
- date: the transaction date in YYYY-MM-DD format (use ${today} if not visible)
- suggestedCategory: the best matching category from this list — ${input.categories.join(', ')}

If this image is not a receipt, return your best estimates.`
						}
					]
				}
			]
		});
	} catch (err) {
		// Log only the short error code (e.g. `invalid_api_key`): provider messages can echo part
		// of the API key, and schema failures carry the model's raw text (receipt contents).
		const code = (err as { code?: unknown })?.code;
		const safeCode = typeof code === 'string' && /^[\w.-]{1,64}$/.test(code) ? code : 'unknown';
		console.error(`Receipt scan failed (${resolved.source} key, code ${safeCode})`);
		error(502, 'Receipt scan failed. Try another photo, or check the API key in Settings.');
	}
});
