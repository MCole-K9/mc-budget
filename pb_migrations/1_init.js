/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');

		const autodate = [
			new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
			new AutodateField({ name: 'updated', onCreate: true, onUpdate: true })
		];

		// ── presets ────────────────────────────────────────────────────────────────
		const presets = new Collection({
			type: 'base',
			name: 'presets',
			listRule: '',
			viewRule: '',
			createRule: "@request.auth.id != ''",
			updateRule: '@request.auth.id = user',
			deleteRule: '@request.auth.id = user',
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'text', name: 'description', max: 500 },
				{ type: 'json', name: 'categories', required: true, maxSize: 2000000 },
				{ type: 'relation', name: 'user', collectionId: users.id, maxSelect: 1, required: false },
				...autodate
			]
		});
		app.save(presets);

		// ── wallets ────────────────────────────────────────────────────────────────
		const wallets = new Collection({
			type: 'base',
			name: 'wallets',
			listRule: '@request.auth.id = user',
			viewRule: '@request.auth.id = user',
			createRule: "@request.auth.id != ''",
			updateRule: '@request.auth.id = user',
			deleteRule: '@request.auth.id = user',
			fields: [
				{
					type: 'relation',
					name: 'user',
					required: true,
					collectionId: users.id,
					cascadeDelete: true,
					maxSelect: 1
				},
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'number', name: 'balance' },
				{ type: 'text', name: 'currency', required: true, min: 3, max: 3, pattern: '^[A-Z]{3}$' },
				{ type: 'json', name: 'categories', required: true, maxSize: 2000000 },
				{ type: 'number', name: 'initial_balance' },
				{ type: 'number', name: 'total_funded' },
				{ type: 'text', name: 'default_period' },
				{ type: 'json', name: 'saved_periods', maxSize: 2000000 },
				{ type: 'number', name: 'cycle_start_day', min: 1, max: 28 },
				{ type: 'text', name: 'budget_type' },
				...autodate
			]
		});
		app.save(wallets);

		// ── transactions ───────────────────────────────────────────────────────────
		const savedWallets = app.findCollectionByNameOrId('wallets');
		const transactions = new Collection({
			type: 'base',
			name: 'transactions',
			listRule: '@request.auth.id = wallet.user',
			viewRule: '@request.auth.id = wallet.user',
			createRule: '@request.auth.id = wallet.user',
			updateRule: '@request.auth.id = wallet.user',
			deleteRule: '@request.auth.id = wallet.user',
			fields: [
				{
					type: 'relation',
					name: 'wallet',
					required: true,
					collectionId: savedWallets.id,
					cascadeDelete: true,
					maxSelect: 1
				},
				{ type: 'text', name: 'category', required: true, max: 100 },
				{ type: 'number', name: 'amount', required: true },
				{ type: 'text', name: 'description', max: 500 },
				{ type: 'date', name: 'date', required: true },
				{
					type: 'file',
					name: 'receipt',
					maxSize: 5000000,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
				},
				{ type: 'bool', name: 'recurring' },
				{ type: 'number', name: 'recur_day' },
				{ type: 'text', name: 'recurring_source_id' },
				...autodate
			]
		});
		app.save(transactions);

		// ── app_settings ───────────────────────────────────────────────────────────
		const appSettings = new Collection({
			type: 'base',
			name: 'app_settings',
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'text', name: 'skey', required: true },
				{ type: 'text', name: 'value' },
				...autodate
			]
		});
		app.save(appSettings);

		// ── seed default presets ───────────────────────────────────────────────────
		const presetData = [
			{
				name: '50/30/20 Rule',
				description: 'A simple budgeting method: 50% for needs, 30% for wants, and 20% for savings.',
				categories: [
					{ name: 'Needs', percentage: 50, color: '#3B82F6' },
					{ name: 'Wants', percentage: 30, color: '#10B981' },
					{ name: 'Savings', percentage: 20, color: '#F59E0B' }
				]
			},
			{
				name: 'Zero-Based Budget',
				description: 'Allocate every dollar to specific categories until you reach zero.',
				categories: [
					{ name: 'Housing', percentage: 25, color: '#3B82F6' },
					{ name: 'Transportation', percentage: 15, color: '#10B981' },
					{ name: 'Food', percentage: 15, color: '#F59E0B' },
					{ name: 'Utilities', percentage: 10, color: '#EF4444' },
					{ name: 'Insurance', percentage: 10, color: '#8B5CF6' },
					{ name: 'Savings', percentage: 10, color: '#EC4899' },
					{ name: 'Personal', percentage: 10, color: '#06B6D4' },
					{ name: 'Entertainment', percentage: 5, color: '#84CC16' }
				]
			},
			{
				name: 'Envelope System',
				description: 'A cash-based system with three main spending categories.',
				categories: [
					{ name: 'Essentials', percentage: 60, color: '#3B82F6' },
					{ name: 'Financial Goals', percentage: 20, color: '#10B981' },
					{ name: 'Lifestyle', percentage: 20, color: '#F59E0B' }
				]
			}
		];

		for (const data of presetData) {
			const record = new Record(presets);
			record.set('name', data.name);
			record.set('description', data.description);
			record.set('categories', data.categories);
			app.save(record);
		}
	},
	(app) => {
		for (const name of ['transactions', 'wallets', 'presets', 'app_settings']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {}
		}
	}
);
