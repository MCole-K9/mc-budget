migrate(
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		// Remove previous attempts at naming this field (handles both 'key' and 'name')
		try {
			coll.fields.removeByName('name');
		} catch {}
		try {
			coll.fields.removeByName('key');
		} catch {}
		coll.fields.add(new TextField({ name: 'skey', required: true }));
		app.save(coll);
	},
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		coll.fields.removeByName('skey');
		coll.fields.add(new TextField({ name: 'name', required: true }));
		app.save(coll);
	}
);
