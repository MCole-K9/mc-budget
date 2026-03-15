/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("balance");
  wallets.fields.add(new NumberField({ name: "balance", required: false }));
  app.save(wallets);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("balance");
  wallets.fields.add(new NumberField({ name: "balance", required: true }));
  app.save(wallets);
});
