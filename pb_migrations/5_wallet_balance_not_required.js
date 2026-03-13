/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  const balanceField = wallets.fields.getByName("balance");
  balanceField.required = false;
  app.save(wallets);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  const balanceField = wallets.fields.getByName("balance");
  balanceField.required = true;
  app.save(wallets);
});
