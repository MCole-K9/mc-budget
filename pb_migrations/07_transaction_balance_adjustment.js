/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const transactions = app.findCollectionByNameOrId('transactions');
		transactions.fields.add(new BoolField({ name: 'balance_adjustment', required: false }));
		app.save(transactions);
	},
	(app) => {
		const transactions = app.findCollectionByNameOrId('transactions');
		transactions.fields.removeByName('balance_adjustment');
		app.save(transactions);
	}
);
