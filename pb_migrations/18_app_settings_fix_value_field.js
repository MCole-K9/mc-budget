migrate(
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		// Drop the orphaned 'value' column from SQLite so PocketBase can re-create it
		// via the normal schema update path (avoids "duplicate column" errors).
		try {
			app.db().newQuery('ALTER TABLE app_settings DROP COLUMN `value`').execute();
		} catch {
			// Column may not exist — that's fine, we'll add it below regardless
		}
		coll.fields.add(new TextField({ name: 'value', required: false }));
		app.save(coll);
	},
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		coll.fields.removeByName('value');
		app.save(coll);
	}
);
