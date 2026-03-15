migrate(
	(app) => {
		const settings = new Collection({
			type: 'base',
			name: 'app_settings',
			// All null — no client access; only readable via admin credentials server-side
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				new TextField({ name: 'key', required: true }),
				new TextField({ name: 'value', required: false })
			]
		});
		app.save(settings);
	},
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		app.delete(coll);
	}
);
