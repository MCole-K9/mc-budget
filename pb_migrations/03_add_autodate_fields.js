/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collectionNames = ["presets", "wallets", "transactions"];

  for (const name of collectionNames) {
    const col = app.findCollectionByNameOrId(name);

    if (!col.fields.getByName("created")) {
      col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    }

    if (!col.fields.getByName("updated")) {
      col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
    }

    app.save(col);
  }

}, (app) => {
  const collectionNames = ["presets", "wallets", "transactions"];

  for (const name of collectionNames) {
    const col = app.findCollectionByNameOrId(name);
    const created = col.fields.getByName("created");
    const updated = col.fields.getByName("updated");
    if (created) col.fields.remove(created);
    if (updated) col.fields.remove(updated);
    app.save(col);
  }
});
