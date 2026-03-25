/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.add(new BoolField({ name: "archived", required: false }));
  app.save(wallets);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("archived");
  app.save(wallets);
});
