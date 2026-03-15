import { command } from '$app/server';
import { z } from 'zod';
import { generateText, Output, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { PROVIDER_MODELS } from '$lib/settings';
import { getAiKey, getAiProvider } from '$lib/server/settings';
import { getUserSetting } from '$lib/server/userSettings';

const ScanReceiptInputSchema = z.object({
	imageBase64: z.string(),
	mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
	categories: z.array(z.string())
});

const ExtractedReceiptSchema = z.object({
	amount: z.number().describe('Total amount paid, positive number, no currency symbol'),
	description: z.string().describe('Merchant name or brief description of the purchase, max 80 chars'),
	date: z.string().describe('Transaction date in YYYY-MM-DD format'),
	suggestedCategory: z
		.string()
		.optional()
		.describe('Best matching category from the provided list')
});

export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

export const scanReceipt = command(ScanReceiptInputSchema, async (input) => {
	const provider = await getAiProvider();
	// User's own key takes priority; fall back to system key
	const apiKey = (await getUserSetting(`${provider}_api_key`)) || (await getAiKey(provider));

	if (!apiKey) {
		throw new Error(`No API key configured for ${provider}. Add it in Settings.`);
	}

	const modelId = PROVIDER_MODELS[provider];
	let model: LanguageModel;

	switch (provider) {
		case 'anthropic':
			model = createAnthropic({ apiKey })(modelId);
			break;
		case 'openai':
			model = createOpenAI({ apiKey })(modelId);
			break;
		case 'google':
			model = createGoogleGenerativeAI({ apiKey })(modelId);
			break;
		default: {
			// Compile-time exhaustiveness check: TypeScript errors here if a new
			// provider is added to AiProvider without a corresponding case above.
			const _exhaustive: never = provider;
			throw new Error(`Unsupported AI provider: ${_exhaustive}`);
		}
	}

	const today = new Date().toISOString().split('T')[0];

	const { output } = await generateText({
		model,
		output: Output.object({ schema: ExtractedReceiptSchema }),
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image',
						image: Buffer.from(input.imageBase64, 'base64')
					},
					{
						type: 'text',
						text: `Extract the following from this receipt image:
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

	return output;
});
