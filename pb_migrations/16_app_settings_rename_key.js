migrate(
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		// 'key' conflicts with PocketBase's filter parser reserved words.
		// Remove it if it exists, then add 'name'.
		try {
			coll.fields.removeByName('key');
		} catch {
			// field may not exist if migration 15 created the collection without it
		}
		coll.fields.add(new TextField({ name: 'name', required: true }));
		app.save(coll);
	},
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		coll.fields.removeByName('name');
		coll.fields.add(new TextField({ name: 'key', required: true }));
		app.save(coll);
	}
);
