/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		const existingValue = coll.fields.getByName('value');
		if (existingValue) {
			// Fresh DB (or clean existing DB): value is in PB schema.
			// Remove + re-add so PocketBase manages the DROP/ADD column itself.
			coll.fields.remove(existingValue);
			coll.fields.add(new TextField({ name: 'value', required: false }));
			app.save(coll);
		} else {
			// Orphaned case: value is a SQLite column but not in PB schema.
			// Drop the column manually first, then add via PB.
			try {
				app.db().newQuery('ALTER TABLE app_settings DROP COLUMN `value`').execute();
			} catch {
				// Column may not exist — fine, we'll add it below
			}
			coll.fields.add(new TextField({ name: 'value', required: false }));
			app.save(coll);
		}
	},
	(app) => {
		const coll = app.findCollectionByNameOrId('app_settings');
		coll.fields.removeByName('value');
		app.save(coll);
	}
);
